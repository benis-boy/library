import {
  Comment,
  CommentId,
  CommentReactions,
  MutationOwner,
  PageLocationId,
  Thread,
  ThreadLocationId,
  ThreadMutation,
  toThreadLocationKey,
} from './dataModel';

export type CommentsMutationResponse =
  | {
      type: 'threads-updated';
      pageLocationId: PageLocationId;
      chapterThreads: Thread[];
      lineThreadKeys: string[];
      commentCountsByThreadKey?: Record<string, number>;
      threads: Thread[];
    }
  | {
      type: 'comment-reactions-updated';
      commentId: CommentId;
      reactions: CommentReactions;
    };

type RawCommentsMutationResponse =
  | Omit<Extract<CommentsMutationResponse, { type: 'threads-updated' }>, 'threads'>
  | Extract<CommentsMutationResponse, { type: 'comment-reactions-updated' }>;

export type FetchPageThreadsResponse = {
  pageLocationId: PageLocationId;
  chapterThreads: Thread[];
  lineThreadKeys: string[];
  commentCountsByThreadKey?: Record<string, number>;
  threads: Thread[];
};

export type FetchThreadLocationThreadsResponse = {
  pageLocationId: PageLocationId;
  threads: Thread[];
};

type RawFetchPageThreadsResponse = Omit<FetchPageThreadsResponse, 'threads'>;

type FetchPageCommentSummaryResponse = {
  pageLocationId: PageLocationId;
  lineThreadKeys: string[];
  commentCountsByThreadKey?: Record<string, number>;
};

export type FetchCommentReactionsResponse = {
  reactionsByCommentId?: Record<CommentId, CommentReactions>;
  likedUserNamesByCommentId?: Record<CommentId, string[]>;
};

export type CommentReactionsForViewer = {
  reactionsByCommentId: Record<CommentId, CommentReactions>;
};

export type CommentReplyNotification = {
  id: string;
  type: 'comment-reply';
  createdAt: number;
  actorUserName: string | null;
  locationId: ThreadLocationId;
  parentCommentId: CommentId;
  replyCommentId: CommentId;
};

export type NotificationsSummaryResponse = {
  unreadCount: number;
  lastCheckedAt: number;
};

export type NotificationsListResponse = {
  items: CommentReplyNotification[];
  unreadCount: number;
  lastCheckedAt: number;
  nextCursor: number | null;
};

export type CommentsForLocationResponse = {
  commentsById: Record<CommentId, Comment | null>;
  threadExists: boolean;
};

const COMMENTS_FUNCTION_URL = 'https://mellow-kitsune-6578b2.netlify.app/.netlify/functions/comments';
const DEFAULT_REACTION_EMOJI = '❤️';

const normalizeCommentReactions = (value: unknown): CommentReactions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, userNames]) => Array.isArray(userNames))
      .map(([emoji, userNames]) => [emoji, (userNames as unknown[]).filter((userName): userName is string => typeof userName === 'string')])
      .filter(([, userNames]) => userNames.length > 0)
  );
};

const normalizeReactionsByCommentId = (commentIds: CommentId[], response: FetchCommentReactionsResponse) => {
  return Object.fromEntries(
    commentIds.map((commentId) => {
      const reactions = response.reactionsByCommentId?.[commentId];
      if (reactions) {
        return [commentId, normalizeCommentReactions(reactions)];
      }

      const legacyUserNames = response.likedUserNamesByCommentId?.[commentId];
      return [commentId, legacyUserNames?.length ? { [DEFAULT_REACTION_EMOJI]: legacyUserNames } : {}];
    })
  );
};

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Comments API failed with status ${response.status}.`;
    throw new Error(message);
  }

  return data as T;
};

const requireSignedOwner = (owner: MutationOwner): Exclude<MutationOwner, null> => {
  if (!owner) {
    throw new Error('Signed-in user is required.');
  }

  return owner;
};

const getNotificationHeaders = (owner: MutationOwner) => {
  const signedOwner = requireSignedOwner(owner);
  return {
    Authorization: `Bearer ${signedOwner.signedUser}`,
    'X-Comment-User-Name': signedOwner.userName,
    'X-Comment-User-Id': signedOwner.patreonUserId,
  };
};

export const fetchThreadsForPage = async (pageLocationId: PageLocationId) => {
  const searchParams = new URLSearchParams({
    bookId: pageLocationId.bookId,
    chapterId: pageLocationId.chapterId,
  });

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`);
  const data = await parseJsonResponse<RawFetchPageThreadsResponse>(response);
  return {
    ...data,
    threads: data.chapterThreads,
  };
};

