import { SourceType } from '../constants';
import { ParagraphLocation } from './paragraph-comments/paragraph-locator';

export type TimestampMs = number;
export type ChapterId = string;
export type CommentId = string;

export type PageLocationId = {
  bookId: SourceType;
  chapterId: ChapterId;
};

export type ThreadLocationId = PageLocationId & {
  paragraphLocation?: ParagraphLocation;
};

export const CHAPTER_COMMENT_LINE_TOKEN = 'chapter' as const;
export type ThreadLocationKey = `${SourceType}:${ChapterId}:${string}`;
export type PageLocationKey = `${SourceType}:${ChapterId}`;

export type Comment = {
  timestamp: TimestampMs;
  userName: string | null;
  text: string;
  imageUrl: string | null;
  replyIds: CommentId[];
  updated?: boolean;
  mutationOwner?: MutationOwner;
};

export const COMMENT_TEXT_MAX_LENGTH = 2000;
export const COMMENT_MEDIA_URL_MAX_LENGTH = 2048;

export type MutationOwner = {
  userName: string;
  signedUser: string;
} | null;

export type Thread<RootCommentId extends CommentId = CommentId> = {
  locationId: ThreadLocationId;
  rootCommentId: RootCommentId;
  commentsById: Record<CommentId, Comment> & Record<RootCommentId, Comment>;
};

export type CommentsState = {
  threadByLocation: Record<ThreadLocationKey, Thread[]>;
};

export type CommentReactionUserNames = string[];
export type CommentReactions = Record<string, CommentReactionUserNames>;

export type ThreadMutation =
  | {
      type: 'start-thread';
      mutationOwner: MutationOwner;
      locationId: ThreadLocationId;
      rootCommentId: CommentId;
      commentsById: Record<CommentId, Comment>; // minimum 1
    }
  | {
      type: 'upsert-comment';
      mutationOwner: MutationOwner;
      commentId: CommentId;
      comment: Comment;
      replyingTo: CommentId;
    }
  | {
      type: 'delete-comment';
      mutationOwner: MutationOwner;
      commentId: CommentId;
      wasReplyingTo: CommentId;
    }
  | {
      type: 'set-comment-reactions';
      mutationOwner: MutationOwner;
      commentId: CommentId;
      emojis: string[];
      userName: string;
    };

export const ANONYMOUS_USER_NAME = 'Anonymous';

export const getCommentUserName = (userName: string | null) => {
  return userName ?? ANONYMOUS_USER_NAME;
};

export const isChapterCommentThread = (locationId: ThreadLocationId) => {
  return locationId.paragraphLocation === undefined;
};

export const toPageLocationId = (locationId: ThreadLocationId): PageLocationId => {
  return {
    bookId: locationId.bookId,
    chapterId: locationId.chapterId,
  };
};

export const toPageLocationKey = (locationId: PageLocationId): PageLocationKey => {
  return `${locationId.bookId}:${locationId.chapterId}`;
};

export const toThreadLocationKey = (locationId: ThreadLocationId): ThreadLocationKey => {
  const linePart = locationId.paragraphLocation ? `paragraph:${locationId.paragraphLocation.paragraphIndex}` : CHAPTER_COMMENT_LINE_TOKEN;

  return `${locationId.bookId}:${locationId.chapterId}:${linePart}`;
};
