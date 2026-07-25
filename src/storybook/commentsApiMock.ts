import type {
  Comment,
  CommentId,
  CommentReactions,
  MutationOwner,
  PageLocationId,
  Thread,
  ThreadLocationId,
  ThreadMutation,
} from '../comments/dataModel';
import { toPageLocationKey, toThreadLocationKey } from '../comments/dataModel';
import type {
  CommentNotification,
  CommentsForLocationResponse,
  NotificationsSummaryResponse,
} from '../comments/comments-api';

export type MockCommentsApiState = {
  notificationsBySignedUser: Record<string, CommentNotification[]>;
  summariesBySignedUser?: Record<string, NotificationsSummaryResponse>;
  threadsByLocationKey: Record<string, Thread[]>;
  reactionsByCommentId?: Record<CommentId, CommentReactions>;
  requestLog?: MockCommentsApiRequestLogEntry[];
};

export type MockCommentsApiRequestLogEntry =
  | { type: 'notifications-summary'; signedUser: string }
  | { type: 'notifications-list'; signedUser: string; limit: number; before: number | null }
  | { type: 'mark-notifications-checked'; signedUser: string }
  | { type: 'fetch-page-threads'; pageLocationId: PageLocationId }
  | { type: 'fetch-location-threads'; locationId: ThreadLocationId }
  | { type: 'fetch-reactions'; commentIds: CommentId[] }
  | { type: 'mutation'; pageLocationId: PageLocationId; mutation: ThreadMutation };

type FetchLike = typeof window.fetch;

const COMMENTS_FUNCTION_PATH = '/.netlify/functions/comments';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const getSignedUser = (request: Request) => {
  const authorization = request.headers.get('Authorization') || '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1] || 'storybook-signed-user';
};

const getNotifications = (state: MockCommentsApiState, signedUser: string) => {
  return [...(state.notificationsBySignedUser[signedUser] ?? [])].sort((left, right) => right.createdAt - left.createdAt);
};

const getSummary = (state: MockCommentsApiState, signedUser: string): NotificationsSummaryResponse => {
  const configured = state.summariesBySignedUser?.[signedUser];
  if (configured) {
    return configured;
  }

  return {
    unreadCount: getNotifications(state, signedUser).length,
    lastCheckedAt: 0,
  };
};

const findThreadContainingComment = (threads: Thread[], commentId: CommentId) => {
  return threads.find((thread) => Boolean(thread.commentsById[commentId]));
};

const cloneComment = (comment: Comment): Comment => ({
  ...comment,
  replyIds: [...comment.replyIds],
});

const cloneThread = (thread: Thread): Thread => ({
  ...thread,
  locationId: {
    ...thread.locationId,
    paragraphLocation: thread.locationId.paragraphLocation
      ? {
          ...thread.locationId.paragraphLocation,
          tertiaryKey: { ...thread.locationId.paragraphLocation.tertiaryKey },
        }
      : undefined,
  },
  commentsById: Object.fromEntries(
    Object.entries(thread.commentsById).map(([commentId, comment]) => [commentId, cloneComment(comment)])
  ) as Thread['commentsById'],
});

const getThreadsForPage = (state: MockCommentsApiState, pageLocationId: PageLocationId) => {
  const pageKey = toPageLocationKey(pageLocationId);
  return Object.values(state.threadsByLocationKey)
    .flatMap((threads) => threads)
    .filter((thread) => toPageLocationKey(thread.locationId) === pageKey && !thread.locationId.paragraphLocation)
    .map(cloneThread);
};

const getThreadsForLocation = (state: MockCommentsApiState, locationId: ThreadLocationId) => {
  return (state.threadsByLocationKey[toThreadLocationKey(locationId)] ?? []).map(cloneThread);
};

const getAllLocationKeysForPage = (state: MockCommentsApiState, pageLocationId: PageLocationId) => {
  const pageKey = toPageLocationKey(pageLocationId);
  return Object.keys(state.threadsByLocationKey).filter((locationKey) =>
    state.threadsByLocationKey[locationKey]?.some((thread) => toPageLocationKey(thread.locationId) === pageKey)
  );
};

const countThreadComments = (thread: Thread) => Object.keys(thread.commentsById).length;

