import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommentNotification,
  CommentsForLocationResponse,
  fetchCommentReactions,
  fetchCommentsForLocations,
  fetchNotifications,
  markNotificationsChecked,
  NotificationsSummaryResponse,
  sendThreadMutation,
} from '../comments/comments-api';
import {
  Comment as CommentModel,
  CommentId,
  CommentReactions,
  MutationOwner,
  ThreadLocationId,
  toThreadLocationKey,
} from '../comments/dataModel';
import { Comment, CommentPreview } from '../comments/comments';
import { CommentInput } from '../comments/comment-section';
import { ImageLightbox } from './gallery/ImageLightbox';
import { getAppDialogSlotProps } from './general/app-dialog';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { getReaderRoute } from '../context/LibraryContext';
import { PatreonContext } from '../context/PatreonContext';

const PAGE_SIZE = 5;

type NotificationDetails = Record<string, CommentsForLocationResponse>;
type NotificationReactions = Record<CommentId, CommentReactions>;
type NotificationCommentTarget = {
  locationId: ThreadLocationId;
  commentId: CommentId;
};

const mergeNotificationDetails = (previousDetails: NotificationDetails, nextDetails: NotificationDetails) => {
  const mergedDetails = { ...previousDetails };

  for (const [locationKey, nextLocationDetails] of Object.entries(nextDetails)) {
    const previousLocationDetails = previousDetails[locationKey];
    mergedDetails[locationKey] = previousLocationDetails
      ? {
          threadExists: nextLocationDetails.threadExists,
          commentsById: {
            ...previousLocationDetails.commentsById,
            ...nextLocationDetails.commentsById,
          },
        }
      : nextLocationDetails;
  }

  return mergedDetails;
};

