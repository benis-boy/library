import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PatreonContext } from '../context/PatreonContext';
import { Thread as ThreadView } from './comments';
import { fetchCommentLikedUserNames, fetchThreadsForPage, sendThreadMutation } from './comments-api';
import { Comment, CommentId, PageLocationId, Thread, ThreadLocationId, toPageLocationId } from './dataModel';

type CommentInputProps = {
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  forceAnonymous?: boolean;
  initialText?: string;
  onCancel?: () => void;
  onSubmit: (text: string, commentAnonymously: boolean) => Promise<void> | void;
};

export type CommentSectionProps = {
  locationId: PageLocationId | ThreadLocationId;
  className?: string;
};

const isLocalLibraryUrl = () => {
  return window.location.origin === 'http://localhost:5173' && window.location.pathname === '/library/';
};

const createCommentId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `comment-${Date.now().toString(36)}-${randomPart}`;
};

const countThreadComments = (threads: Thread[]) => {
  return threads.reduce((count, thread) => count + Object.keys(thread.commentsById).length, 0);
};

const getThreadCommentIds = (threads: Thread[]) => {
  return threads.flatMap((thread) => Object.keys(thread.commentsById) as CommentId[]);
};

const normalizePageLocation = (locationId: PageLocationId | ThreadLocationId): PageLocationId => {
  if ('lineNumber' in locationId) {
    return toPageLocationId(locationId);
  }

  return locationId;
};

const createComment = (text: string, userName: string | null): Comment => ({
  timestamp: Date.now(),
  userName,
  text,
  imageUrl: null,
  replyIds: [],
});

const commentInputBaseClass =
  'block max-h-48 min-h-10 w-full resize-none overflow-hidden border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-0 disabled:opacity-60';

type LoadedComments = {
  threads: Thread[];
  likeCountsByCommentId: Record<CommentId, number>;
  commentsLikedByUserSet: Set<CommentId>;
};

const commentLoadCache = new Map<string, { cachedAt: number; promise: Promise<LoadedComments> }>();
const COMMENT_LOAD_CACHE_MS = 1000;
const LIKE_MUTATION_DEBOUNCE_MS = 5000;

const getCommentLoadCacheKey = (pageLocationId: PageLocationId, signedInUserName: string | null) => {
  return `${pageLocationId.bookId}:${pageLocationId.chapterId}:${signedInUserName ?? 'anonymous'}`;
};

const loadCommentsForPage = (pageLocationId: PageLocationId, signedInUserName: string | null) => {
  const cacheKey = getCommentLoadCacheKey(pageLocationId, signedInUserName);
  const cached = commentLoadCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.cachedAt < COMMENT_LOAD_CACHE_MS) {
    return cached.promise;
  }

  const promise = (async (): Promise<LoadedComments> => {
    const threadsResponse = await fetchThreadsForPage(pageLocationId);
    const commentIds = getThreadCommentIds(threadsResponse.threads);
    if (commentIds.length === 0) {
      return {
        threads: threadsResponse.threads,
        likeCountsByCommentId: {},
        commentsLikedByUserSet: new Set<CommentId>(),
      };
    }

    const likesResponse = await fetchCommentLikedUserNames(commentIds, signedInUserName);
    return {
      threads: threadsResponse.threads,
      likeCountsByCommentId: likesResponse.likeCountsByCommentId,
      commentsLikedByUserSet: likesResponse.commentsLikedByUserSet,
    };
  })();

  commentLoadCache.set(cacheKey, { cachedAt: now, promise });
  return promise;
};

