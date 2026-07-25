const crypto = require('crypto');

const COMMENT_KEY_PREFIX = `comments:v1`;
const NOTIFICATION_KEY_PREFIX = `notifications:v1`;
const DEFAULT_REACTION_EMOJI = '❤️';
const COMMENT_TEXT_MAX_LENGTH = 2000;
const COMMENT_MEDIA_URL_MAX_LENGTH = 2048;
const DEFAULT_NOTIFICATION_LIMIT = 5;
const MAX_NOTIFICATION_LIMIT = 20;
const NOTIFICATION_CLEANUP_KEEP_NEWEST = 10;
const NOTIFICATION_CLEANUP_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Comment-User-Name',
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

const redisIncrementBy = async (key, increment) => {
  return redisCommand(['INCRBY', key, increment]);
};

const redisSetAdd = async (key, member) => {
  await redisCommand(['SADD', key, member]);
};

const redisSetMembers = async (key) => {
  const value = await redisCommand(['SMEMBERS', key]);
  return Array.isArray(value) ? value.filter((member) => typeof member === 'string') : [];
};

const toPageLocationKey = (locationId) => `${locationId.bookId}:${locationId.chapterId}`;

const toPageThreadKeysRedisKey = (locationId) => `${COMMENT_KEY_PREFIX}:page:${toPageLocationKey(locationId)}:thread-keys`;

const toThreadLocationKey = (locationId) => {
  const linePart = locationId.paragraphLocation ? `paragraph:${locationId.paragraphLocation.paragraphIndex}` : 'chapter';
  return `${locationId.bookId}:${locationId.chapterId}:${linePart}`;
};

const toThreadRedisKey = (thread) => {
  return `${COMMENT_KEY_PREFIX}:thread:${toThreadLocationKey(thread.locationId)}:${thread.rootCommentId}`;
};

const toThreadCommentCountRedisKey = (threadKey) => `${threadKey}:comment-count`;

const toCommentReactionsRedisKey = (commentId) => `${COMMENT_KEY_PREFIX}:comment:${commentId}:likes`;

const toUserNotificationsRedisKey = (signedUser) => `${NOTIFICATION_KEY_PREFIX}:user:${signedUser}:items`;

const toUserNotificationsLastCheckedRedisKey = (signedUser) => `${NOTIFICATION_KEY_PREFIX}:user:${signedUser}:last-checked-at`;

const toNotificationUsersRedisKey = () => `${NOTIFICATION_KEY_PREFIX}:users`;

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

