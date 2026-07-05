const COMMENT_KEY_PREFIX = `comments:v1`;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const getRedisEnv = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.');
  }

  return {
    url: url.replace(/\/+$/, ''),
    token,
  };
};

const redisCommand = async (command) => {
  const { url, token } = getRedisEnv();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Upstash Redis command failed with status ${response.status}.`);
  }

  return payload?.result;
};

const redisGet = async (key) => {
  const value = await redisCommand(['GET', key]);
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const redisSet = async (key, value) => {
  await redisCommand(['SET', key, JSON.stringify(value)]);
};

const redisDelete = async (key) => {
  await redisCommand(['DEL', key]);
};

const toPageLocationKey = (locationId) => `${locationId.bookId}:${locationId.chapterId}`;

const toPageThreadKeysRedisKey = (locationId) => `${COMMENT_KEY_PREFIX}:page:${toPageLocationKey(locationId)}:thread-keys`;

const toThreadLocationKey = (locationId) => {
  const linePart = typeof locationId.lineNumber === 'number' ? locationId.lineNumber : 'chapter';
  return `${locationId.bookId}:${locationId.chapterId}:${linePart}`;
};

const toThreadRedisKey = (thread) => {
  return `${COMMENT_KEY_PREFIX}:thread:${toThreadLocationKey(thread.locationId)}:${thread.rootCommentId}`;
};

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
  return (
    typeof value?.bookId === 'string' &&
    value.bookId.length > 0 &&
    typeof value?.chapterId === 'string' &&
    value.chapterId.length > 0
  );
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
    value.replyIds.every((replyId) => typeof replyId === 'string') &&
    (value.updated === undefined || typeof value.updated === 'boolean')
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

const getThreadKeysForPage = async (locationId) => {
  const value = await redisGet(toPageThreadKeysRedisKey(locationId));
  return Array.isArray(value) ? value.filter((threadKey) => typeof threadKey === 'string') : [];
};

const setThreadKeysForPage = async (locationId, threadKeys) => {
  await redisSet(toPageThreadKeysRedisKey(locationId), Array.from(new Set(threadKeys)));
};

const getThreadByKey = async (threadKey) => {
  const value = await redisGet(threadKey);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
};

const getThreadsByKeys = async (threadKeys) => {
  const threadResults = await Promise.all(threadKeys.map((threadKey) => getThreadByKey(threadKey)));
  return threadResults.filter((thread) => thread !== null);
};

const setThread = async (thread) => {
  const threadKey = toThreadRedisKey(thread);
  await redisSet(threadKey, thread);
  return threadKey;
};

const deleteThread = async (threadKey) => {
  await redisDelete(threadKey);
};

const getLikedUserNamesForComment = async (commentId) => {
  const value = await redisGet(toCommentLikedUserNamesRedisKey(commentId));
  return Array.isArray(value) ? value.filter((userName) => typeof userName === 'string') : [];
};

const setLikedUserNamesForComment = async (commentId, likedUserNames) => {
  await redisSet(toCommentLikedUserNamesRedisKey(commentId), likedUserNames);
};

const includesComment = (thread, commentId) => Boolean(thread.commentsById?.[commentId]);

const isChapterThread = (thread) => thread.locationId?.lineNumber === undefined;

const splitThreadKeysByLocation = async (threadKeys) => {
  const entries = await Promise.all(
    threadKeys.map(async (threadKey) => {
      const thread = await getThreadByKey(threadKey);
      return thread ? { threadKey, thread } : null;
    })
  );

  const chapterThreads = [];
  const lineThreadKeys = [];

  for (const entry of entries) {
    if (!entry) {
      continue;
    }

    if (isChapterThread(entry.thread)) {
      chapterThreads.push(entry.thread);
    } else {
      lineThreadKeys.push(entry.threadKey);
    }
  }

  return { chapterThreads, lineThreadKeys };
};

const findThreadEntryByCommentId = async (threadKeys, commentId) => {
  for (const threadKey of threadKeys) {
    const thread = await getThreadByKey(threadKey);
    if (thread && includesComment(thread, commentId)) {
      return { threadKey, thread };
    }
  }

  return null;
};

const upsertCommentInThread = (thread, mutation) => {
  if (includesComment(thread, mutation.commentId)) {
    return {
      ...thread,
      commentsById: {
        ...thread.commentsById,
        [mutation.commentId]: {
          ...mutation.comment,
          replyIds: thread.commentsById[mutation.commentId].replyIds,
        },
      },
    };
  }

  if (!includesComment(thread, mutation.replyingTo)) {
    return null;
  }

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
};

const collectCommentSubtreeIds = (commentsById, rootCommentId) => {
  const idsToDelete = new Set();
  const stack = [rootCommentId];

  while (stack.length > 0) {
    const commentId = stack.pop();
    if (!commentId || idsToDelete.has(commentId)) {
      continue;
    }

    idsToDelete.add(commentId);
    const comment = commentsById[commentId];
    if (!comment) {
      continue;
    }

    for (const replyId of comment.replyIds) {
      stack.push(replyId);
    }
  }

  return idsToDelete;
};

const deleteCommentFromThread = (thread, mutation) => {
  if (!includesComment(thread, mutation.commentId)) {
    return { didMutate: false, thread };
  }

  if (thread.rootCommentId === mutation.commentId) {
    return { didMutate: true, thread: null };
  }

  const commentIdsToDelete = collectCommentSubtreeIds(thread.commentsById, mutation.commentId);
  const nextCommentsById = {};
  for (const [commentId, comment] of Object.entries(thread.commentsById)) {
    if (commentIdsToDelete.has(commentId)) {
      continue;
    }

    nextCommentsById[commentId] = {
      ...comment,
      replyIds: comment.replyIds.filter((replyId) => !commentIdsToDelete.has(replyId)),
    };
  }

  if (!nextCommentsById[thread.rootCommentId]) {
    return { didMutate: true, thread: null };
  }

  return {
    didMutate: true,
    thread: {
      ...thread,
      commentsById: nextCommentsById,
    },
  };
};

const handleGet = async (event) => {
  const query = event.queryStringParameters || {};

  if (query.commentId || query.commentIds) {
    const commentIds = (query.commentIds || query.commentId)
      .split(',')
      .map((commentId) => commentId.trim())
      .filter(Boolean);

    const entries = await Promise.all(
      commentIds.map(async (commentId) => {
        const likedUserNames = await getLikedUserNamesForComment(commentId);
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

  const threadKeys = await getThreadKeysForPage(pageLocationId);
  const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(threadKeys);

  return json(200, {
    pageLocationId,
    chapterThreads,
    lineThreadKeys,
  });
};

const handlePost = async (event) => {
  const request = parseJsonBody(event);
  if (!isPageLocationId(request?.pageLocationId) || !isThreadMutation(request?.mutation)) {
    return json(400, { error: 'Expected { pageLocationId, mutation } with a valid thread mutation.' });
  }

  const { mutation } = request;

  if (mutation.type === 'add-comment-like') {
    const likedUserNames = await getLikedUserNamesForComment(mutation.commentId);
    if (likedUserNames.includes(mutation.userName)) {
      return json(200, {
        type: 'comment-liked-users-updated',
        commentId: mutation.commentId,
        likedUserNames,
        likeCount: likedUserNames.length,
      });
    }

    const nextLikedUserNames = [...likedUserNames, mutation.userName];
    await setLikedUserNamesForComment(mutation.commentId, nextLikedUserNames);

    return json(200, {
      type: 'comment-liked-users-updated',
      commentId: mutation.commentId,
      likedUserNames: nextLikedUserNames,
      likeCount: nextLikedUserNames.length,
    });
  }

  if (mutation.type === 'remove-comment-like') {
    const likedUserNames = await getLikedUserNamesForComment(mutation.commentId);
    const nextLikedUserNames = likedUserNames.filter((userName) => userName !== mutation.userName);
    if (likedUserNames.length === nextLikedUserNames.length) {
      return json(200, {
        type: 'comment-liked-users-updated',
        commentId: mutation.commentId,
        likedUserNames,
        likeCount: likedUserNames.length,
      });
    }

    await setLikedUserNamesForComment(mutation.commentId, nextLikedUserNames);

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
  const threadKeys = await getThreadKeysForPage(pageLocationId);

  if (mutation.type === 'start-thread') {
    const nextThread = {
      locationId: mutation.locationId,
      rootCommentId: mutation.rootCommentId,
      commentsById: mutation.commentsById,
    };
    const threadKey = await setThread(nextThread);
    await setThreadKeysForPage(pageLocationId, [...threadKeys.filter((existingThreadKey) => existingThreadKey !== threadKey), threadKey]);

    const nextThreadKeys = await getThreadKeysForPage(pageLocationId);
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(nextThreadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads,
      lineThreadKeys,
    });
  }

  if (mutation.type === 'upsert-comment') {
    const entry = await findThreadEntryByCommentId(threadKeys, mutation.replyingTo);
    if (!entry) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    const nextThread = upsertCommentInThread(entry.thread, mutation);
    if (!nextThread) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    await setThread(nextThread);
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(threadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads,
      lineThreadKeys,
    });
  }

  if (mutation.type === 'delete-comment') {
    const entry = await findThreadEntryByCommentId(threadKeys, mutation.commentId);
    if (!entry) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    const result = deleteCommentFromThread(entry.thread, mutation);
    if (!result.didMutate) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    const nextThreadKeys = threadKeys.filter((threadKey) => threadKey !== entry.threadKey);
    if (result.thread) {
      await setThread(result.thread);
      nextThreadKeys.push(entry.threadKey);
    } else {
      await deleteThread(entry.threadKey);
    }

    await setThreadKeysForPage(pageLocationId, nextThreadKeys);
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(nextThreadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads,
      lineThreadKeys,
    });
  }

  return json(400, { error: 'Unsupported mutation type.' });
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
