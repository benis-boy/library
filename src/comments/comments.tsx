import { ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Comment as CommentModel,
  CommentId,
  TimestampMs,
  getCommentUserName,
  Thread as ThreadModel,
} from './dataModel';
import { ImageLightbox } from '../components/gallery/ImageLightbox';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { ThreadGraphIssue, buildThreadGraph, getOrphanRootCommentIds } from './graph-utils';

export const COMMENT_REACTION_OPTIONS = ['❤️', '👍', '👎', '😂'] as const;

type ReplyAction = {
  replyToCommentId: CommentId;
};

type ToggleReactionAction = {
  commentId: CommentId;
  emoji: string;
  shouldAdd: boolean;
};

type CommentEditAction = {
  commentId: CommentId;
};

type CommentSlotRender = (commentId: CommentId) => ReactNode;

export type CommentProps = {
  commentId: CommentId;
  comment: CommentModel;
  reactions: Record<string, string[]>;
  viewerReactionEmojis?: ReadonlySet<string>;
  highlighted?: boolean;
  isDisconnected?: boolean;
  actionsDisabled?: boolean;
  formatTimestamp?: (timestamp: TimestampMs) => string;
  resolveUserName?: (userName: string | null) => string;
  onReply?: (action: ReplyAction) => void;
  onToggleReaction?: (action: ToggleReactionAction) => void;
  onEdit?: (action: CommentEditAction) => void;
  onDelete?: (action: CommentEditAction) => void;
  onImageClick?: (imageSrc: string, imageAlt: string) => void;
  editor?: ReactNode;
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
  reactions,
  viewerReactionEmojis,
  highlighted = false,
  isDisconnected = false,
  actionsDisabled = false,
  formatTimestamp = formatRelativeTimestamp,
  resolveUserName = getCommentUserName,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onImageClick,
  editor,
}: CommentProps) => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const displayUserName = resolveUserName(comment.userName);
  const timestampLabel = formatTimestamp(comment.timestamp);
  const dateTime = toDateTimeAttribute(comment.timestamp);
  const attachmentUrl = comment.imageUrl?.trim() || null;
  const visibleReactions = COMMENT_REACTION_OPTIONS.map((emoji) => ({ emoji, count: reactions[emoji]?.length ?? 0 })).filter(
    (reaction) => reaction.count > 0
  );
  const articleClass = highlighted
    ? isDarkMode
      ? 'border-sky-700 bg-sky-950 shadow-sky-950/40'
      : 'border-sky-300 bg-sky-50 shadow-sky-100'
    : isDisconnected
      ? isDarkMode
        ? 'border-orange-700 bg-orange-950'
        : 'border-orange-300 bg-orange-50'
      : isDarkMode
        ? 'border-slate-700 bg-slate-900'
        : 'border-slate-200 bg-white';

  useEffect(() => {
    if (!isActionsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsMenuRef.current || actionsMenuRef.current.contains(event.target as Node)) {
        return;
      }

      setIsActionsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isActionsMenuOpen]);

  return (
    <article className={`rounded-2xl border p-3 shadow-sm transition-colors ${articleClass}`} data-comment-id={commentId}>
      <header className={`mb-2 flex flex-wrap items-center justify-between gap-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <strong className={isDarkMode ? 'text-slate-100' : 'text-slate-900'}>{displayUserName}</strong>
          <span aria-hidden="true">-</span>
          <time dateTime={dateTime} title={dateTime ? new Date(comment.timestamp).toLocaleString() : undefined}>
            {timestampLabel}
          </time>
          {comment.updated ? <span className={isDarkMode ? 'text-slate-500' : 'text-slate-500'}>Edited</span> : null}
        </div>
        {onEdit || onDelete ? (
          <div ref={actionsMenuRef} className="relative">
            <button
              type="button"
              aria-label="Comment actions"
              aria-expanded={isActionsMenuOpen}
              onClick={() => setIsActionsMenuOpen((isOpen) => !isOpen)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none ${
                isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              ...
            </button>
            {isActionsMenuOpen ? (
              <div
                className={`absolute right-0 z-10 mt-1 min-w-28 overflow-hidden rounded-xl border py-1 text-sm shadow-lg ${
                  isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
              >
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    onEdit({ commentId });
                  }}
                  disabled={actionsDisabled}
                  className={`block w-full px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    onDelete({ commentId });
                  }}
                  disabled={actionsDisabled}
                  className={`block w-full px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDarkMode ? 'text-red-300 hover:bg-red-950' : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  Delete
                </button>
              ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {editor || (
        <>
          <p className={`whitespace-pre-wrap text-sm leading-6 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{comment.text}</p>

          {attachmentUrl ? (
            <button
              type="button"
              onClick={() => onImageClick?.(attachmentUrl, `Attachment for comment ${commentId}`)}
              className={`mt-3 block w-fit cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                isDarkMode ? 'focus:ring-offset-slate-900' : ''
              }`}
            >
              <img
                src={attachmentUrl}
                alt={`Attachment for comment ${commentId}`}
                loading="lazy"
                className={`max-h-72 w-auto max-w-full rounded-lg border object-contain ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
              />
            </button>
          ) : null}

          <footer className="mt-3 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onReply?.({ replyToCommentId: commentId })}
              disabled={actionsDisabled || !onReply}
              className={`rounded-full px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Reply
            </button>
            <div className="group relative flex items-center gap-1">
              <button
                type="button"
                aria-label="Add reaction"
                disabled={actionsDisabled || !onToggleReaction}
                onClick={() => {
                  if (!viewerReactionEmojis?.has(COMMENT_REACTION_OPTIONS[0])) {
                    onToggleReaction?.({ commentId, emoji: COMMENT_REACTION_OPTIONS[0], shouldAdd: true });
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDarkMode ? 'hover:bg-rose-950 active:bg-rose-900' : 'hover:bg-rose-50 active:bg-rose-100'
                }`}
              >
                <span aria-hidden="true">{COMMENT_REACTION_OPTIONS[0]}</span>
              </button>
              {onToggleReaction ? (
                <div
                  className={`invisible absolute bottom-8 left-0 z-20 flex gap-1 rounded-full border p-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
                    isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                  }`}
                >
                  {COMMENT_REACTION_OPTIONS.map((emoji) => {
                    const hasReacted = viewerReactionEmojis?.has(emoji) ?? false;

                    return (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`${hasReacted ? 'Remove' : 'Add'} ${emoji} reaction`}
                        disabled={actionsDisabled}
                        onClick={() => onToggleReaction({ commentId, emoji, shouldAdd: !hasReacted })}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border text-base transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60 ${
                          hasReacted
                            ? isDarkMode
                              ? 'border-sky-400 bg-sky-950'
                              : 'border-sky-500 bg-sky-50'
                            : 'border-transparent'
                        }`}
                      >
                        <span aria-hidden="true">{emoji}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {visibleReactions.map(({ emoji, count }) => {
              const hasReacted = viewerReactionEmojis?.has(emoji) ?? false;

              return (
                <span
                  key={emoji}
                  className={`rounded-full border px-2 py-1 ${
                    hasReacted
                      ? isDarkMode
                        ? 'border-sky-400 bg-sky-950 text-sky-100'
                        : 'border-sky-500 bg-sky-50 text-sky-900'
                      : isDarkMode
                        ? 'border-slate-700 text-slate-300'
                        : 'border-slate-200 text-slate-600'
                  }`}
                  aria-label={`${count} ${emoji} reaction${count === 1 ? '' : 's'}`}
                >
                  {emoji} {count}
                </span>
              );
            })}
          </footer>
        </>
      )}
    </article>
  );
};

export type ThreadProps = {
  thread: ThreadModel;
  className?: string;
  signedInUserName?: string | null;
  reactionsByCommentId?: Partial<Record<CommentId, Record<string, string[]>>>;
  showDiagnostics?: boolean;
  actionsDisabled?: boolean;
  maxDepthIndent?: number;
  formatTimestamp?: (timestamp: TimestampMs) => string;
  resolveUserName?: (userName: string | null) => string;
  onReply?: (action: ReplyAction) => void;
  onToggleReaction?: (action: ToggleReactionAction) => void;
  onEdit?: (action: CommentEditAction) => void;
  onDelete?: (action: CommentEditAction) => void;
  renderCommentEditor?: CommentSlotRender;
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
  reactionsByCommentId = {},
  showDiagnostics = false,
  actionsDisabled = false,
  maxDepthIndent = DEFAULT_MAX_DEPTH_INDENT,
  formatTimestamp,
  resolveUserName,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  renderCommentEditor,
  renderAfterComment,
  emptyState,
}: ThreadProps) => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
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
        <div
          key={`cycle-${commentId}`}
          className={`ml-4 rounded-md border px-3 py-2 text-xs ${
            isDarkMode ? 'border-red-800 bg-red-950 text-red-200' : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          Cycle stopped while rendering branch at {commentId}
        </div>
      );
    }

    const comment = thread.commentsById[commentId];
    if (!comment) {
      return (
        <div
          key={`missing-${commentId}`}
          className={`ml-4 rounded-md border px-3 py-2 text-xs ${
            isDarkMode ? 'border-orange-700 bg-orange-950 text-orange-200' : 'border-orange-300 bg-orange-50 text-orange-800'
          }`}
        >
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
    const reactions = reactionsByCommentId[commentId] ?? {};
    const viewerReactionEmojis = new Set(
      signedInUserName
        ? Object.entries(reactions)
            .filter(([, userNames]) => userNames.includes(signedInUserName))
            .map(([emoji]) => emoji)
        : []
    );

    return (
      <div key={commentId} className="space-y-3">
        <Comment
          commentId={commentId}
          comment={comment}
          reactions={reactions}
          viewerReactionEmojis={viewerReactionEmojis}
          highlighted={shouldHighlight}
          isDisconnected={isDisconnected}
          actionsDisabled={actionsDisabled}
          formatTimestamp={formatTimestamp}
          resolveUserName={resolveUserName}
          onReply={onReply}
          onToggleReaction={onToggleReaction}
          onEdit={canEdit ? onEdit : undefined}
          onDelete={canDelete ? onDelete : undefined}
          onImageClick={(src, alt) => setLightboxImage({ src, alt })}
          editor={renderCommentEditor?.(commentId)}
        />
        {renderAfterComment?.(commentId)}
        {childIds.length > 0 ? (
          <div className={`relative mt-3 space-y-3 pl-5 ${depth < maxDepthIndent ? 'ml-5' : 'ml-0'}`} aria-label={`Replies to ${commentId}`}>
            {childIds.map((childId, childIndex) => (
              <div key={childId} className="relative">
                <span
                  className={`absolute -left-[22px] top-0 w-0.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} ${
                    childIndex === childIds.length - 1 ? 'h-6' : '-bottom-3'
                  }`}
                  aria-hidden="true"
                />
                <span className={`absolute -left-[22px] top-6 h-0.5 w-5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} aria-hidden="true" />
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
          <div
            className={`rounded-lg border border-dashed p-4 text-sm ${
              isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'
            }`}
          >
            No comments in this thread yet.
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`space-y-4 ${className ?? ''}`}>
      {hasRoot ? (
        renderCommentSubtree(thread.rootCommentId, 0, false, new Set<CommentId>())
      ) : (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            isDarkMode ? 'border-orange-700 bg-orange-950 text-orange-200' : 'border-orange-300 bg-orange-50 text-orange-800'
          }`}
        >
          Root comment {thread.rootCommentId} is missing from this thread payload.
        </div>
      )}

      {disconnectedRootIds.length > 0 ? (
        <div className="space-y-3">
          <div className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>Disconnected comments</div>
          {disconnectedRootIds.map((commentId) => renderCommentSubtree(commentId, 0, true, new Set<CommentId>()))}
        </div>
      ) : null}

      {showDiagnostics && graph.issues.length > 0 ? (
        <details
          className={`rounded-lg border p-3 text-xs ${
            isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-700'
          }`}
        >
          <summary className="cursor-pointer font-semibold">Graph diagnostics ({graph.issues.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {graph.issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{describeIssue(issue)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <ImageLightbox
        open={Boolean(lightboxImage)}
        imageSrc={lightboxImage?.src ?? ''}
        imageAlt={lightboxImage?.alt ?? 'Comment attachment'}
        onClose={() => setLightboxImage(null)}
      />
    </section>
  );
};
