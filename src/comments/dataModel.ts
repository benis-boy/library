import { SourceType } from '../constants';

export type TimestampMs = number;
export type ChapterId = string;
export type CommentId = string;

export type ThreadLocationId = {
  bookId: SourceType;
  chapterId: ChapterId;
  lineNumber?: number;
};

export const CHAPTER_COMMENT_LINE_TOKEN = 'chapter' as const;
export type ThreadLocationKey = `${SourceType}:${ChapterId}:${number | typeof CHAPTER_COMMENT_LINE_TOKEN}`;

export type Comment = {
  timestamp: TimestampMs;
  userName: string | null;
  text: string;
  imageUrl: string | null;
  replyIds: CommentId[];
  likeCount: number;
};

export type Thread<RootCommentId extends CommentId = CommentId> = {
  locationId: ThreadLocationId;
  rootCommentId: RootCommentId;
  commentsById: Record<CommentId, Comment> & Record<RootCommentId, Comment>;
};

export type CommentsState = {
  threadByLocation: Record<ThreadLocationKey, Thread[]>;
};

export const BACKEND_THREAD_MUTATION_BUFFER_MS = 60_000;

export type ThreadMutation =
  | {
      type: 'start-thread';
      locationId: ThreadLocationId;
      rootCommentId: CommentId;
      commentsById: Record<CommentId, Comment>; // minimum 1
    }
  | {
      type: 'upsert-comment';
      commentId: CommentId;
      comment: Comment;
      replyingTo: CommentId;
    }
  | {
      type: 'delete-comment';
      commentId: CommentId;
      wasReplyingTo: CommentId;
    }
  | {
      type: 'increment-comment-like-count';
      commentId: CommentId;
    }
  | {
      type: 'revert-increment-comment-like-count';
      commentId: CommentId;
    };

export const ANONYMOUS_USER_NAME = 'Anonymous';

export const getCommentUserName = (userName: string | null) => {
  return userName ?? ANONYMOUS_USER_NAME;
};

export const isChapterCommentThread = (locationId: ThreadLocationId) => {
  return locationId.lineNumber === undefined;
};

export const toThreadLocationKey = (locationId: ThreadLocationId): ThreadLocationKey => {
  const linePart = typeof locationId.lineNumber === 'number' ? locationId.lineNumber : CHAPTER_COMMENT_LINE_TOKEN;

  return `${locationId.bookId}:${locationId.chapterId}:${linePart}`;
};
