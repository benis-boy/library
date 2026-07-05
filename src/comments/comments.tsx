import { ReactNode, useMemo } from 'react';
import {
  Comment as CommentModel,
  CommentId,
  TimestampMs,
  getCommentUserName,
  Thread as ThreadModel,
} from './dataModel';
import { ThreadGraphIssue, buildThreadGraph, getOrphanRootCommentIds } from './graph-utils';
import heartEmptyUrl from './heart_empty.svg';
import heartFilledUrl from './heart_filled.svg';

type ReplyAction = {
  replyToCommentId: CommentId;
};

type ToggleLikeAction = {
  commentId: CommentId;
  shouldLike: boolean;
};

type CommentEditAction = {
  commentId: CommentId;
};

type CommentSlotRender = (commentId: CommentId) => ReactNode;

export type CommentProps = {
  commentId: CommentId;
  comment: CommentModel;
  likeCount: number;
  highlighted?: boolean;
  isDisconnected?: boolean;
  likedByViewer?: boolean;
  actionsDisabled?: boolean;
  formatTimestamp?: (timestamp: TimestampMs) => string;
  resolveUserName?: (userName: string | null) => string;
  onReply?: (action: ReplyAction) => void;
  onToggleLike?: (action: ToggleLikeAction) => void;
  onEdit?: (action: CommentEditAction) => void;
  onDelete?: (action: CommentEditAction) => void;
};

