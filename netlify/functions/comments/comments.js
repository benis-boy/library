const { Redis } = require('@upstash/redis');

const isLocalDeploy = process.env.LOCAL_DEPLOY === 'true' || process.env.NETLIFY_DEV === 'true';
const COMMENT_KEY_PREFIX = `${isLocalDeploy ? 'local:' : ''}comments:v1`;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

let redisClient = null;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const getRedis = () => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = Redis.fromEnv();
  return redisClient;
};

const toPageLocationKey = (locationId) => `${locationId.bookId}:${locationId.chapterId}`;

const toPageThreadsRedisKey = (locationId) => `${COMMENT_KEY_PREFIX}:page:${toPageLocationKey(locationId)}:threads`;

const toCommentLikedUserNamesRedisKey = (commentId) => `${COMMENT_KEY_PREFIX}:comment:${commentId}:likes`;

const parseJsonBody = (event) => {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
};

const isPageLocationId = (value) => {
  return typeof value?.bookId === 'string' && value.bookId.length > 0 && typeof value?.chapterId === 'string' && value.chapterId.length > 0;
};

const isThreadLocationId = (value) => {
  return isPageLocationId(value) && (value.lineNumber === undefined || typeof value.lineNumber === 'number');
};

const isComment = (value) => {
  return (
    typeof value?.timestamp === 'number' &&
    (typeof value.userName === 'string' || value.userName === null) &&
    typeof value.text === 'string' &&
    (typeof value.imageUrl === 'string' || value.imageUrl === null) &&
    Array.isArray(value.replyIds) &&
    value.replyIds.every((replyId) => typeof replyId === 'string')
  );
};

const isCommentsById = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isComment);
};

const isThreadMutation = (value) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  switch (value.type) {
    case 'start-thread':
      return (
        isThreadLocationId(value.locationId) &&
        typeof value.rootCommentId === 'string' &&
        isCommentsById(value.commentsById) &&
        Boolean(value.commentsById[value.rootCommentId])
      );
    case 'upsert-comment':
      return typeof value.commentId === 'string' && isComment(value.comment) && typeof value.replyingTo === 'string';
    case 'delete-comment':
      return typeof value.commentId === 'string' && typeof value.wasReplyingTo === 'string';
    case 'add-comment-like':
    case 'remove-comment-like':
      return typeof value.commentId === 'string' && typeof value.userName === 'string' && value.userName.length > 0;
    default:
      return false;
  }
};

const getThreadsForPage = async (redis, locationId) => {
  const value = await redis.get(toPageThreadsRedisKey(locationId));
  return Array.isArray(value) ? value : [];
};

const setThreadsForPage = async (redis, locationId, threads) => {
  await redis.set(toPageThreadsRedisKey(locationId), threads);
};

const getLikedUserNamesForComment = async (redis, commentId) => {
  const value = await redis.get(toCommentLikedUserNamesRedisKey(commentId));
  return Array.isArray(value) ? value.filter((userName) => typeof userName === 'string') : [];
};

const setLikedUserNamesForComment = async (redis, commentId, likedUserNames) => {
  await redis.set(toCommentLikedUserNamesRedisKey(commentId), likedUserNames);
};

const includesComment = (thread, commentId) => Boolean(thread.commentsById?.[commentId]);

const replaceOrInsertThread = (threads, nextThread) => {
  const existingIndex = threads.findIndex((thread) => thread.rootCommentId === nextThread.rootCommentId);
  if (existingIndex === -1) {
    return [...threads, nextThread];
  }

  return threads.map((thread, index) => (index === existingIndex ? nextThread : thread));
};

const upsertComment = (threads, mutation) => {
  let didMutate = false;
  const nextThreads = threads.map((thread) => {
    if (didMutate || !includesComment(thread, mutation.replyingTo)) {
      return thread;
    }

    didMutate = true;
    const replyingToComment = thread.commentsById[mutation.replyingTo];
    const nextReplyIds = replyingToComment.replyIds.includes(mutation.commentId)
      ? replyingToComment.replyIds
      : [...replyingToComment.replyIds, mutation.commentId];

    return {
      ...thread,
      commentsById: {
        ...thread.commentsById,
        [mutation.replyingTo]: {
          ...replyingToComment,
          replyIds: nextReplyIds,
        },
        [mutation.commentId]: mutation.comment,
      },
    };
  });

  return [nextThreads, didMutate];
};