const getBearerToken = (authorization) => {
  if (typeof authorization !== 'string') {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getNotificationAuth = (event) => {
  const headerUserName = event.headers?.['x-comment-user-name'] ?? event.headers?.['X-Comment-User-Name'];
  const authorization = event.headers?.authorization ?? event.headers?.Authorization;
  const signedUser = getBearerToken(authorization);

  if (typeof headerUserName !== 'string' || headerUserName.length === 0 || !signedUser) {
    return null;
  }

  const mutationOwner = { userName: headerUserName, signedUser };
  return isVerifiedMutationOwner(mutationOwner) ? mutationOwner : null;
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

const isParagraphLocation = (value) => {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.bookId === 'string' &&
    value.bookId.length > 0 &&
    typeof value.chapterId === 'string' &&
    value.chapterId.length > 0 &&
    typeof value.paragraphIndex === 'number' &&
    Number.isInteger(value.paragraphIndex) &&
    value.paragraphIndex >= 0 &&
    typeof value.secondaryKey === 'string' &&
    value.secondaryKey.length > 0 &&
    typeof value.tertiaryKey?.prev === 'string' &&
    typeof value.tertiaryKey?.next === 'string'
  );
};

const parseParagraphLocationQuery = (value) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isParagraphLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isThreadLocationId = (value) => {
  return isPageLocationId(value) && (value.paragraphLocation === undefined || isParagraphLocation(value.paragraphLocation));
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

const countThreadComments = (thread) => Object.keys(thread.commentsById ?? {}).length;

const getThreadCommentCount = async (threadKey) => {
  const value = await redisGet(toThreadCommentCountRedisKey(threadKey));
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};

const setThreadCommentCount = async (threadKey, count) => {
  await redisSet(toThreadCommentCountRedisKey(threadKey), Math.max(0, count));
};

const incrementThreadCommentCount = async (threadKey, increment) => {
  await redisIncrementBy(toThreadCommentCountRedisKey(threadKey), increment);
};

const deleteThreadCommentCount = async (threadKey) => {
  await redisDelete(toThreadCommentCountRedisKey(threadKey));
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

const isChapterThread = (thread) => thread.locationId?.paragraphLocation === undefined;

const splitThreadKeysByLocation = async (threadKeys, options = {}) => {
  const { includeChapterThreads = true } = options;
  const chapterThreads = [];
  const lineThreadKeys = [];
  const commentCountsByThreadKey = {};

  await Promise.all(
    threadKeys.map(async (threadKey) => {
      if (!threadKey.includes(':paragraph:')) {
        if (!includeChapterThreads) {
          return;
        }

        const thread = await getThreadByKey(threadKey);
        if (thread && isChapterThread(thread)) {
          chapterThreads.push(thread);
        }
        return;
      }

      lineThreadKeys.push(threadKey);
      const persistedCount = await getThreadCommentCount(threadKey);
      if (persistedCount !== null) {
        commentCountsByThreadKey[threadKey] = persistedCount;
        return;
      }

      const thread = await getThreadByKey(threadKey);
      if (!thread) {
        commentCountsByThreadKey[threadKey] = 0;
        return;
      }

      const count = countThreadComments(thread);
      commentCountsByThreadKey[threadKey] = count;
      await setThreadCommentCount(threadKey, count);
    })
  );

  return { chapterThreads, lineThreadKeys, commentCountsByThreadKey };
};

const getThreadsForLocation = async (threadKeys, locationId) => {
  const targetLocationKey = toThreadLocationKey(locationId);
  const targetThreadKeys = threadKeys.filter((threadKey) => threadKey.includes(`:thread:${targetLocationKey}:`));
  return getThreadsByKeys(targetThreadKeys);
};

const parseNotification = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed?.type === 'comment-reply' && typeof parsed.createdAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const getNotificationLastCheckedAt = async (signedUser) => {
  const value = await redisGet(toUserNotificationsLastCheckedRedisKey(signedUser));
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const getNotificationUnreadCount = async (signedUser, lastCheckedAt) => {
  const count = await redisCommand(['ZCOUNT', toUserNotificationsRedisKey(signedUser), `(${lastCheckedAt}`, '+inf']);
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
};

const getNotificationSummary = async (signedUser) => {
  const lastCheckedAt = await getNotificationLastCheckedAt(signedUser);
  const unreadCount = await getNotificationUnreadCount(signedUser, lastCheckedAt);
  return { unreadCount, lastCheckedAt };
};

const getNotificationsList = async (signedUser, options = {}) => {
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_NOTIFICATION_LIMIT, 1), MAX_NOTIFICATION_LIMIT);
  const before = Number(options.before);
  const maxScore = Number.isFinite(before) && before > 0 ? `(${before}` : '+inf';
  const rawItems = await redisCommand(['ZREVRANGEBYSCORE', toUserNotificationsRedisKey(signedUser), maxScore, '-inf', 'LIMIT', 0, limit + 1]);
  const parsedItems = (Array.isArray(rawItems) ? rawItems : []).map(parseNotification).filter((item) => item !== null);
  const items = parsedItems.slice(0, limit);
  const summary = await getNotificationSummary(signedUser);

  return {
    items,
    ...summary,
    nextCursor: parsedItems.length > limit && items.length > 0 ? items[items.length - 1].createdAt : null,
  };
};

const createNotificationId = (createdAt) => `notification-${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const storeReplyNotification = async ({ recipientOwner, actorOwner, locationId, parentCommentId, replyCommentId }) => {
  const createdAt = Date.now();
  const notification = {
    id: createNotificationId(createdAt),
    type: 'comment-reply',
    createdAt,
    actorUserName: actorOwner?.userName ?? null,
    locationId,
    parentCommentId,
    replyCommentId,
  };

  await redisCommand(['ZADD', toUserNotificationsRedisKey(recipientOwner.signedUser), createdAt, JSON.stringify(notification)]);
  await redisSetAdd(toNotificationUsersRedisKey(), recipientOwner.signedUser);
};

const maybeCreateReplyNotification = async ({ wasNewComment, previousThread, mutation, mutationOwner }) => {
  if (!wasNewComment) {
    return;
  }

  const parentComment = previousThread.commentsById?.[mutation.replyingTo];
  const parentOwner = parentComment?.mutationOwner ?? null;
  if (!parentComment || !parentOwner || !isVerifiedMutationOwner(parentOwner) || doMutationOwnersMatch(parentOwner, mutationOwner)) {
    return;
  }

  await storeReplyNotification({
    recipientOwner: parentOwner,
    actorOwner: mutationOwner,
    locationId: previousThread.locationId,
    parentCommentId: mutation.replyingTo,
    replyCommentId: mutation.commentId,
  });
};

const cleanupNotifications = async () => {
  const signedUsers = await redisSetMembers(toNotificationUsersRedisKey());
  const cutoff = Date.now() - NOTIFICATION_CLEANUP_MAX_AGE_MS;
  let deletedNotifications = 0;

  await Promise.all(
    signedUsers.map(async (signedUser) => {
      const inboxKey = toUserNotificationsRedisKey(signedUser);
      const rawOldItems = await redisCommand(['ZRANGEBYSCORE', inboxKey, '-inf', `(${cutoff}`]);
      const rawNewestItems = await redisCommand(['ZREVRANGE', inboxKey, 0, NOTIFICATION_CLEANUP_KEEP_NEWEST - 1]);
      const keepNewest = new Set(Array.isArray(rawNewestItems) ? rawNewestItems : []);
      const staleItems = (Array.isArray(rawOldItems) ? rawOldItems : []).filter((item) => !keepNewest.has(item));
      if (staleItems.length === 0) {
        return;
      }

      deletedNotifications += await redisCommand(['ZREM', inboxKey, ...staleItems]);
    })
  );

  return {
    scannedUsers: signedUsers.length,
    deletedNotifications,
  };
};

const getThreadsUpdatedResponse = async (pageLocationId, threadKeys, locationId) => {
  if (locationId?.paragraphLocation) {
    return {
      type: 'threads-updated',
      pageLocationId,
      chapterThreads: sanitizeThreads(await getThreadsForLocation(threadKeys, locationId)),
      lineThreadKeys: [],
      commentCountsByThreadKey: {},
    };
  }

  const { chapterThreads, lineThreadKeys, commentCountsByThreadKey } = await splitThreadKeysByLocation(threadKeys);
  return {
    type: 'threads-updated',
    pageLocationId,
    chapterThreads: sanitizeThreads(chapterThreads),
    lineThreadKeys,
    commentCountsByThreadKey,
  };
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

  if (query.notifications === 'summary' || query.notifications === 'list') {
    const owner = getNotificationAuth(event);
    if (!owner) {
      return json(401, { error: 'Invalid notification auth.' });
    }

    if (query.notifications === 'summary') {
      return json(200, await getNotificationSummary(owner.signedUser));
    }

    return json(
      200,
      await getNotificationsList(owner.signedUser, {
        before: query.before,
        limit: query.limit,
      })
    );
  }

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
  const paragraphLocation = parseParagraphLocationQuery(query.paragraphLocation);
  if (query.paragraphLocation && !paragraphLocation) {
    return json(400, { error: 'Invalid paragraphLocation.' });
  }

  if (paragraphLocation) {
    const threads = await getThreadsForLocation(threadKeys, { ...pageLocationId, paragraphLocation });

    return json(200, {
      pageLocationId,
      threads: sanitizeThreads(threads),
    });
  }

  const isSummaryRequest = query.summary === '1';
  const { chapterThreads, lineThreadKeys, commentCountsByThreadKey } = await splitThreadKeysByLocation(threadKeys, {
    includeChapterThreads: !isSummaryRequest,
  });

  if (isSummaryRequest) {
    return json(200, {
      pageLocationId,
      lineThreadKeys,
      commentCountsByThreadKey,
    });
  }

  return json(200, {
    pageLocationId,
    chapterThreads: sanitizeThreads(chapterThreads),
    lineThreadKeys,
    commentCountsByThreadKey,
  });
};

const handlePost = async (event) => {
  const request = parseJsonBody(event);

  if (request?.notificationAction === 'mark-checked') {
    if (!isMutationOwner(request.mutationOwner)) {
      return json(400, { error: 'Expected a valid mutationOwner.' });
    }

    const mutationOwner = getVerifiedMutationOwner(request.mutationOwner);
    if (!mutationOwner) {
      return json(401, { error: 'Invalid comment user signature.' });
    }

    const lastCheckedAt = Date.now();
    await redisSet(toUserNotificationsLastCheckedRedisKey(mutationOwner.signedUser), lastCheckedAt);
    return json(200, {
      lastCheckedAt,
      unreadCount: await getNotificationUnreadCount(mutationOwner.signedUser, lastCheckedAt),
    });
  }

  if (request?.notificationAction === 'cleanup') {
    if (!process.env.NOTIFICATIONS_ADMIN_SECRET || request.adminSecret !== process.env.NOTIFICATIONS_ADMIN_SECRET) {
      return json(403, { error: 'Invalid notification cleanup secret.' });
    }

    return json(200, await cleanupNotifications());
  }

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
    await setThreadCommentCount(threadKey, countThreadComments(nextThread));
    await setThreadKeysForPage(pageLocationId, [...threadKeys.filter((existingThreadKey) => existingThreadKey !== threadKey), threadKey]);

    const nextThreadKeys = await getThreadKeysForPage(pageLocationId);
    return json(200, await getThreadsUpdatedResponse(pageLocationId, nextThreadKeys, mutation.locationId));
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

    const wasNewComment = !includesComment(entry.thread, mutation.commentId);
    await setThread(result.thread);
    if (wasNewComment) {
      await incrementThreadCommentCount(entry.threadKey, 1);
      await maybeCreateReplyNotification({ wasNewComment, previousThread: entry.thread, mutation, mutationOwner }).catch((error) => {
        console.error('Failed to create reply notification:', error);
      });
    }
    return json(200, await getThreadsUpdatedResponse(pageLocationId, threadKeys, entry.thread.locationId));
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
      await setThreadCommentCount(entry.threadKey, countThreadComments(result.thread));
      nextThreadKeys.push(entry.threadKey);
    } else {
      await deleteThread(entry.threadKey);
      await deleteThreadCommentCount(entry.threadKey);
    }

    await setThreadKeysForPage(pageLocationId, nextThreadKeys);
    await Promise.all(result.deletedCommentIds.map((commentId) => deleteReactionsForComment(commentId)));
    return json(200, await getThreadsUpdatedResponse(pageLocationId, nextThreadKeys, entry.thread.locationId));
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
