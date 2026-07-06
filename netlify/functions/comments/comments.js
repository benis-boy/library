const crypto = require('crypto');

const COMMENT_KEY_PREFIX = `comments:v1`;
const DEFAULT_REACTION_EMOJI = '❤️';
const COMMENT_TEXT_MAX_LENGTH = 2000;
const COMMENT_MEDIA_URL_MAX_LENGTH = 2048;

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

const toCommentReactionsRedisKey = (commentId) => `${COMMENT_KEY_PREFIX}:comment:${commentId}:likes`;

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

const getCommentsAuthSecret = () => {
  const secret = process.env.COMMENTS_AUTH_SECRET;
  if (!secret) {
    throw new Error('Missing COMMENTS_AUTH_SECRET.');
  }

  return secret;
};

const signUserName = (userName) => crypto.createHmac('sha256', getCommentsAuthSecret()).update(userName).digest('base64url');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isMutationOwner = (value) => {
  return (
    value === null ||
    (typeof value?.userName === 'string' &&
      value.userName.length > 0 &&
      typeof value?.signedUser === 'string' &&
      value.signedUser.length > 0)
  );
};

const isVerifiedMutationOwner = (mutationOwner) => {
  return mutationOwner !== null && safeEqual(signUserName(mutationOwner.userName), mutationOwner.signedUser);
};

const getVerifiedMutationOwner = (mutationOwner) => {
  if (mutationOwner === null) {
    return null;
  }

  if (!isVerifiedMutationOwner(mutationOwner)) {
    return null;
  }

  return {
    userName: mutationOwner.userName,
    signedUser: mutationOwner.signedUser,
  };
};

const doMutationOwnersMatch = (left, right) => {
  return left !== null && right !== null && left.userName === right.userName && safeEqual(left.signedUser, right.signedUser);
};

const getMutationAuthError = (mutationOwner) => {
  if (mutationOwner !== null && !isVerifiedMutationOwner(mutationOwner)) {
    return 'Invalid comment user signature.';
  }

  return null;
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
    (value.updated === undefined || typeof value.updated === 'boolean') &&
    (value.mutationOwner === undefined || isMutationOwner(value.mutationOwner))
  );
};