const deleteComment = (threads, mutation) => {
  let didMutate = false;
  const nextThreads = threads.flatMap((thread) => {
    if (didMutate || !includesComment(thread, mutation.commentId)) {
      return [thread];
    }

    didMutate = true;
    if (thread.rootCommentId === mutation.commentId) {
      return [];
    }

    const nextCommentsById = {};
    for (const [commentId, comment] of Object.entries(thread.commentsById)) {
      if (commentId === mutation.commentId) {
        continue;
      }

      nextCommentsById[commentId] =
        commentId === mutation.wasReplyingTo
          ? {
              ...comment,
              replyIds: comment.replyIds.filter((replyId) => replyId !== mutation.commentId),
            }
          : comment;
    }

    if (!nextCommentsById[thread.rootCommentId]) {
      return [];
    }

    return [
      {
        ...thread,
        commentsById: nextCommentsById,
      },
    ];
  });

  return [nextThreads, didMutate];
};

const applyThreadArrayMutation = (threads, mutation) => {
  switch (mutation.type) {
    case 'start-thread':
      return [
        replaceOrInsertThread(threads, {
          locationId: mutation.locationId,
          rootCommentId: mutation.rootCommentId,
          commentsById: mutation.commentsById,
        }),
        true,
      ];
    case 'upsert-comment':
      return upsertComment(threads, mutation);
    case 'delete-comment':
      return deleteComment(threads, mutation);
    default:
      return [threads, false];
  }
};

const handleGet = async (event) => {
  const redis = getRedis();
  const query = event.queryStringParameters || {};

  if (query.commentId || query.commentIds) {
    const commentIds = (query.commentIds || query.commentId)
      .split(',')
      .map((commentId) => commentId.trim())
      .filter(Boolean);

    const entries = await Promise.all(
      commentIds.map(async (commentId) => {
        const likedUserNames = await getLikedUserNamesForComment(redis, commentId);
        return [commentId, likedUserNames];
      })
    );

    return json(200, {
      likedUserNamesByCommentId: Object.fromEntries(entries),
    });
  }

  const pageLocationId = {
    bookId: query.bookId,
    chapterId: query.chapterId,
  };

  if (!isPageLocationId(pageLocationId)) {
    return json(400, { error: 'bookId and chapterId are required.' });
  }

  return json(200, {
    pageLocationId,
    threads: await getThreadsForPage(redis, pageLocationId),
  });
};

const handlePost = async (event) => {
  const request = parseJsonBody(event);
  if (!isPageLocationId(request?.pageLocationId) || !isThreadMutation(request?.mutation)) {
    return json(400, { error: 'Expected { pageLocationId, mutation } with a valid thread mutation.' });
  }

  const redis = getRedis();
  const { mutation } = request;

  if (mutation.type === 'add-comment-like') {
    const likedUserNames = await getLikedUserNamesForComment(redis, mutation.commentId);
    if (likedUserNames.includes(mutation.userName)) {
      return json(200, {
        type: 'comment-liked-users-updated',
        commentId: mutation.commentId,
        likedUserNames,
        likeCount: likedUserNames.length,
      });
    }

    const nextLikedUserNames = [...likedUserNames, mutation.userName];
    await setLikedUserNamesForComment(redis, mutation.commentId, nextLikedUserNames);

    return json(200, {
      type: 'comment-liked-users-updated',
      commentId: mutation.commentId,
      likedUserNames: nextLikedUserNames,
      likeCount: nextLikedUserNames.length,
    });
  }

  if (mutation.type === 'remove-comment-like') {
    const likedUserNames = await getLikedUserNamesForComment(redis, mutation.commentId);
    const nextLikedUserNames = likedUserNames.filter((userName) => userName !== mutation.userName);
    if (likedUserNames.length === nextLikedUserNames.length) {
      return json(200, {
        type: 'comment-liked-users-updated',
        commentId: mutation.commentId,
        likedUserNames,
        likeCount: likedUserNames.length,
      });
    }

    await setLikedUserNamesForComment(redis, mutation.commentId, nextLikedUserNames);

    return json(200, {
      type: 'comment-liked-users-updated',
      commentId: mutation.commentId,
      likedUserNames: nextLikedUserNames,
      likeCount: nextLikedUserNames.length,
    });
  }

  const pageLocationId =
    mutation.type === 'start-thread'
      ? {
          bookId: mutation.locationId.bookId,
          chapterId: mutation.locationId.chapterId,
        }
      : request.pageLocationId;
  const threads = await getThreadsForPage(redis, pageLocationId);
  const [nextThreads, didMutate] = applyThreadArrayMutation(threads, mutation);

  if (!didMutate) {
    return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
  }

  await setThreadsForPage(redis, pageLocationId, nextThreads);

  return json(200, {
    type: 'threads-updated',
    pageLocationId,
    threads: nextThreads,
  });
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'CORS Preflight',
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await handleGet(event);
    }

    if (event.httpMethod === 'POST') {
      return await handlePost(event);
    }

    return json(405, { error: 'Method Not Allowed' });
  } catch (error) {
    return json(500, {
      error: 'Comments request failed.',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
