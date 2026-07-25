import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommentNotification,
  CommentsForLocationResponse,
  fetchCommentReactions,
  fetchCommentsForLocations,
  fetchNotifications,
  sendThreadMutation,
  markNotificationsChecked,
} from '../comments/comments-api';
import { Comment as CommentModel, CommentId, CommentReactions, MutationOwner, ThreadLocationId, toThreadLocationKey } from '../comments/dataModel';
import { Comment } from '../comments/comments';
import { CommentInput } from '../comments/comment-section';
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

const CommentText = ({ comment, missingText, compact }: { comment: CommentModel | null | undefined; missingText: string; compact?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  if (comment === undefined) {
    return <p className="text-sm opacity-70">Loading...</p>;
  }
  if (comment === null) {
    return <p className="text-sm italic opacity-70">{missingText}</p>;
  }

  return (
    <button type="button" className="block w-full text-left" onClick={() => compact && setExpanded((isExpanded) => !isExpanded)}>
      <p className={`whitespace-pre-wrap text-sm leading-6 ${compact && !expanded ? 'line-clamp-1' : ''}`}>{comment.text}</p>
    </button>
  );
};

export const NotificationsModal = ({
  owner,
  initialUnreadCutoff,
  onClose,
}: {
  owner: Exclude<MutationOwner, null>;
  initialUnreadCutoff: number;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { isDarkMode } = useContext(ConfigurationContext);
  const patreonContext = useContext(PatreonContext);
  const listRef = useRef<HTMLDivElement | null>(null);
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
    setDetails((previousDetails) => ({ ...previousDetails, ...response }));

    const commentIds = notificationsWithCommentIds.flatMap((notification) => notification.commentIds);
    if (commentIds.length === 0) {
      return;
    }

    const reactionsResponse = await fetchCommentReactions(commentIds);
    setReactionsByCommentId((previousReactions) => ({ ...previousReactions, ...reactionsResponse.reactionsByCommentId }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchNotifications(owner, { limit: PAGE_SIZE });
        if (cancelled) {
          return;
        }

        setItems(response.items);
        setNextCursor(response.nextCursor);
        if (response.unreadCount > 0) {
          await markNotificationsChecked(owner);
        }
        if (!cancelled) {
          await loadDetails(response.items);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Could not load notifications.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const refreshLocationDetails = async (locationId: ThreadLocationId, commentIds: CommentId[]) => {
    const response = await fetchCommentsForLocations([{ locationId, commentIds }]);
    setDetails((previousDetails) => ({ ...previousDetails, ...response }));
    const reactionsResponse = await fetchCommentReactions(commentIds);
    setReactionsByCommentId((previousReactions) => ({ ...previousReactions, ...reactionsResponse.reactionsByCommentId }));
  };

  const findLoadedComment = (locationId: ThreadLocationId, commentId: CommentId) => {
    return details[toThreadLocationKey(locationId)]?.commentsById[commentId];
  };

  const handleReply = async (text: string, commentAnonymously: boolean, imageUrl: string | null, target: NotificationCommentTarget) => {
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

  const handleEdit = async (text: string, commentAnonymously: boolean, imageUrl: string | null, target: NotificationCommentTarget) => {
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
        if (replyingTo?.commentId === target.commentId && toThreadLocationKey(replyingTo.locationId) === toThreadLocationKey(target.locationId)) {
          setReplyingTo(null);
        }
        if (editing?.commentId === target.commentId && toThreadLocationKey(editing.locationId) === toThreadLocationKey(target.locationId)) {
          setEditing(null);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleReaction = async ({ locationId, commentId, emoji, shouldAdd }: NotificationCommentTarget & { emoji: string; shouldAdd: boolean }) => {
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

  const goToThread = (notification: CommentNotification) => {
    const params = new URLSearchParams({
      commentId: notification.type === 'comment-reply' ? notification.replyCommentId : notification.rootCommentId,
    });
    if (notification.locationId.paragraphLocation) {
      params.set('paragraphLocation', JSON.stringify(notification.locationId.paragraphLocation));
    }

    navigate(`${getReaderRoute(notification.locationId.bookId, notification.locationId.chapterId)}?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-[2400] flex items-center justify-center bg-slate-950/70 px-3 py-6" onClick={onClose}>
      <div
        className={`flex max-h-full w-full max-w-2xl flex-col rounded-2xl shadow-2xl ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-950'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center justify-between gap-3 border-b p-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className="text-lg font-bold">Comment Notifications</h2>
          <button type="button" className="rounded-full bg-[#BE3144] px-3 py-1 text-sm font-semibold text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div ref={listRef} className="overflow-y-auto p-4" onScroll={handleScroll}>
          {isLoading ? <p className="text-sm opacity-70">Loading notifications...</p> : null}
          {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {!isLoading && items.length === 0 ? <p className="text-sm opacity-70">No comment notifications yet.</p> : null}

          <div className="space-y-3">
            {items.map((notification) => {
              const locationKey = toThreadLocationKey(notification.locationId);
              const locationDetails = details[locationKey];
              const isNew = notification.createdAt > initialUnreadCutoff;
              const parent = notification.type === 'comment-reply' ? locationDetails?.commentsById[notification.parentCommentId] : undefined;
              const reply = notification.type === 'comment-reply' ? locationDetails?.commentsById[notification.replyCommentId] : undefined;
              const rootComment = notification.type === 'comment-thread-start' ? locationDetails?.commentsById[notification.rootCommentId] : undefined;
              const lowestPointComment = notification.type === 'comment-reply' ? reply : rootComment;
              const lowestPointCommentId = notification.type === 'comment-reply' ? notification.replyCommentId : notification.rootCommentId;
              const lowestPointTarget = { locationId: notification.locationId, commentId: lowestPointCommentId };
              const isEditingLowestPoint =
                editing?.commentId === lowestPointCommentId && toThreadLocationKey(editing.locationId) === locationKey;
              const isReplyingToLowestPoint =
                replyingTo?.commentId === lowestPointCommentId && toThreadLocationKey(replyingTo.locationId) === locationKey;
              const canEditLowestPoint = Boolean(
                signedInUserName && lowestPointComment && lowestPointComment !== null && lowestPointComment.userName === signedInUserName
              );
              const isMissingReplyThread =
                notification.type === 'comment-reply' && locationDetails?.threadExists === false && parent === null && reply === null;
              const isMissingStartThread = notification.type === 'comment-thread-start' && locationDetails?.threadExists === false && rootComment === null;

              return (
                <article
                  key={notification.id}
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
                      {notification.actorUserName ?? 'Anonymous'} {notification.type === 'comment-reply' ? 'replied' : 'started a new thread'}
                    </span>
                    <time dateTime={new Date(notification.createdAt).toISOString()}>{formatRelativeTime(notification.createdAt)}</time>
                  </div>
                  {isMissingReplyThread || isMissingStartThread ? (
                    <div className="rounded-xl border border-current/10 p-3 text-sm italic opacity-80">Thread no longer exists.</div>
                  ) : (
                    <>
                      {notification.type === 'comment-reply' ? (
                        <div className="rounded-xl border border-current/10 p-2 opacity-80">
                          <CommentText comment={parent} missingText="Original comment no longer exists." compact />
                        </div>
                      ) : null}
                      <div className={notification.type === 'comment-reply' ? 'mt-2' : ''}>
                        {lowestPointComment === undefined ? (
                          <p className="text-sm opacity-70">Loading...</p>
                        ) : lowestPointComment === null ? (
                          <p className="rounded-xl border border-current/10 p-3 text-sm italic opacity-80">Comment no longer exists.</p>
                        ) : (
                          <Comment
                            commentId={lowestPointCommentId}
                            comment={lowestPointComment}
                            reactions={reactionsByCommentId[lowestPointCommentId] ?? {}}
                            isOwnComment={Boolean(signedInUserName && lowestPointComment.userName === signedInUserName)}
                            actionsDisabled={isSubmitting}
                            onReply={({ replyToCommentId }) => {
                              setEditing(null);
                              setReplyingTo({ locationId: notification.locationId, commentId: replyToCommentId });
                            }}
                            onToggleReaction={
                              canUseSignedIdentity
                                ? ({ commentId, emoji, shouldAdd }) => void handleToggleReaction({ locationId: notification.locationId, commentId, emoji, shouldAdd })
                                : undefined
                            }
                            onEdit={canEditLowestPoint ? ({ commentId }) => {
                              setReplyingTo(null);
                              setEditing({ locationId: notification.locationId, commentId });
                            } : undefined}
                            onDelete={canEditLowestPoint ? ({ commentId }) => setPendingDelete({ locationId: notification.locationId, commentId }) : undefined}
                            editor={isEditingLowestPoint ? (
                              <div className="mt-3">
                                <CommentInput
                                  autoFocus
                                  disabled={isSubmitting}
                                  embedded
                                  initialText={lowestPointComment.text}
                                  initialImageUrl={lowestPointComment.imageUrl ?? undefined}
                                  placeholder="Edit your comment..."
                                  submitLabel="Comment"
                                  onCancel={() => setEditing(null)}
                                  onSubmit={(text, commentAnonymously, imageUrl) =>
                                    handleEdit(text, commentAnonymously, imageUrl, lowestPointTarget)
                                  }
                                />
                              </div>
                            ) : undefined}
                          />
                        )}
                        {isReplyingToLowestPoint ? (
                          <div className="mt-3 pl-2">
                            <CommentInput
                              autoFocus
                              disabled={isSubmitting}
                              placeholder="Add a reply..."
                              submitLabel="Reply"
                              onCancel={() => setReplyingTo(null)}
                              onSubmit={(text, commentAnonymously, imageUrl) =>
                                handleReply(text, commentAnonymously, imageUrl, lowestPointTarget)
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                  <button type="button" className="mt-3 rounded-full bg-[#BE3144] px-4 py-2 text-sm font-semibold text-white" onClick={() => goToThread(notification)}>
                    Go to thread
                  </button>
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
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        slotProps={{
          root: {
            sx: { zIndex: 2500 },
          },
          paper: {
            sx: isDarkMode
              ? {
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f1f5f9',
                }
              : undefined,
          },
          backdrop: {
            sx: isDarkMode ? { backgroundColor: 'rgba(0, 0, 0, 0.7)' } : undefined,
          },
        }}
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
    </div>
  );
};