const DEFAULT_MAX_DEPTH_INDENT = 8;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const formatRelativeTimestamp = (timestamp: TimestampMs, now: TimestampMs = Date.now()) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const elapsedMs = Math.max(0, now - timestamp);

  if (elapsedMs < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(elapsedMs / MINUTE_MS));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (elapsedMs < DAY_MS) {
    const hours = Math.floor(elapsedMs / HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (elapsedMs < WEEK_MS) {
    const days = Math.floor(elapsedMs / DAY_MS);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (elapsedMs <= 4 * WEEK_MS) {
    const weeks = Math.max(1, Math.floor(elapsedMs / WEEK_MS));
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  if (elapsedMs <= YEAR_MS) {
    const months = Math.max(1, Math.floor(elapsedMs / MONTH_MS));
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.max(1, Math.floor(elapsedMs / YEAR_MS));
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

const toDateTimeAttribute = (timestamp: TimestampMs) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const Comment = ({
  commentId,
  comment,
  likeCount,
  highlighted = false,
  isDisconnected = false,
  likedByViewer = false,
  actionsDisabled = false,
  formatTimestamp = formatRelativeTimestamp,
  resolveUserName = getCommentUserName,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
}: CommentProps) => {
  const displayUserName = resolveUserName(comment.userName);
  const timestampLabel = formatTimestamp(comment.timestamp);
  const dateTime = toDateTimeAttribute(comment.timestamp);
  const attachmentUrl = comment.imageUrl?.trim() || null;
  const likeButtonLabel = likedByViewer ? 'Unlike comment' : 'Like comment';

  return (
    <article
      className={`rounded-2xl border p-3 shadow-sm transition-colors ${
        highlighted
          ? 'border-sky-300 bg-sky-50 shadow-sky-100'
          : isDisconnected
            ? 'border-orange-300 bg-orange-50'
            : 'border-slate-200 bg-white'
      }`}
      data-comment-id={commentId}
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-slate-900">{displayUserName}</strong>
          <span aria-hidden="true">-</span>
          <time dateTime={dateTime} title={dateTime ? new Date(comment.timestamp).toLocaleString() : undefined}>
            {timestampLabel}
          </time>
        </div>
        {onEdit || onDelete ? (
          <details className="relative">
            <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <span aria-label="Comment actions">...</span>
            </summary>
            <div className="absolute right-0 z-10 mt-1 min-w-28 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit({ commentId })}
                  disabled={actionsDisabled}
                  className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete({ commentId })}
                  disabled={actionsDisabled}
                  className="block w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </header>

      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">{comment.text}</p>

      {attachmentUrl ? (
        <a href={attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 block w-fit">
          <img
            src={attachmentUrl}
            alt={`Attachment for comment ${commentId}`}
            loading="lazy"
            className="max-h-72 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
          />
        </a>
      ) : null}

      <footer className="mt-3 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onReply?.({ replyToCommentId: commentId })}
          disabled={actionsDisabled || !onReply}
          className="rounded-full px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reply
        </button>
        <button
          type="button"
          aria-label={likeButtonLabel}
          onClick={() => onToggleLike?.({ commentId, shouldLike: !likedByViewer })}
          disabled={actionsDisabled || !onToggleLike}
          className="group relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-rose-50 active:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="absolute h-8 w-8 rounded-full bg-rose-300 opacity-0 group-active:animate-ping group-active:opacity-30" aria-hidden="true" />
          <img
            src={likedByViewer ? heartFilledUrl : heartEmptyUrl}
            alt=""
            className="relative h-4 w-4 transition-transform duration-150 group-active:scale-125"
            aria-hidden="true"
          />
        </button>
        <span className="text-slate-500" aria-label={`Like count ${likeCount}`}>
          {likeCount} like{likeCount === 1 ? '' : 's'}
        </span>
      </footer>
    </article>
  );
};

export type ThreadProps = {
  thread: ThreadModel;
  className?: string;
  signedInUserName?: string | null;
  likeCountsByCommentId?: Partial<Record<CommentId, number>>;
  commentsLikedByUser?: ReadonlySet<CommentId>;
  showDiagnostics?: boolean;
  actionsDisabled?: boolean;
  maxDepthIndent?: number;
  formatTimestamp?: (timestamp: TimestampMs) => string;
  resolveUserName?: (userName: string | null) => string;
  onReply?: (action: ReplyAction) => void;
  onToggleLike?: (action: ToggleLikeAction) => void;
  onEdit?: (action: CommentEditAction) => void;
  onDelete?: (action: CommentEditAction) => void;
  renderAfterComment?: CommentSlotRender;
  emptyState?: ReactNode;
};

const describeIssue = (issue: ThreadGraphIssue): string => {
  switch (issue.type) {
    case 'missing-root-comment':
      return `Root comment is missing: ${issue.rootCommentId}`;
    case 'missing-reply-target':
      return `Missing reply target ${issue.replyId} from ${issue.commentId}`;
    case 'self-reply':
      return `Self-reply detected at ${issue.commentId}`;
    case 'multi-parent-comment':
      return `Comment ${issue.commentId} has multiple parents: ${issue.parentIds.join(', ')}`;
    case 'cycle-edge':
      return `Cycle edge detected: ${issue.fromCommentId} -> ${issue.toCommentId}`;
    case 'orphan-comment':
      return `Orphan comment not reachable from root: ${issue.commentId}`;
    default:
      return 'Unknown graph issue';
  }
};

export const Thread = ({
  thread,
  className,
  signedInUserName,
  likeCountsByCommentId = {},
  commentsLikedByUser,
  showDiagnostics = false,
  actionsDisabled = false,
  maxDepthIndent = DEFAULT_MAX_DEPTH_INDENT,
  formatTimestamp,
  resolveUserName,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
  renderAfterComment,
  emptyState,
}: ThreadProps) => {
  const graph = useMemo(() => buildThreadGraph(thread), [thread]);
  const disconnectedRootIds = useMemo(() => getOrphanRootCommentIds(graph), [graph]);
  const hasRoot = Boolean(thread.commentsById[thread.rootCommentId]);

  const renderCommentSubtree = (
    commentId: CommentId,
    depth: number,
    isDisconnected: boolean,
    branch: Set<CommentId>
  ): ReactNode => {
    if (branch.has(commentId)) {
      return (
        <div key={`cycle-${commentId}`} className="ml-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          Cycle stopped while rendering branch at {commentId}
        </div>
      );
    }

    const comment = thread.commentsById[commentId];
    if (!comment) {
      return (
        <div key={`missing-${commentId}`} className="ml-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Missing comment payload for {commentId}
        </div>
      );
    }

    const childIds = graph.treeChildIdsById.get(commentId) ?? [];
    const nextBranch = new Set(branch);
    nextBranch.add(commentId);
    const shouldHighlight = Boolean(signedInUserName && comment.userName === signedInUserName);
    const canEdit = Boolean(signedInUserName && comment.userName === signedInUserName);
    const canDelete = canEdit || signedInUserName === 'B. Warnecke';
    const likeCount = likeCountsByCommentId[commentId] ?? 0;
    const likedByViewer = commentsLikedByUser?.has(commentId) ?? false;

    return (
      <div key={commentId} className="space-y-3">
        <Comment
          commentId={commentId}
          comment={comment}
          likeCount={likeCount}
          highlighted={shouldHighlight}
          isDisconnected={isDisconnected}
          likedByViewer={likedByViewer}
          actionsDisabled={actionsDisabled}
          formatTimestamp={formatTimestamp}
          resolveUserName={resolveUserName}
          onReply={onReply}
          onToggleLike={onToggleLike}
          onEdit={canEdit ? onEdit : undefined}
          onDelete={canDelete ? onDelete : undefined}
        />
        {renderAfterComment?.(commentId)}
        {childIds.length > 0 ? (
          <div className={`relative mt-3 space-y-3 pl-5 ${depth < maxDepthIndent ? 'ml-5' : 'ml-0'}`} aria-label={`Replies to ${commentId}`}>
            {childIds.map((childId, childIndex) => (
              <div key={childId} className="relative">
                <span
                  className={`absolute -left-[22px] top-0 w-0.5 rounded-full bg-slate-200 ${
                    childIndex === childIds.length - 1 ? 'h-6' : '-bottom-3'
                  }`}
                  aria-hidden="true"
                />
                <span className="absolute -left-[22px] top-6 h-0.5 w-5 rounded-full bg-slate-200" aria-hidden="true" />
                {renderCommentSubtree(childId, depth + 1, isDisconnected, nextBranch)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  if (graph.commentIds.length === 0) {
    return (
      <section className={className}>
        {emptyState || (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No comments in this thread yet.</div>
        )}
      </section>
    );
  }

  return (
    <section className={`space-y-4 ${className ?? ''}`}>
      {hasRoot ? (
        renderCommentSubtree(thread.rootCommentId, 0, false, new Set<CommentId>())
      ) : (
        <div className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Root comment {thread.rootCommentId} is missing from this thread payload.
        </div>
      )}

      {disconnectedRootIds.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Disconnected comments</div>
          {disconnectedRootIds.map((commentId) => renderCommentSubtree(commentId, 0, true, new Set<CommentId>()))}
        </div>
      ) : null}

      {showDiagnostics && graph.issues.length > 0 ? (
        <details className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">Graph diagnostics ({graph.issues.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {graph.issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{describeIssue(issue)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
};