const formatRelativeTime = (timestamp: number) => {
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsedMs < hour) {
    const minutes = Math.max(1, Math.floor(elapsedMs / minute));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (elapsedMs < day) {
    const hours = Math.floor(elapsedMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(elapsedMs / day);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const NotificationsModal = ({
  open,
  owner,
  initialUnreadCutoff,
  onClose,
  onSummaryChange,
}: {
  open: boolean;
  owner: Exclude<MutationOwner, null>;
  initialUnreadCutoff: number;
  onClose: (options?: { preserveUnreadCutoff?: boolean }) => void;
  onSummaryChange: (summary: NotificationsSummaryResponse) => void;
}) => {
  const navigate = useNavigate();
  const { isDarkMode } = useContext(ConfigurationContext);
  const patreonContext = useContext(PatreonContext);
  const listRef = useRef<HTMLDivElement | null>(null);
  const ownerKey = useMemo(() => `${owner.userName}:${owner.patreonUserId}:${owner.signedUser}`, [owner]);
  const [items, setItems] = useState<CommentNotification[]>([]);
  const [details, setDetails] = useState<NotificationDetails>({});
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [reactionsByCommentId, setReactionsByCommentId] = useState<NotificationReactions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<NotificationCommentTarget | null>(null);
  const [editing, setEditing] = useState<NotificationCommentTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NotificationCommentTarget | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [unreadCutoff, setUnreadCutoff] = useState(initialUnreadCutoff);
  const hasLoadedNotificationsRef = useRef(false);

  useEffect(() => {
    hasLoadedNotificationsRef.current = false;
    setUnreadCutoff(initialUnreadCutoff);
    setItems([]);
    setDetails({});
    setReactionsByCommentId({});
    setNextCursor(null);
    setError(null);
    setReplyingTo(null);
    setEditing(null);
    setPendingDelete(null);
    setLightboxImage(null);
  }, [initialUnreadCutoff, ownerKey]);

  const signedInUserName = patreonContext?.userInfo?.userName ?? null;
  const patreonUserId = patreonContext?.patreonUserId ?? null;
  const signedUser = patreonContext?.signedUser ?? null;
  const canUseSignedIdentity = Boolean(signedInUserName && patreonUserId && signedUser);
  const signedMutationOwner = useMemo<Exclude<MutationOwner, null> | null>(
    () =>
      canUseSignedIdentity && signedInUserName && patreonUserId && signedUser
        ? { userName: signedInUserName, patreonUserId, signedUser }
        : null,
    [canUseSignedIdentity, patreonUserId, signedInUserName, signedUser]
  );

  const getMutationOwner = (commentAnonymously = false): MutationOwner => {
    if (commentAnonymously || !signedMutationOwner) {
      return null;
    }

    return signedMutationOwner;
  };

  const createCommentId = () => {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `comment-${Date.now().toString(36)}-${randomPart}`;
  };

  const createComment = (text: string, userName: string | null, imageUrl: string | null): CommentModel => ({
    timestamp: Date.now(),
    userName,
    text,
    imageUrl,
    replyIds: [],
  });

  const applyReactionState = (
    previousReactionsByCommentId: Record<CommentId, CommentReactions>,
    commentId: CommentId,
    emoji: string,
    userName: string,
    shouldAdd: boolean
  ) => {
    const previousReactions = previousReactionsByCommentId[commentId] ?? {};
    const previousUserNames = previousReactions[emoji] ?? [];
    const nextUserNames = shouldAdd
      ? previousUserNames.includes(userName)
        ? previousUserNames
        : [...previousUserNames, userName]
      : previousUserNames.filter((reactionUserName) => reactionUserName !== userName);

    return {
      ...previousReactionsByCommentId,
      [commentId]: {
        ...previousReactions,
        [emoji]: nextUserNames,
      },
    };
  };

  const loadDetails = async (notifications: CommentNotification[]) => {
    const notificationsWithCommentIds = notifications.map((notification) => ({
      locationId: notification.locationId,
      commentIds:
        notification.type === 'comment-reply'
          ? [notification.parentCommentId, notification.replyCommentId]
          : [notification.rootCommentId],
    }));
    if (notificationsWithCommentIds.length === 0) {
      return;
    }

    const response = await fetchCommentsForLocations(notificationsWithCommentIds);
    setDetails((previousDetails) => mergeNotificationDetails(previousDetails, response));

    const commentIds = notificationsWithCommentIds.flatMap((notification) => notification.commentIds);
    if (commentIds.length === 0) {
      return;
    }

    const reactionsResponse = await fetchCommentReactions(commentIds);
    setReactionsByCommentId((previousReactions) => ({
      ...previousReactions,
      ...reactionsResponse.reactionsByCommentId,
    }));
  };

  const loadInitial = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!force && hasLoadedNotificationsRef.current) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setReplyingTo(null);
      setEditing(null);
      setPendingDelete(null);

      try {
        const response = await fetchNotifications(owner, { limit: PAGE_SIZE });
        setUnreadCutoff(response.lastCheckedAt);
        setItems(response.items);
        setDetails({});
        setReactionsByCommentId({});
        setNextCursor(response.nextCursor);

        if (response.unreadCount > 0) {
          const summary = await markNotificationsChecked(owner);
          onSummaryChange(summary);
        } else {
          onSummaryChange({ unreadCount: response.unreadCount, lastCheckedAt: response.lastCheckedAt });
        }

        await loadDetails(response.items);
        hasLoadedNotificationsRef.current = true;
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load notifications.');
      } finally {
        setIsLoading(false);
      }
    },
    [onSummaryChange, owner]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadInitial();
  }, [loadInitial, open]);

  const refreshLocationDetails = async (locationId: ThreadLocationId, commentIds: CommentId[]) => {
    const response = await fetchCommentsForLocations([{ locationId, commentIds }]);
    setDetails((previousDetails) => mergeNotificationDetails(previousDetails, response));
    const reactionsResponse = await fetchCommentReactions(commentIds);
    setReactionsByCommentId((previousReactions) => ({
      ...previousReactions,
      ...reactionsResponse.reactionsByCommentId,
    }));
  };

  const findLoadedComment = (locationId: ThreadLocationId, commentId: CommentId) => {
    return details[toThreadLocationKey(locationId)]?.commentsById[commentId];
  };

  const handleReply = async (
    text: string,
    commentAnonymously: boolean,
    imageUrl: string | null,
    target: NotificationCommentTarget
  ) => {
    const commentId = createCommentId();
    const mutationOwner = getMutationOwner(commentAnonymously);
    const userName = mutationOwner?.userName ?? null;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await sendThreadMutation(
        { bookId: target.locationId.bookId, chapterId: target.locationId.chapterId },
        {
          type: 'upsert-comment',
          mutationOwner,
          commentId,
          replyingTo: target.commentId,
          comment: createComment(text, userName, imageUrl),
        }
      );

      if (response.type === 'threads-updated') {
        await refreshLocationDetails(target.locationId, [target.commentId, commentId]);
        setReplyingTo(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not post reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (
    text: string,
    commentAnonymously: boolean,
    imageUrl: string | null,
    target: NotificationCommentTarget
  ) => {
    const existingComment = findLoadedComment(target.locationId, target.commentId);
    if (!existingComment || existingComment === null) {
      setError('Could not find comment to edit.');
      return;
    }

    const mutationOwner = getMutationOwner(commentAnonymously);
    const userName = mutationOwner?.userName ?? null;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await sendThreadMutation(
        { bookId: target.locationId.bookId, chapterId: target.locationId.chapterId },
        {
          type: 'upsert-comment',
          mutationOwner,
          commentId: target.commentId,
          replyingTo: target.commentId,
          comment: {
            ...existingComment,
            text,
            userName,
            imageUrl,
            updated: true,
          },
        }
      );

      if (response.type === 'threads-updated') {
        await refreshLocationDetails(target.locationId, [target.commentId]);
        setEditing(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not edit comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (target: NotificationCommentTarget) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await sendThreadMutation(
        { bookId: target.locationId.bookId, chapterId: target.locationId.chapterId },
        {
          type: 'delete-comment',
          mutationOwner: getMutationOwner(false),
          commentId: target.commentId,
          wasReplyingTo: target.commentId,
        }
      );

      if (response.type === 'threads-updated') {
        await refreshLocationDetails(target.locationId, [target.commentId]);
        setPendingDelete(null);
        if (
          replyingTo?.commentId === target.commentId &&
          toThreadLocationKey(replyingTo.locationId) === toThreadLocationKey(target.locationId)
        ) {
          setReplyingTo(null);
        }
        if (
          editing?.commentId === target.commentId &&
          toThreadLocationKey(editing.locationId) === toThreadLocationKey(target.locationId)
        ) {
          setEditing(null);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleReaction = async ({
    locationId,
    commentId,
    emoji,
    shouldAdd,
  }: NotificationCommentTarget & { emoji: string; shouldAdd: boolean }) => {
    if (!signedMutationOwner || !signedInUserName) {
      return;
    }

    const previousReactedByUser = reactionsByCommentId[commentId]?.[emoji]?.includes(signedInUserName) ?? false;
    if (previousReactedByUser === shouldAdd) {
      return;
    }

    setError(null);
    setReactionsByCommentId((previousReactionsByCommentId) =>
      applyReactionState(previousReactionsByCommentId, commentId, emoji, signedInUserName, shouldAdd)
    );

    const currentReactionEmojis = new Set(
      Object.entries(reactionsByCommentId[commentId] ?? {})
        .filter(([, userNames]) => userNames.includes(signedInUserName))
        .map(([reactionEmoji]) => reactionEmoji)
    );
    if (shouldAdd) {
      currentReactionEmojis.add(emoji);
    } else {
      currentReactionEmojis.delete(emoji);
    }

    try {
      const response = await sendThreadMutation(
        { bookId: locationId.bookId, chapterId: locationId.chapterId },
        {
          type: 'set-comment-reactions',
          mutationOwner: signedMutationOwner,
          commentId,
          emojis: [...currentReactionEmojis],
          userName: signedInUserName,
        }
      );

      if (response.type === 'comment-reactions-updated') {
        setReactionsByCommentId((previousReactionsByCommentId) => ({
          ...previousReactionsByCommentId,
          [commentId]: response.reactions,
        }));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update reaction.');
      await refreshLocationDetails(locationId, [commentId]);
    }
  };

  const matchesTarget = (
    target: NotificationCommentTarget | null,
    locationId: ThreadLocationId,
    commentId: CommentId
  ) => {
    if (!target) {
      return false;
    }

    return target.commentId === commentId && toThreadLocationKey(target.locationId) === toThreadLocationKey(locationId);
  };

  const getViewerReactionEmojis = (commentId: CommentId) =>
    new Set(
      signedInUserName
        ? Object.entries(reactionsByCommentId[commentId] ?? {})
            .filter(([, userNames]) => userNames.includes(signedInUserName))
            .map(([emoji]) => emoji)
        : []
    );

  const renderCommentInput = (target: NotificationCommentTarget, comment: CommentModel, mode: 'reply' | 'edit') => {
    if (mode === 'edit') {
      return (
        <div className="mt-3">
          <CommentInput
            autoFocus
            disabled={isSubmitting}
            embedded
            initialText={comment.text}
            initialImageUrl={comment.imageUrl ?? undefined}
            placeholder="Edit your comment..."
            submitLabel="Comment"
            onCancel={() => setEditing(null)}
            onSubmit={(text, commentAnonymously, imageUrl) => handleEdit(text, commentAnonymously, imageUrl, target)}
          />
        </div>
      );
    }

    return (
      <div className="mt-3 pl-2">
        <CommentInput
          autoFocus
          disabled={isSubmitting}
          placeholder="Add a reply..."
          submitLabel="Reply"
          onCancel={() => setReplyingTo(null)}
          onSubmit={(text, commentAnonymously, imageUrl) => handleReply(text, commentAnonymously, imageUrl, target)}
        />
      </div>
    );
  };

  const renderNotificationComment = ({
    locationId,
    commentId,
    comment,
    contentClassName,
    imageClassName,
  }: {
    locationId: ThreadLocationId;
    commentId: CommentId;
    comment: CommentModel;
    contentClassName?: string;
    imageClassName?: string;
  }) => {
    const target = { locationId, commentId };
    const canEdit = Boolean(signedInUserName && comment.userName === signedInUserName);

    return (
      <>
        <Comment
          commentId={commentId}
          comment={comment}
          reactions={reactionsByCommentId[commentId] ?? {}}
          viewerReactionEmojis={getViewerReactionEmojis(commentId)}
          isOwnComment={Boolean(signedInUserName && comment.userName === signedInUserName)}
          actionsDisabled={isSubmitting}
          onReply={({ replyToCommentId }) => {
            setEditing(null);
            setReplyingTo({ locationId, commentId: replyToCommentId });
          }}
          onToggleReaction={
            canUseSignedIdentity
              ? ({ commentId: reactionCommentId, emoji, shouldAdd }) =>
                  void handleToggleReaction({ locationId, commentId: reactionCommentId, emoji, shouldAdd })
              : undefined
          }
          onEdit={
            canEdit
              ? ({ commentId: editedCommentId }) => {
                  setReplyingTo(null);
                  setEditing({ locationId, commentId: editedCommentId });
                }
              : undefined
          }
          onDelete={
            canEdit
              ? ({ commentId: deletedCommentId }) => setPendingDelete({ locationId, commentId: deletedCommentId })
              : undefined
          }
          onImageClick={(src, alt) => setLightboxImage({ src, alt })}
          onGoToThread={() => goToCommentThread(locationId, commentId)}
          editor={
            matchesTarget(editing, locationId, commentId) ? renderCommentInput(target, comment, 'edit') : undefined
          }
          contentClassName={contentClassName}
          imageClassName={imageClassName}
        />
        {matchesTarget(replyingTo, locationId, commentId) ? renderCommentInput(target, comment, 'reply') : null}
      </>
    );
  };

  const loadMore = async () => {
    if (nextCursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await fetchNotifications(owner, { limit: PAGE_SIZE, before: nextCursor });
      setItems((previousItems) => [...previousItems, ...response.items]);
      setNextCursor(response.nextCursor);
      await loadDetails(response.items);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load more notifications.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const list = listRef.current;
    if (!list || nextCursor === null || isLoadingMore) {
      return;
    }

    if (list.scrollHeight - list.scrollTop - list.clientHeight < 160) {
      void loadMore();
    }
  };

  const goToCommentThread = (locationId: ThreadLocationId, commentId: CommentId) => {
    onClose({ preserveUnreadCutoff: true });

    const params = new URLSearchParams({ commentId });
    if (locationId.paragraphLocation) {
      params.set('paragraphLocation', JSON.stringify(locationId.paragraphLocation));
    }

    navigate(`${getReaderRoute(locationId.bookId, locationId.chapterId)}?${params.toString()}`);
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      fullWidth
      maxWidth="md"
      slotProps={getAppDialogSlotProps({
        isDarkMode,
        zIndex: 2400,
        paperClassName: 'mx-3 w-full max-w-2xl rounded-2xl shadow-2xl',
        paperSx: { maxHeight: 'calc(100% - 48px)' },
      })}
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col">
        <div
          className={`flex items-center justify-between gap-3 border-b p-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
        >
          <h2 className="text-lg font-bold">Comment Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm font-semibold ${isDarkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              onClick={() => void loadInitial({ force: true })}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-full bg-[#BE3144] px-3 py-1 text-sm font-semibold text-white"
              onClick={() => onClose()}
            >
              Close
            </button>
          </div>
        </div>

        <div ref={listRef} aria-label="Notifications list" className="overflow-y-auto overscroll-contain p-4" onScroll={handleScroll}>
          {isLoading ? <p className="text-sm opacity-70">Loading notifications...</p> : null}
          {error ? (
            <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {!isLoading && items.length === 0 ? (
            <p className="text-sm opacity-70">No comment notifications yet.</p>
          ) : null}

          <div className="space-y-3">
            {items.map((notification) => {
              const locationKey = toThreadLocationKey(notification.locationId);
              const locationDetails = details[locationKey];
              const isNew = notification.createdAt > unreadCutoff;
              const parent =
                notification.type === 'comment-reply'
                  ? locationDetails?.commentsById[notification.parentCommentId]
                  : undefined;
              const reply =
                notification.type === 'comment-reply'
                  ? locationDetails?.commentsById[notification.replyCommentId]
                  : undefined;
              const rootComment =
                notification.type === 'comment-thread-start'
                  ? locationDetails?.commentsById[notification.rootCommentId]
                  : undefined;
              const lowestPointComment = notification.type === 'comment-reply' ? reply : rootComment;
              const lowestPointCommentId =
                notification.type === 'comment-reply' ? notification.replyCommentId : notification.rootCommentId;
              const isMissingReplyThread =
                notification.type === 'comment-reply' &&
                locationDetails?.threadExists === false &&
                parent === null &&
                reply === null;
              const isMissingStartThread =
                notification.type === 'comment-thread-start' &&
                locationDetails?.threadExists === false &&
                rootComment === null;
              return (
                <article
                  key={notification.id}
                  data-notification-id={notification.id}
                  className={`rounded-2xl border p-3 ${
                    isNew
                      ? isDarkMode
                        ? 'border-sky-500 bg-sky-950/40'
                        : 'border-sky-300 bg-sky-50'
                      : isDarkMode
                        ? 'border-slate-700 bg-slate-950'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs opacity-75">
                    <span>
                      {notification.actorUserName ?? 'Anonymous'}{' '}
                      {notification.type === 'comment-reply' ? 'replied' : 'started a new thread'}
                    </span>
                    <time dateTime={new Date(notification.createdAt).toISOString()}>
                      {formatRelativeTime(notification.createdAt)}
                    </time>
                  </div>
                  {isMissingReplyThread || isMissingStartThread ? (
                    <div className="rounded-xl border border-current/10 p-3 text-sm italic opacity-80">
                      Thread no longer exists.
                    </div>
                  ) : (
                    <>
                      {notification.type === 'comment-reply' ? (
                        <CommentPreview
                          comment={parent}
                          missingText="Original comment no longer exists."
                          compact
                          className="opacity-80 flex flex-col w-full"
                          onImageClick={(src, alt) => setLightboxImage({ src, alt })}
                          expandedContent={
                            parent
                              ? renderNotificationComment({
                                  locationId: notification.locationId,
                                  commentId: notification.parentCommentId,
                                  comment: parent,
                                  contentClassName: isDarkMode ? 'text-slate-300' : 'text-slate-700',
                                  imageClassName: 'max-h-48',
                                })
                              : null
                          }
                        ></CommentPreview>
                      ) : null}
                      <div className={notification.type === 'comment-reply' ? 'mt-2' : ''}>
                        {lowestPointComment === undefined ? (
                          <p className="text-sm opacity-70">Loading...</p>
                        ) : lowestPointComment === null ? (
                          <p className="rounded-xl border border-current/10 p-3 text-sm italic opacity-80">
                            Comment no longer exists.
                          </p>
                        ) : (
                          renderNotificationComment({
                            locationId: notification.locationId,
                            commentId: lowestPointCommentId,
                            comment: lowestPointComment,
                          })
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          {nextCursor !== null ? (
            <button
              type="button"
              disabled={isLoadingMore}
              className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => void loadMore()}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      </div>
      <ImageLightbox
        open={Boolean(lightboxImage)}
        imageSrc={lightboxImage?.src ?? ''}
        imageAlt={lightboxImage?.alt ?? 'Comment attachment'}
        onClose={() => setLightboxImage(null)}
      />
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        slotProps={getAppDialogSlotProps({ isDarkMode, zIndex: 2500 })}
      >
        <DialogTitle>Delete comment?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={isDarkMode ? { color: '#cbd5e1' } : undefined}>
            This will permanently remove this comment and its replies.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setPendingDelete(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !pendingDelete}
            className="rounded-full bg-[#BE3144] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => pendingDelete && void handleDelete(pendingDelete)}
          >
            Delete
          </button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