const getPageResponse = (state: MockCommentsApiState, pageLocationId: PageLocationId) => {
  const chapterThreads = getThreadsForPage(state, pageLocationId);
  const lineThreadKeys = getAllLocationKeysForPage(state, pageLocationId)
    .filter((locationKey) => locationKey.includes(':paragraph:'))
    .flatMap((locationKey) =>
      (state.threadsByLocationKey[locationKey] ?? []).map((thread) => `${locationKey}:${thread.rootCommentId}`)
    );
  const commentCountsByThreadKey = Object.fromEntries(
    lineThreadKeys.map((threadKey) => {
      const locationKey = threadKey.split(':').slice(0, 4).join(':');
      const rootCommentId = threadKey.split(':').slice(4).join(':');
      const thread = (state.threadsByLocationKey[locationKey] ?? []).find((entry) => entry.rootCommentId === rootCommentId);
      return [threadKey, thread ? countThreadComments(thread) : 0];
    })
  );

  return {
    pageLocationId,
    chapterThreads,
    lineThreadKeys,
    commentCountsByThreadKey,
  };
};

const getLocationDetails = (
  state: MockCommentsApiState,
  requests: { locationId: ThreadLocationId; commentIds: CommentId[] }[]
) => {
  const responseEntries = requests.map((request) => {
    const threads = request.locationId.paragraphLocation
      ? getThreadsForLocation(state, request.locationId)
      : getThreadsForPage(state, request.locationId);
    const commentsById: Record<CommentId, Comment | null> = {};

    for (const commentId of request.commentIds) {
      const thread = findThreadContainingComment(threads, commentId);
      commentsById[commentId] = thread?.commentsById[commentId] ? cloneComment(thread.commentsById[commentId]) : null;
    }

    return [
      toThreadLocationKey(request.locationId),
      {
        commentsById,
        threadExists: threads.length > 0,
      } satisfies CommentsForLocationResponse,
    ] as const;
  });

  return Object.fromEntries(responseEntries);
};

const getReactions = (state: MockCommentsApiState, commentIds: CommentId[]) => ({
  reactionsByCommentId: Object.fromEntries(commentIds.map((commentId) => [commentId, state.reactionsByCommentId?.[commentId] ?? {}])),
});

const applyMutation = (state: MockCommentsApiState, pageLocationId: PageLocationId, mutation: ThreadMutation) => {
  if (mutation.type === 'start-thread') {
    const locationKey = toThreadLocationKey(mutation.locationId);
    const thread: Thread = {
      locationId: mutation.locationId,
      rootCommentId: mutation.rootCommentId,
      commentsById: mutation.commentsById as Thread['commentsById'],
    };
    state.threadsByLocationKey[locationKey] = [...(state.threadsByLocationKey[locationKey] ?? []), thread];
    return {
      ...getPageResponse(state, pageLocationId),
      chapterThreads: getThreadsForLocation(state, mutation.locationId),
    };
  }

  if (mutation.type === 'upsert-comment') {
    let updatedLocationId: ThreadLocationId | null = null;
    for (const threads of Object.values(state.threadsByLocationKey)) {
      const thread = findThreadContainingComment(threads, mutation.replyingTo);
      if (!thread) {
        continue;
      }

      const parent = thread.commentsById[mutation.replyingTo];
      thread.commentsById[mutation.commentId] = mutation.comment;
      if (mutation.commentId !== mutation.replyingTo && parent && !parent.replyIds.includes(mutation.commentId)) {
        parent.replyIds = [...parent.replyIds, mutation.commentId];
      }
      updatedLocationId = thread.locationId;
      break;
    }
    return {
      ...getPageResponse(state, pageLocationId),
      chapterThreads: updatedLocationId ? getThreadsForLocation(state, updatedLocationId) : getPageResponse(state, pageLocationId).chapterThreads,
    };
  }

  if (mutation.type === 'delete-comment') {
    let updatedLocationId: ThreadLocationId | null = null;
    for (const threads of Object.values(state.threadsByLocationKey)) {
      const thread = findThreadContainingComment(threads, mutation.commentId);
      if (!thread) {
        continue;
      }

      delete thread.commentsById[mutation.commentId];
      for (const comment of Object.values(thread.commentsById)) {
        comment.replyIds = comment.replyIds.filter((replyId) => replyId !== mutation.commentId);
      }
      updatedLocationId = thread.locationId;
      break;
    }
    return {
      ...getPageResponse(state, pageLocationId),
      chapterThreads: updatedLocationId ? getThreadsForLocation(state, updatedLocationId) : getPageResponse(state, pageLocationId).chapterThreads,
    };
  }

  const previousReactions = state.reactionsByCommentId?.[mutation.commentId] ?? {};
  const nextReactions: CommentReactions = {};
  for (const [emoji, userNames] of Object.entries(previousReactions)) {
    nextReactions[emoji] = userNames.filter((userName) => userName !== mutation.userName);
  }
  for (const emoji of mutation.emojis) {
    nextReactions[emoji] = [...(nextReactions[emoji] ?? []), mutation.userName];
  }
  state.reactionsByCommentId = {
    ...state.reactionsByCommentId,
    [mutation.commentId]: Object.fromEntries(Object.entries(nextReactions).filter(([, userNames]) => userNames.length > 0)),
  };
  return { type: 'comment-reactions-updated' as const, commentId: mutation.commentId, reactions: state.reactionsByCommentId[mutation.commentId] };
};