const getInvalidCommentLength = (comment) => {
  if (comment.text.length > COMMENT_TEXT_MAX_LENGTH) {
    return `Comment text must be ${COMMENT_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  if (comment.imageUrl !== null && comment.imageUrl.length > COMMENT_MEDIA_URL_MAX_LENGTH) {
    return `Media URL must be ${COMMENT_MEDIA_URL_MAX_LENGTH} characters or fewer.`;
  }

  return null;
};

const getInvalidMutationLength = (mutation) => {
  if (mutation.type === 'start-thread') {
    for (const comment of Object.values(mutation.commentsById)) {
      const error = getInvalidCommentLength(comment);
      if (error) {
        return error;
      }
    }
  }

  if (mutation.type === 'upsert-comment') {
    return getInvalidCommentLength(mutation.comment);
  }

  return null;
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
        isMutationOwner(value.mutationOwner) &&
        isThreadLocationId(value.locationId) &&
        typeof value.rootCommentId === 'string' &&
        isCommentsById(value.commentsById) &&
        Boolean(value.commentsById[value.rootCommentId])
      );
    case 'upsert-comment':
      return (
        isMutationOwner(value.mutationOwner) &&
        typeof value.commentId === 'string' &&
        isComment(value.comment) &&
        typeof value.replyingTo === 'string'
      );
    case 'delete-comment':
      return isMutationOwner(value.mutationOwner) && typeof value.commentId === 'string' && typeof value.wasReplyingTo === 'string';
    case 'set-comment-reactions':
      return (
        isMutationOwner(value.mutationOwner) &&
        typeof value.commentId === 'string' &&
        Array.isArray(value.emojis) &&
        value.emojis.every((emoji) => typeof emoji === 'string' && emoji.length > 0) &&
        typeof value.userName === 'string' &&
        value.userName.length > 0
      );
    default:
      return false;
  }
};

const sanitizeComment = (comment) => {
  const { mutationOwner, ...sanitizedComment } = comment;
  return sanitizedComment;
};

const sanitizeThread = (thread) => ({
  ...thread,
  commentsById: Object.fromEntries(Object.entries(thread.commentsById).map(([commentId, comment]) => [commentId, sanitizeComment(comment)])),
});

const sanitizeThreads = (threads) => threads.map(sanitizeThread);

const commentWithOwner = (comment, mutationOwner) => ({
  ...comment,
  userName: mutationOwner?.userName ?? null,
  mutationOwner,
});

const commentsWithOwner = (commentsById, mutationOwner) => {
  return Object.fromEntries(
    Object.entries(commentsById).map(([commentId, comment]) => [commentId, commentWithOwner(comment, mutationOwner)])
  );
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

const normalizeCommentReactions = (value) => {
  if (Array.isArray(value)) {
    const likedUserNames = value.filter((userName) => typeof userName === 'string');
    return likedUserNames.length > 0 ? { [DEFAULT_REACTION_EMOJI]: likedUserNames } : {};
  }

  if (!value || typeof value !== 'object') {
    return {};
  }

  const reactions = {};
  for (const [emoji, userNames] of Object.entries(value)) {
    if (typeof emoji !== 'string' || !Array.isArray(userNames)) {
      continue;
    }

    const normalizedUserNames = userNames.filter((userName) => typeof userName === 'string');
    if (normalizedUserNames.length > 0) {
      reactions[emoji] = normalizedUserNames;
    }
  }

  return reactions;
};

const getReactionsForComment = async (commentId) => {
  const value = await redisGet(toCommentReactionsRedisKey(commentId));
  return normalizeCommentReactions(value);
};

const setReactionsForComment = async (commentId, reactions) => {
  await redisSet(toCommentReactionsRedisKey(commentId), normalizeCommentReactions(reactions));
};

const deleteReactionsForComment = async (commentId) => {
  await redisDelete(toCommentReactionsRedisKey(commentId));
};

const setUserReactionsForComment = (reactions, userName, emojis) => {
  const desiredEmojis = new Set(emojis);
  const nextReactions = {};

  for (const [emoji, userNames] of Object.entries(reactions)) {
    const nextUserNames = userNames.filter((reactionUserName) => reactionUserName !== userName);
    if (desiredEmojis.has(emoji)) {
      nextUserNames.push(userName);
    }

    if (nextUserNames.length > 0) {
      nextReactions[emoji] = nextUserNames;
    }
  }

  for (const emoji of desiredEmojis) {
    if (!nextReactions[emoji]) {
      nextReactions[emoji] = [userName];
    }
  }

  return normalizeCommentReactions(nextReactions);
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

const upsertCommentInThread = (thread, mutation, mutationOwner) => {
  if (includesComment(thread, mutation.commentId)) {
    const existingComment = thread.commentsById[mutation.commentId];
    if (!doMutationOwnersMatch(existingComment.mutationOwner ?? null, mutationOwner)) {
      return { error: 'Only the comment owner can edit this comment.' };
    }

    return {
      thread: {
        ...thread,
        commentsById: {
          ...thread.commentsById,
          [mutation.commentId]: {
            ...commentWithOwner(mutation.comment, mutationOwner),
            replyIds: existingComment.replyIds,
          },
        },
      },
    };
  }

  if (!includesComment(thread, mutation.replyingTo)) {
    return { error: 'Could not find a matching thread/comment for this mutation.' };
  }

  const replyingToComment = thread.commentsById[mutation.replyingTo];
  const nextReplyIds = replyingToComment.replyIds.includes(mutation.commentId)
    ? replyingToComment.replyIds
    : [...replyingToComment.replyIds, mutation.commentId];

  return {
    thread: {
      ...thread,
      commentsById: {
        ...thread.commentsById,
        [mutation.replyingTo]: {
          ...replyingToComment,
          replyIds: nextReplyIds,
        },
        [mutation.commentId]: commentWithOwner(mutation.comment, mutationOwner),
      },
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

const deleteCommentFromThread = (thread, mutation, mutationOwner) => {
  if (!includesComment(thread, mutation.commentId)) {
    return { didMutate: false, thread };
  }

  if (!doMutationOwnersMatch(thread.commentsById[mutation.commentId].mutationOwner ?? null, mutationOwner)) {
    return { error: 'Only the comment owner can delete this comment.' };
  }

  if (thread.rootCommentId === mutation.commentId) {
    return { didMutate: true, thread: null, deletedCommentIds: Object.keys(thread.commentsById) };
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
    return { didMutate: true, thread: null, deletedCommentIds: Array.from(commentIdsToDelete) };
  }

  return {
    didMutate: true,
    deletedCommentIds: Array.from(commentIdsToDelete),
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
        const reactions = await getReactionsForComment(commentId);
        return [commentId, reactions];
      })
    );

    return json(200, {
      reactionsByCommentId: Object.fromEntries(entries),
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
    chapterThreads: sanitizeThreads(chapterThreads),
    lineThreadKeys,
  });
};

const handlePost = async (event) => {
  const request = parseJsonBody(event);
  if (!isPageLocationId(request?.pageLocationId) || !isThreadMutation(request?.mutation)) {
    return json(400, { error: 'Expected { pageLocationId, mutation } with a valid thread mutation.' });
  }

  const { mutation } = request;
  const invalidLengthError = getInvalidMutationLength(mutation);
  if (invalidLengthError) {
    return json(400, { error: invalidLengthError });
  }

  const authError = getMutationAuthError(mutation.mutationOwner);
  if (authError) {
    return json(401, { error: authError });
  }
  const mutationOwner = getVerifiedMutationOwner(mutation.mutationOwner);

  if (mutation.type === 'set-comment-reactions') {
    if (!mutationOwner || mutation.userName !== mutationOwner.userName) {
      return json(403, { error: 'Signed-in user is required to update reactions.' });
    }

    const reactions = await getReactionsForComment(mutation.commentId);
    const nextReactions = setUserReactionsForComment(reactions, mutationOwner.userName, mutation.emojis);
    await setReactionsForComment(mutation.commentId, nextReactions);

    return json(200, {
      type: 'comment-reactions-updated',
      commentId: mutation.commentId,
      reactions: nextReactions,
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
      commentsById: commentsWithOwner(mutation.commentsById, mutationOwner),
    };
    const threadKey = await setThread(nextThread);
    await setThreadKeysForPage(pageLocationId, [...threadKeys.filter((existingThreadKey) => existingThreadKey !== threadKey), threadKey]);

    const nextThreadKeys = await getThreadKeysForPage(pageLocationId);
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(nextThreadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads: sanitizeThreads(chapterThreads),
      lineThreadKeys,
    });
  }

  if (mutation.type === 'upsert-comment') {
    const entry = await findThreadEntryByCommentId(threadKeys, mutation.replyingTo);
    if (!entry) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    const result = upsertCommentInThread(entry.thread, mutation, mutationOwner);
    if (result.error) {
      return json(result.error.startsWith('Only') ? 403 : 404, { error: result.error });
    }

    await setThread(result.thread);
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(threadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads: sanitizeThreads(chapterThreads),
      lineThreadKeys,
    });
  }

  if (mutation.type === 'delete-comment') {
    const entry = await findThreadEntryByCommentId(threadKeys, mutation.commentId);
    if (!entry) {
      return json(404, { error: 'Could not find a matching thread/comment for this mutation.' });
    }

    const result = deleteCommentFromThread(entry.thread, mutation, mutationOwner);
    if (result.error) {
      return json(403, { error: result.error });
    }

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
    await Promise.all(result.deletedCommentIds.map((commentId) => deleteReactionsForComment(commentId)));
    const { chapterThreads, lineThreadKeys } = await splitThreadKeysByLocation(nextThreadKeys);
    return json(200, {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads: sanitizeThreads(chapterThreads),
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
