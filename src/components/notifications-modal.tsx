import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommentReplyNotification,
  fetchCommentsForLocations,
  fetchNotifications,
  markNotificationsChecked,
} from '../comments/comments-api';
import { Comment, MutationOwner, toThreadLocationKey } from '../comments/dataModel';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { getReaderRoute } from '../context/LibraryContext';

const PAGE_SIZE = 5;

type NotificationDetails = Record<string, Record<string, Comment | null>>;

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

const CommentText = ({ comment, missingText, compact }: { comment: Comment | null | undefined; missingText: string; compact?: boolean }) => {
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<CommentReplyNotification[]>([]);
  const [details, setDetails] = useState<NotificationDetails>({});
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = async (notifications: CommentReplyNotification[]) => {
    if (notifications.length === 0) {
      return;
    }

    const response = await fetchCommentsForLocations(
      notifications.map((notification) => ({
        locationId: notification.locationId,
        commentIds: [notification.parentCommentId, notification.replyCommentId],
      }))
    );
    setDetails((previousDetails) => ({ ...previousDetails, ...response }));
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
        await markNotificationsChecked(owner);
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

  const goToThread = (notification: CommentReplyNotification) => {
    const params = new URLSearchParams({ commentId: notification.replyCommentId });
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
          <h2 className="text-lg font-bold">Reply Notifications</h2>
          <button type="button" className="rounded-full bg-[#BE3144] px-3 py-1 text-sm font-semibold text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div ref={listRef} className="overflow-y-auto p-4" onScroll={handleScroll}>
          {isLoading ? <p className="text-sm opacity-70">Loading notifications...</p> : null}
          {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {!isLoading && items.length === 0 ? <p className="text-sm opacity-70">No reply notifications yet.</p> : null}

          <div className="space-y-3">
            {items.map((notification) => {
              const locationKey = toThreadLocationKey(notification.locationId);
              const parent = details[locationKey]?.[notification.parentCommentId];
              const reply = details[locationKey]?.[notification.replyCommentId];
              const isNew = notification.createdAt > initialUnreadCutoff;

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
                    <span>{notification.actorUserName ?? 'Anonymous'} replied</span>
                    <time dateTime={new Date(notification.createdAt).toISOString()}>{formatRelativeTime(notification.createdAt)}</time>
                  </div>
                  <div className="rounded-xl border border-current/10 p-2 opacity-80">
                    <CommentText comment={parent} missingText="Original comment no longer exists." compact />
                  </div>
                  <div className="mt-2 rounded-xl border border-current/10 p-2">
                    <CommentText comment={reply} missingText="Reply no longer exists." />
                  </div>
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
    </div>
  );
};