export const fetchPageCommentSummary = async (pageLocationId: PageLocationId) => {
  const searchParams = new URLSearchParams({
    bookId: pageLocationId.bookId,
    chapterId: pageLocationId.chapterId,
    summary: '1',
  });

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`);
  const data = await parseJsonResponse<FetchPageCommentSummaryResponse>(response);
  return {
    pageLocationId: data.pageLocationId,
    lineThreadKeys: data.lineThreadKeys,
    commentCountsByThreadKey: data.commentCountsByThreadKey ?? {},
  };
};

export const fetchThreadsForLocation = async (locationId: ThreadLocationId): Promise<FetchThreadLocationThreadsResponse> => {
  const searchParams = new URLSearchParams({
    bookId: locationId.bookId,
    chapterId: locationId.chapterId,
  });

  if (locationId.paragraphLocation) {
    searchParams.set('paragraphLocation', JSON.stringify(locationId.paragraphLocation));
  }

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`);
  const data = await parseJsonResponse<FetchThreadLocationThreadsResponse>(response);
  return data;
};

export const fetchCommentReactions = async (commentIds: CommentId[]): Promise<CommentReactionsForViewer> => {
  const searchParams = new URLSearchParams({
    commentIds: commentIds.join(','),
  });

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`);
  const reactionResponse = await parseJsonResponse<FetchCommentReactionsResponse>(response);

  return {
    reactionsByCommentId: normalizeReactionsByCommentId(commentIds, reactionResponse),
  };
};

export const fetchNotificationSummary = async (owner: MutationOwner): Promise<NotificationsSummaryResponse> => {
  const searchParams = new URLSearchParams({ notifications: 'summary' });
  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`, {
    headers: getNotificationHeaders(owner),
  });

  return parseJsonResponse<NotificationsSummaryResponse>(response);
};

export const fetchNotifications = async (
  owner: MutationOwner,
  options: { before?: number; limit?: number } = {}
): Promise<NotificationsListResponse> => {
  const searchParams = new URLSearchParams({ notifications: 'list' });
  if (options.before !== undefined) {
    searchParams.set('before', String(options.before));
  }
  if (options.limit !== undefined) {
    searchParams.set('limit', String(options.limit));
  }

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`, {
    headers: getNotificationHeaders(owner),
  });

  return parseJsonResponse<NotificationsListResponse>(response);
};

export const markNotificationsChecked = async (owner: MutationOwner): Promise<NotificationsSummaryResponse> => {
  const response = await fetch(COMMENTS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationAction: 'mark-checked', mutationOwner: requireSignedOwner(owner) }),
  });

  return parseJsonResponse<NotificationsSummaryResponse>(response);
};

export const fetchCommentsForLocations = async (
  requests: { locationId: ThreadLocationId; commentIds: CommentId[] }[]
): Promise<Record<string, CommentsForLocationResponse>> => {
  const requestsByLocationKey = new Map<string, { locationId: ThreadLocationId; commentIds: Set<CommentId> }>();

  for (const request of requests) {
    const locationKey = toThreadLocationKey(request.locationId);
    const existing = requestsByLocationKey.get(locationKey);
    if (existing) {
      for (const commentId of request.commentIds) {
        existing.commentIds.add(commentId);
      }
      continue;
    }

    requestsByLocationKey.set(locationKey, {
      locationId: request.locationId,
      commentIds: new Set(request.commentIds),
    });
  }

  const entries = await Promise.all(
    Array.from(requestsByLocationKey.entries()).map(async ([locationKey, request]) => {
      const threadsResponse = request.locationId.paragraphLocation
        ? await fetchThreadsForLocation(request.locationId)
        : await fetchThreadsForPage(request.locationId);
      const commentsById: Record<CommentId, Comment | null> = {};

      for (const commentId of request.commentIds) {
        commentsById[commentId] = null;
      }

      for (const thread of threadsResponse.threads) {
        for (const commentId of request.commentIds) {
          if (commentsById[commentId] !== null) {
            continue;
          }

          commentsById[commentId] = thread.commentsById[commentId] ?? null;
        }
      }

      return [
        locationKey,
        {
          commentsById,
          threadExists: threadsResponse.threads.length > 0,
        },
      ] as const;
    })
  );

  return Object.fromEntries(entries);
};

export const sendThreadMutation = async (pageLocationId: PageLocationId, mutation: ThreadMutation, options?: { keepalive?: boolean }) => {
  const response = await fetch(COMMENTS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageLocationId, mutation }),
    keepalive: options?.keepalive,
  });

  const data = await parseJsonResponse<RawCommentsMutationResponse>(response);
  if (data.type !== 'threads-updated') {
    return data;
  }

  return {
    ...data,
    threads: data.chapterThreads,
  };
};