const CommentInput = ({
  autoFocus = false,
  disabled = false,
  placeholder = 'Add a comment...',
  submitLabel = 'Comment',
  forceAnonymous = false,
  initialText = '',
  onCancel,
  onSubmit,
}: CommentInputProps) => {
  const [text, setText] = useState(initialText);
  const [isFocused, setIsFocused] = useState(autoFocus);
  const [commentAnonymously, setCommentAnonymously] = useState(forceAnonymous);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const showActions = isFocused || text.trim().length > 0;

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (forceAnonymous) {
      setCommentAnonymously(true);
    }
  }, [forceAnonymous]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    textareaRef.current?.focus();
  }, [autoFocus]);

  const handleCancel = () => {
    setText('');
    setCommentAnonymously(forceAnonymous);
    setIsFocused(false);
    onCancel?.();
  };

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || disabled) {
      return;
    }

    await onSubmit(trimmedText, commentAnonymously);
    setText('');
    setCommentAnonymously(forceAnonymous);
    setIsFocused(false);
  };

  return (
    <div className="rounded-2xl border border-transparent bg-white p-3 shadow-sm transition-colors focus-within:border-slate-200">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => setText(event.target.value)}
        className={commentInputBaseClass}
      />

      {showActions ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={commentAnonymously}
              disabled={disabled || forceAnonymous}
              onChange={(event) => setCommentAnonymously(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            Comment Anonymously
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={disabled}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={disabled || text.trim().length === 0}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const CommentSection = ({ locationId, className }: CommentSectionProps) => {
  const patreonContext = useContext(PatreonContext);
  const pageLocationId = useMemo(() => normalizePageLocation(locationId), [locationId]);
  const signedInUserName = isLocalLibraryUrl() ? 'B. Warnecke' : (patreonContext?.userInfo?.userName ?? null);
  const forceAnonymous = signedInUserName === null;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [likeCountsByCommentId, setLikeCountsByCommentId] = useState<Record<CommentId, number>>({});
  const [commentsLikedByUser, setCommentsLikedByUser] = useState<Set<CommentId>>(() => new Set<CommentId>());
  const [replyingToCommentId, setReplyingToCommentId] = useState<CommentId | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<CommentId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedCommentsLikedByUserRef = useRef<Set<CommentId>>(new Set<CommentId>());
  const pendingLikeStatesRef = useRef(new Map<CommentId, boolean>());
  const likeDebounceTimersRef = useRef(new Map<CommentId, number>());

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadedComments = await loadCommentsForPage(pageLocationId, signedInUserName);
        if (cancelled) {
          return;
        }

        setThreads(loadedComments.threads);
        setLikeCountsByCommentId(loadedComments.likeCountsByCommentId);
        setCommentsLikedByUser(new Set(loadedComments.commentsLikedByUserSet));
        syncedCommentsLikedByUserRef.current = new Set(loadedComments.commentsLikedByUserSet);
        pendingLikeStatesRef.current.clear();
        for (const timerId of likeDebounceTimersRef.current.values()) {
          window.clearTimeout(timerId);
        }
        likeDebounceTimersRef.current.clear();
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Could not load comments.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [pageLocationId, signedInUserName]);

  useEffect(() => {
    const likeDebounceTimers = likeDebounceTimersRef.current;

    return () => {
      for (const timerId of likeDebounceTimers.values()) {
        window.clearTimeout(timerId);
      }
      likeDebounceTimers.clear();
    };
  }, []);

  const commentCount = useMemo(() => countThreadComments(threads), [threads]);

  const applyThreadsResponse = (nextThreads: Thread[]) => {
    setThreads(nextThreads);
  };

  const findComment = (commentId: CommentId) => {
    for (const thread of threads) {
      const comment = thread.commentsById[commentId];
      if (comment) {
        return { thread, comment };
      }
    }

    return null;
  };

  const handleStartThread = async (text: string, commentAnonymously: boolean) => {
    const commentId = createCommentId();
    const userName = forceAnonymous || commentAnonymously ? null : signedInUserName;
    const rootComment = createComment(text, userName);

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'start-thread',
        locationId: pageLocationId,
        rootCommentId: commentId,
        commentsById: {
          [commentId]: rootComment,
        },
      });

      if (response.type === 'threads-updated') {
        applyThreadsResponse(response.threads);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (text: string, commentAnonymously: boolean, replyingTo: CommentId) => {
    const commentId = createCommentId();
    const userName = forceAnonymous || commentAnonymously ? null : signedInUserName;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'upsert-comment',
        commentId,
        replyingTo,
        comment: createComment(text, userName),
      });

      if (response.type === 'threads-updated') {
        applyThreadsResponse(response.threads);
        setReplyingToCommentId(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not post reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (text: string, commentAnonymously: boolean, commentId: CommentId) => {
    const existing = findComment(commentId);
    if (!existing) {
      setError('Could not find comment to edit.');
      return;
    }

    const userName = forceAnonymous || commentAnonymously ? null : signedInUserName;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'upsert-comment',
        commentId,
        replyingTo: commentId,
        comment: {
          ...existing.comment,
          text,
          userName,
          timestamp: Date.now(),
        },
      });

      if (response.type === 'threads-updated') {
        applyThreadsResponse(response.threads);
        setEditingCommentId(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not edit comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: CommentId) => {
    const confirmed = window.confirm('Delete this comment and all replies to it?');
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'delete-comment',
        commentId,
        wasReplyingTo: commentId,
      });

      if (response.type === 'threads-updated') {
        applyThreadsResponse(response.threads);
        if (replyingToCommentId === commentId) {
          setReplyingToCommentId(null);
        }
        if (editingCommentId === commentId) {
          setEditingCommentId(null);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async ({ commentId, shouldLike }: { commentId: CommentId; shouldLike: boolean }) => {
    if (!signedInUserName) {
      return;
    }

    const previousLikedByUser = commentsLikedByUser.has(commentId);
    if (previousLikedByUser === shouldLike) {
      return;
    }

    setError(null);
    setCommentsLikedByUser((previousSet) => {
      const nextSet = new Set(previousSet);
      if (shouldLike) {
        nextSet.add(commentId);
      } else {
        nextSet.delete(commentId);
      }
      return nextSet;
    });
    setLikeCountsByCommentId((previousCounts) => ({
      ...previousCounts,
      [commentId]: Math.max(0, (previousCounts[commentId] ?? 0) + (shouldLike ? 1 : -1)),
    }));

    pendingLikeStatesRef.current.set(commentId, shouldLike);

    const existingTimer = likeDebounceTimersRef.current.get(commentId);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      void flushPendingLike(commentId, signedInUserName);
    }, LIKE_MUTATION_DEBOUNCE_MS);
    likeDebounceTimersRef.current.set(commentId, timerId);
  };

  const flushPendingLike = async (commentId: CommentId, userName: string) => {
    const desiredLikedState = pendingLikeStatesRef.current.get(commentId);
    if (desiredLikedState === undefined) {
      return;
    }

    pendingLikeStatesRef.current.delete(commentId);
    const timerId = likeDebounceTimersRef.current.get(commentId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      likeDebounceTimersRef.current.delete(commentId);
    }

    const syncedLikedState = syncedCommentsLikedByUserRef.current.has(commentId);
    if (desiredLikedState === syncedLikedState) {
      return;
    }

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: desiredLikedState ? 'add-comment-like' : 'remove-comment-like',
        commentId,
        userName,
      });

      if (response.type !== 'comment-liked-users-updated') {
        return;
      }

      syncedCommentsLikedByUserRef.current = new Set(syncedCommentsLikedByUserRef.current);
      if (desiredLikedState) {
        syncedCommentsLikedByUserRef.current.add(commentId);
      } else {
        syncedCommentsLikedByUserRef.current.delete(commentId);
      }
      setLikeCountsByCommentId((previousCounts) => ({
        ...previousCounts,
        [commentId]: response.likeCount,
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update like.');
    }
  };

  return (
    <section className={`mx-auto w-full max-w-3xl space-y-5 ${className ?? ''}`}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-950">
          {commentCount} Comment{commentCount === 1 ? '' : 's'}
        </h2>
        {isLoading ? <span className="text-sm text-slate-500">Loading...</span> : null}
      </header>

      <CommentInput disabled={isSubmitting} forceAnonymous={forceAnonymous} onSubmit={handleStartThread} />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-5">
        {threads.map((thread) => (
          <ThreadView
            key={thread.rootCommentId}
            thread={thread}
            signedInUserName={signedInUserName}
            likeCountsByCommentId={likeCountsByCommentId}
            commentsLikedByUser={commentsLikedByUser}
            actionsDisabled={isSubmitting}
            onReply={({ replyToCommentId }) => {
              setEditingCommentId(null);
              setReplyingToCommentId(replyToCommentId);
            }}
            onToggleLike={signedInUserName ? (action) => void handleToggleLike(action) : undefined}
            onEdit={({ commentId }) => {
              setReplyingToCommentId(null);
              setEditingCommentId(commentId);
            }}
            onDelete={({ commentId }) => void handleDelete(commentId)}
            renderAfterComment={(commentId) =>
              editingCommentId === commentId ? (
                <div className="mt-3 pl-2">
                  <CommentInput
                    autoFocus
                    disabled={isSubmitting}
                    forceAnonymous={forceAnonymous}
                    initialText={findComment(commentId)?.comment.text ?? ''}
                    placeholder="Edit your comment..."
                    submitLabel="Comment"
                    onCancel={() => setEditingCommentId(null)}
                    onSubmit={(text, commentAnonymously) => handleEdit(text, commentAnonymously, commentId)}
                  />
                </div>
              ) : replyingToCommentId === commentId ? (
                <div className="mt-3 pl-2">
                  <CommentInput
                    autoFocus
                    disabled={isSubmitting}
                    forceAnonymous={forceAnonymous}
                    placeholder="Add a reply..."
                    submitLabel="Reply"
                    onCancel={() => setReplyingToCommentId(null)}
                    onSubmit={(text, commentAnonymously) => handleReply(text, commentAnonymously, commentId)}
                  />
                </div>
              ) : null
            }
          />
        ))}
      </div>
    </section>
  );
};