const parseMutationBody = async (request: Request) => {
  const body = await request.text();
  return body ? JSON.parse(body) : null;
};

export const installCommentsApiMock = (fetchImpl: FetchLike, state: MockCommentsApiState): (() => void) => {
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    if (!url.pathname.endsWith(COMMENTS_FUNCTION_PATH)) {
      return fetchImpl(input, init);
    }

    const log = state.requestLog ?? [];
    state.requestLog = log;

    if (request.method === 'POST') {
      const body = await parseMutationBody(request);
      if (body?.notificationAction === 'mark-checked') {
        const owner = body.mutationOwner as Exclude<MutationOwner, null>;
        log.push({ type: 'mark-notifications-checked', signedUser: owner.signedUser });
        const summary = { unreadCount: 0, lastCheckedAt: Date.now() };
        state.summariesBySignedUser = {
          ...state.summariesBySignedUser,
          [owner.signedUser]: summary,
        };
        return jsonResponse(summary);
      }

      const pageLocationId = body?.pageLocationId as PageLocationId;
      const mutation = body?.mutation as ThreadMutation;
      log.push({ type: 'mutation', pageLocationId, mutation });
      const result = applyMutation(state, pageLocationId, mutation);
      if ('type' in result) {
        return jsonResponse(result);
      }

      return jsonResponse({ type: 'threads-updated', ...result });
    }

    const searchParams = url.searchParams;
    if (searchParams.get('notifications') === 'summary') {
      const signedUser = getSignedUser(request);
      log.push({ type: 'notifications-summary', signedUser });
      return jsonResponse(getSummary(state, signedUser));
    }

    if (searchParams.get('notifications') === 'list') {
      const signedUser = getSignedUser(request);
      const limit = Number(searchParams.get('limit') ?? 5);
      const before = searchParams.has('before') ? Number(searchParams.get('before')) : null;
      const notifications = getNotifications(state, signedUser).filter((notification) => before === null || notification.createdAt < before);
      const page = notifications.slice(0, limit + 1);
      const items = page.slice(0, limit);
      const nextCursor = page.length > limit ? items[items.length - 1]?.createdAt ?? null : null;
      log.push({ type: 'notifications-list', signedUser, limit, before });
      return jsonResponse({
        items,
        unreadCount: getSummary(state, signedUser).unreadCount,
        lastCheckedAt: getSummary(state, signedUser).lastCheckedAt,
        nextCursor,
      });
    }

    if (searchParams.has('notificationDetails')) {
      const requests = JSON.parse(searchParams.get('notificationDetails') ?? '[]') as {
        locationId: ThreadLocationId;
        commentIds: CommentId[];
      }[];
      return jsonResponse(getLocationDetails(state, requests));
    }

    if (searchParams.has('commentIds')) {
      const commentIds = (searchParams.get('commentIds') || '').split(',').filter(Boolean) as CommentId[];
      log.push({ type: 'fetch-reactions', commentIds });
      return jsonResponse(getReactions(state, commentIds));
    }

    const bookId = searchParams.get('bookId') as PageLocationId['bookId'] | null;
    const chapterId = searchParams.get('chapterId');
    if (bookId && chapterId) {
      if (searchParams.has('paragraphLocation')) {
        const locationId = {
          bookId,
          chapterId,
          paragraphLocation: JSON.parse(searchParams.get('paragraphLocation') || 'null'),
        } as ThreadLocationId;
        log.push({ type: 'fetch-location-threads', locationId });
        return jsonResponse({ pageLocationId: { bookId, chapterId }, threads: getThreadsForLocation(state, locationId) });
      }

      const pageLocationId = { bookId, chapterId };
      log.push({ type: 'fetch-page-threads', pageLocationId });
      return jsonResponse(getPageResponse(state, pageLocationId));
    }

    return jsonResponse({ error: 'Unhandled Storybook comments mock request.' });
  };

  return () => {
    window.fetch = fetchImpl;
  };
};
