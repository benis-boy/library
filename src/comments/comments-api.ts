import { CommentId, CommentLikedUserNames, PageLocationId, Thread, ThreadMutation } from './dataModel';

export type CommentsMutationResponse =
  | {
      type: 'threads-updated';
      pageLocationId: PageLocationId;
      chapterThreads: Thread[];
      lineThreadKeys: string[];
      threads: Thread[];
    }
  | {
      type: 'comment-liked-users-updated';
      commentId: CommentId;
      likedUserNames: CommentLikedUserNames;
      likeCount: number;
    };

type RawCommentsMutationResponse =
  | Omit<Extract<CommentsMutationResponse, { type: 'threads-updated' }>, 'threads'>
  | Extract<CommentsMutationResponse, { type: 'comment-liked-users-updated' }>;

export type FetchPageThreadsResponse = {
  pageLocationId: PageLocationId;
  chapterThreads: Thread[];
  lineThreadKeys: string[];
  threads: Thread[];
};

type RawFetchPageThreadsResponse = Omit<FetchPageThreadsResponse, 'threads'>;

export type FetchCommentLikedUserNamesResponse = {
  likedUserNamesByCommentId: Record<CommentId, CommentLikedUserNames>;
};

export type CommentLikesForViewer = {
  likedUserNamesByCommentId: Record<CommentId, CommentLikedUserNames>;
  likeCountsByCommentId: Record<CommentId, number>;
  commentsLikedByUser: CommentId[];
  commentsLikedByUserSet: Set<CommentId>;
};

const COMMENTS_FUNCTION_URL = 'https://mellow-kitsune-6578b2.netlify.app/.netlify/functions/comments';

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

export const fetchCommentLikedUserNames = async (commentIds: CommentId[], signedInUserName?: string | null): Promise<CommentLikesForViewer> => {
  const searchParams = new URLSearchParams({
    commentIds: commentIds.join(','),
  });

  const response = await fetch(`${COMMENTS_FUNCTION_URL}?${searchParams.toString()}`);
  const likedUserNamesResponse = await parseJsonResponse<FetchCommentLikedUserNamesResponse>(response);
  const likedUserNamesByCommentId = likedUserNamesResponse.likedUserNamesByCommentId;
  const commentsLikedByUser = signedInUserName
    ? commentIds.filter((commentId) => likedUserNamesByCommentId[commentId]?.includes(signedInUserName))
    : [];

  return {
    likedUserNamesByCommentId,
    likeCountsByCommentId: Object.fromEntries(
      Object.entries(likedUserNamesByCommentId).map(([commentId, likedUserNames]) => [commentId, likedUserNames.length])
    ),
    commentsLikedByUser,
    commentsLikedByUserSet: new Set(commentsLikedByUser),
  };
};

export const sendThreadMutation = async (pageLocationId: PageLocationId, mutation: ThreadMutation) => {
  const response = await fetch(COMMENTS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageLocationId, mutation }),
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
