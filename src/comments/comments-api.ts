import { CommentId, CommentReactions, PageLocationId, Thread, ThreadMutation } from './dataModel';

export type CommentsMutationResponse =
  | {
      type: 'threads-updated';
      pageLocationId: PageLocationId;
      chapterThreads: Thread[];
      lineThreadKeys: string[];
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
  threads: Thread[];
};

type RawFetchPageThreadsResponse = Omit<FetchPageThreadsResponse, 'threads'>;

export type FetchCommentReactionsResponse = {
  reactionsByCommentId?: Record<CommentId, CommentReactions>;
  likedUserNamesByCommentId?: Record<CommentId, string[]>;
};

export type CommentReactionsForViewer = {
  reactionsByCommentId: Record<CommentId, CommentReactions>;
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
