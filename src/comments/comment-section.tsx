import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { PatreonContext } from '../context/PatreonContext';
import { Thread as ThreadView } from './comments';
import { fetchCommentReactions, fetchThreadsForLocation, fetchThreadsForPage, sendThreadMutation } from './comments-api';
import {
  Comment,
  CommentId,
  COMMENT_MEDIA_URL_MAX_LENGTH,
  COMMENT_TEXT_MAX_LENGTH,
  CommentReactions,
  MutationOwner,
  PageLocationId,
  Thread,
  ThreadLocationId,
  toPageLocationId,
} from './dataModel';
import { EmbeddedMediaInput } from './embedded-media-input';

type CommentInputProps = {
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  forceAnonymous?: boolean;
  initialText?: string;
  initialImageUrl?: string | null;
  embedded?: boolean;
  onCancel?: () => void;
  onSubmit: (text: string, commentAnonymously: boolean, imageUrl: string | null) => Promise<void> | void;
};

export type CommentSectionProps = {
  locationId: PageLocationId | ThreadLocationId;
  className?: string;
  header?: ReactNode;
  hideDefaultHeader?: boolean;
  onCommentCountChange?: (commentCount: number) => void;
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
  if ('paragraphLocation' in locationId) {
    return toPageLocationId(locationId);
  }

  return locationId;
};

const createComment = (text: string, userName: string | null, imageUrl: string | null): Comment => ({
  timestamp: Date.now(),
  userName,
  text,
  imageUrl,
  replyIds: [],
});

type LoadedComments = {
  threads: Thread[];
  reactionsByCommentId: Record<CommentId, CommentReactions>;
};

type FlushPendingReactions = (options?: { keepalive?: boolean }) => void;

const commentLoadCache = new Map<string, { cachedAt: number; promise: Promise<LoadedComments> }>();
const COMMENT_LOAD_CACHE_MS = 1000;
const REACTION_MUTATION_DEBOUNCE_MS = 5000;
const COMMENT_LIMIT_WARNING_THRESHOLD = 0.9;

const getLocationLoadCacheKey = (locationId: PageLocationId | ThreadLocationId, signedInUserName: string | null) => {
  const paragraphPart = 'paragraphLocation' in locationId && locationId.paragraphLocation ? JSON.stringify(locationId.paragraphLocation) : 'chapter';
  return `${locationId.bookId}:${locationId.chapterId}:${paragraphPart}:${signedInUserName ?? 'anonymous'}`;
};

const loadCommentsForLocation = (locationId: PageLocationId | ThreadLocationId, signedInUserName: string | null) => {
  const cacheKey = getLocationLoadCacheKey(locationId, signedInUserName);
  const cached = commentLoadCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.cachedAt < COMMENT_LOAD_CACHE_MS) {
    return cached.promise;
  }

  const promise = (async (): Promise<LoadedComments> => {
    const threadsResponse = 'paragraphLocation' in locationId && locationId.paragraphLocation
      ? await fetchThreadsForLocation(locationId)
      : await fetchThreadsForPage(locationId);
    const commentIds = getThreadCommentIds(threadsResponse.threads);
    if (commentIds.length === 0) {
      return {
        threads: threadsResponse.threads,
        reactionsByCommentId: {},
      };
    }

    const reactionsResponse = await fetchCommentReactions(commentIds);
    return {
      threads: threadsResponse.threads,
      reactionsByCommentId: reactionsResponse.reactionsByCommentId,
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
  initialImageUrl = null,
  embedded = false,
  onCancel,
  onSubmit,
}: CommentInputProps) => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const [text, setText] = useState(initialText);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [isFocused, setIsFocused] = useState(autoFocus);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [commentAnonymously, setCommentAnonymously] = useState(forceAnonymous);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const showActions = isFocused || text.trim().length > 0;
  const textLength = text.length;
  const imageUrlLength = imageUrl?.length ?? 0;
  const isTextLimitVisible = textLength >= COMMENT_TEXT_MAX_LENGTH * COMMENT_LIMIT_WARNING_THRESHOLD;
  const isImageUrlLimitVisible = imageUrlLength >= COMMENT_MEDIA_URL_MAX_LENGTH * COMMENT_LIMIT_WARNING_THRESHOLD;
  const isTextOverLimit = textLength > COMMENT_TEXT_MAX_LENGTH;
  const isImageUrlOverLimit = imageUrlLength > COMMENT_MEDIA_URL_MAX_LENGTH;

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    setImageUrl(initialImageUrl);
  }, [initialImageUrl]);

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

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!emojiPickerRef.current || emojiPickerRef.current.contains(event.target as Node)) {
        return;
      }

      setIsEmojiPickerOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isEmojiPickerOpen]);

  const insertEmoji = (emoji: string) => {
    if (disabled) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      setText((previousText) => `${previousText}${emoji}`);
      return;
    }

    const selectionStart = textarea.selectionStart ?? text.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextText = `${text.slice(0, selectionStart)}${emoji}${text.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + emoji.length;

    setText(nextText);
    setIsFocused(true);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleCancel = () => {
    setText('');
    setImageUrl(initialImageUrl);
    setCommentAnonymously(forceAnonymous);
    setIsFocused(false);
    setIsEmojiPickerOpen(false);
    onCancel?.();
  };

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || disabled || isTextOverLimit || isImageUrlOverLimit) {
      return;
    }

    await onSubmit(trimmedText, commentAnonymously, imageUrl);
    setText('');
    setImageUrl(null);
    setCommentAnonymously(forceAnonymous);
    setIsFocused(false);
    setIsEmojiPickerOpen(false);
  };

  const commentInputClass = `block max-h-48 min-h-10 w-full resize-none overflow-hidden border-0 border-b bg-transparent px-0 py-2 text-sm leading-6 focus:outline-none focus:ring-0 disabled:opacity-60 ${
    isDarkMode
      ? 'border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-slate-200'
      : 'border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-900'
  }`;

  return (
    <div
      className={
        embedded
          ? 'bg-transparent'
          : `rounded-2xl border p-3 shadow-sm transition-colors ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900 focus-within:border-slate-500'
                : 'border-transparent bg-white focus-within:border-slate-200'
            }`
      }
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => setText(event.target.value)}
        className={commentInputClass}
      />

      {isTextLimitVisible ? (
        <div
          className={`mt-1 text-xs ${isTextOverLimit ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
        >
          {textLength}/{COMMENT_TEXT_MAX_LENGTH} characters
        </div>
      ) : null}

      {imageUrl ? (
        <div
          className={`mt-3 w-fit max-w-full rounded-xl border p-2 ${
            isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <img src={imageUrl} alt="Attached media preview" className="max-h-60 max-w-full rounded-lg object-contain" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setImageUrl(null)}
            className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Remove image
          </button>
          {isImageUrlLimitVisible ? (
            <div
              className={`mt-2 text-xs ${isImageUrlOverLimit ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
            >
              Media URL: {imageUrlLength}/{COMMENT_MEDIA_URL_MAX_LENGTH} characters
            </div>
          ) : null}
        </div>
      ) : null}

      {showActions ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <EmbeddedMediaInput disabled={disabled} onAttach={setImageUrl} />
            <div ref={emojiPickerRef} className="relative">
              <button
                type="button"
                aria-label="Add emoji"
                aria-expanded={isEmojiPickerOpen}
                disabled={disabled}
                onClick={() => setIsEmojiPickerOpen((isOpen) => !isOpen)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <span aria-hidden="true">😊</span>
              </button>
              {isEmojiPickerOpen ? (
                <div className="absolute left-0 top-11 z-20 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl shadow-xl">
                  <EmojiPicker
                    height={400}
                    width={320}
                    lazyLoadEmojis
                    theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
                    onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
                  />
                </div>
              ) : null}
            </div>
            <label
              className={`flex cursor-pointer items-center gap-2 text-xs font-medium ${
                isDarkMode ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={commentAnonymously}
                disabled={disabled || forceAnonymous}
                onChange={(event) => setCommentAnonymously(event.target.checked)}
                className={`h-4 w-4 ml-2 rounded ${isDarkMode ? 'border-slate-500 text-slate-100' : 'border-slate-300 text-slate-900'}`}
              />
              Comment Anonymously
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={disabled}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={disabled || text.trim().length === 0 || isTextOverLimit || isImageUrlOverLimit}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                isDarkMode
                  ? 'bg-slate-100 text-slate-950 hover:bg-white disabled:bg-slate-700 disabled:text-slate-400'
                  : 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-300'
              }`}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const CommentSection = ({ locationId, className, header, hideDefaultHeader = false, onCommentCountChange }: CommentSectionProps) => {
  const patreonContext = useContext(PatreonContext);
  const { isDarkMode } = useContext(ConfigurationContext);
  const pageLocationId = useMemo(() => normalizePageLocation(locationId), [locationId]);
  const locationLoadKey = useMemo(() => getLocationLoadCacheKey(locationId, null), [locationId]);
  const signedInUserName = isLocalLibraryUrl()
    ? 'B. Warnecke'
    : patreonContext?.isLoggedIn
      ? (patreonContext.userInfo?.userName ?? null)
      : null;
  const signedUser = isLocalLibraryUrl()
    ? (import.meta.env.VITE_LOCAL_ADMIN_SIGNED ?? null)
    : patreonContext?.isLoggedIn
      ? (patreonContext?.signedUser ?? null)
      : null;
  const canUseSignedIdentity = signedInUserName !== null && signedUser !== null;
  const forceAnonymous = !canUseSignedIdentity;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [reactionsByCommentId, setReactionsByCommentId] = useState<Record<CommentId, CommentReactions>>({});
  const [replyingToCommentId, setReplyingToCommentId] = useState<CommentId | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<CommentId | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<CommentId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedReactionsByCommentIdRef = useRef<Record<CommentId, CommentReactions>>({});
  const pendingReactionEmojisByCommentIdRef = useRef(new Map<CommentId, Set<string>>());
  const reactionDebounceTimersRef = useRef(new Map<CommentId, number>());
  const signedInUserNameRef = useRef<string | null>(signedInUserName);
  const pageLocationIdRef = useRef(pageLocationId);
  const flushPendingReactionsRef = useRef<FlushPendingReactions>(() => {});

  useEffect(() => {
    signedInUserNameRef.current = signedInUserName;
  }, [signedInUserName]);

  useEffect(() => {
    pageLocationIdRef.current = pageLocationId;
  }, [pageLocationId]);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadedComments = await loadCommentsForLocation(locationId, signedInUserName);
        if (cancelled) {
          return;
        }

        setThreads(loadedComments.threads);
        setReactionsByCommentId(loadedComments.reactionsByCommentId);
        syncedReactionsByCommentIdRef.current = loadedComments.reactionsByCommentId;
        pendingReactionEmojisByCommentIdRef.current.clear();
        for (const timerId of reactionDebounceTimersRef.current.values()) {
          window.clearTimeout(timerId);
        }
        reactionDebounceTimersRef.current.clear();
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
  }, [locationId, locationLoadKey, signedInUserName]);

  useEffect(() => {
    const reactionDebounceTimers = reactionDebounceTimersRef.current;

    const flushReactions = (options?: { keepalive?: boolean }) => {
      flushPendingReactionsRef.current(options);
    };

    const flushBeforePageLeaves = () => {
      flushReactions({ keepalive: true });
    };

    window.addEventListener('pagehide', flushBeforePageLeaves);
    window.addEventListener('beforeunload', flushBeforePageLeaves);

    return () => {
      window.removeEventListener('pagehide', flushBeforePageLeaves);
      window.removeEventListener('beforeunload', flushBeforePageLeaves);
      flushReactions({ keepalive: true });
      for (const timerId of reactionDebounceTimers.values()) {
        window.clearTimeout(timerId);
      }
      reactionDebounceTimers.clear();
    };
  }, []);

  const commentCount = useMemo(() => countThreadComments(threads), [threads]);

  useEffect(() => {
    onCommentCountChange?.(commentCount);
  }, [commentCount, onCommentCountChange]);

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

  const getMutationOwner = (commentAnonymously = false): MutationOwner => {
    if (commentAnonymously || !signedInUserName || !signedUser) {
      return null;
    }

    return { userName: signedInUserName, signedUser };
  };

  const handleStartThread = async (text: string, commentAnonymously: boolean, imageUrl: string | null) => {
    const commentId = createCommentId();
    const mutationOwner = getMutationOwner(commentAnonymously);
    const userName = mutationOwner?.userName ?? null;
    const rootComment = createComment(text, userName, imageUrl);

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'start-thread',
        mutationOwner,
        locationId,
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

  const handleReply = async (
    text: string,
    commentAnonymously: boolean,
    imageUrl: string | null,
    replyingTo: CommentId
  ) => {
    const commentId = createCommentId();
    const mutationOwner = getMutationOwner(commentAnonymously);
    const userName = mutationOwner?.userName ?? null;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'upsert-comment',
        mutationOwner,
        commentId,
        replyingTo,
        comment: createComment(text, userName, imageUrl),
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

  const handleEdit = async (
    text: string,
    commentAnonymously: boolean,
    imageUrl: string | null,
    commentId: CommentId
  ) => {
    const existing = findComment(commentId);
    if (!existing) {
      setError('Could not find comment to edit.');
      return;
    }

    const mutationOwner = getMutationOwner(commentAnonymously);
    const userName = mutationOwner?.userName ?? null;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'upsert-comment',
        mutationOwner,
        commentId,
        replyingTo: commentId,
        comment: {
          ...existing.comment,
          text,
          userName,
          imageUrl,
          updated: true,
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
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await sendThreadMutation(pageLocationId, {
        type: 'delete-comment',
        mutationOwner: getMutationOwner(false),
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
        setPendingDeleteCommentId(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleToggleReaction = async ({
    commentId,
    emoji,
    shouldAdd,
  }: {
    commentId: CommentId;
    emoji: string;
    shouldAdd: boolean;
  }) => {
    if (!canUseSignedIdentity) {
      return;
    }

    const previousReactedByUser = reactionsByCommentId?.[commentId]?.[emoji]?.includes(signedInUserName) ?? false;
    if (previousReactedByUser === shouldAdd) {
      return;
    }

    setError(null);
    setReactionsByCommentId((previousReactionsByCommentId) =>
      applyReactionState(previousReactionsByCommentId, commentId, emoji, signedInUserName, shouldAdd)
    );

    const currentReactionEmojis = new Set(
      Object.entries(reactionsByCommentId?.[commentId] ?? {})
        .filter(([, userNames]) => userNames.includes(signedInUserName))
        .map(([reactionEmoji]) => reactionEmoji)
    );
    if (shouldAdd) {
      currentReactionEmojis.add(emoji);
    } else {
      currentReactionEmojis.delete(emoji);
    }
    pendingReactionEmojisByCommentIdRef.current.set(commentId, currentReactionEmojis);

    const existingTimer = reactionDebounceTimersRef.current.get(commentId);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      void flushPendingReaction(commentId, signedInUserName);
    }, REACTION_MUTATION_DEBOUNCE_MS);
    reactionDebounceTimersRef.current.set(commentId, timerId);
  };

  const flushPendingReactions = (options?: { keepalive?: boolean }) => {
    const userName = signedInUserNameRef.current;
    if (!userName) {
      return;
    }

    for (const commentId of pendingReactionEmojisByCommentIdRef.current.keys()) {
      void flushPendingReaction(commentId, userName, options);
    }
  };

  flushPendingReactionsRef.current = flushPendingReactions;

  const flushPendingReaction = async (commentId: CommentId, userName: string, options?: { keepalive?: boolean }) => {
    const pendingReactionEmojis = pendingReactionEmojisByCommentIdRef.current.get(commentId);
    if (pendingReactionEmojis === undefined) {
      return;
    }

    pendingReactionEmojisByCommentIdRef.current.delete(commentId);
    const timerId = reactionDebounceTimersRef.current.get(commentId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      reactionDebounceTimersRef.current.delete(commentId);
    }

    const syncedReactionEmojis = new Set(
      Object.entries(syncedReactionsByCommentIdRef.current?.[commentId] ?? {})
        .filter(([, userNames]) => userNames.includes(userName))
        .map(([emoji]) => emoji)
    );
    const desiredEmojis = [...pendingReactionEmojis];
    if (
      desiredEmojis.length === syncedReactionEmojis.size &&
      desiredEmojis.every((emoji) => syncedReactionEmojis.has(emoji))
    ) {
      return;
    }

    try {
      const response = await sendThreadMutation(
        pageLocationIdRef.current,
        {
          type: 'set-comment-reactions',
          mutationOwner: { userName, signedUser: signedUser ?? '' },
          commentId,
          emojis: desiredEmojis,
          userName,
        },
        options
      );

      if (response.type !== 'comment-reactions-updated') {
        return;
      }

      syncedReactionsByCommentIdRef.current = {
        ...syncedReactionsByCommentIdRef.current,
        [commentId]: response.reactions,
      };
      setReactionsByCommentId((previousReactionsByCommentId) => ({
        ...previousReactionsByCommentId,
        [commentId]: response.reactions,
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update reaction.');
    }
  };

  return (
    <section className={`mx-auto w-full max-w-3xl ${className ?? ''}`}>
      {header ??
        (!hideDefaultHeader ? (
          <header className="flex items-center justify-between gap-1">
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              {isLoading ? '... Comments' : `${commentCount} Comment${commentCount === 1 ? '' : 's'}`}
            </h2>
            {isLoading ? (
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading...</span>
            ) : null}
          </header>
        ) : null)}

      <div className={hideDefaultHeader && !header ? 'pb-3' : 'py-3'}>
        <CommentInput disabled={isSubmitting} forceAnonymous={forceAnonymous} onSubmit={handleStartThread} />
      </div>

      {error ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode ? 'border-red-800 bg-red-950 text-red-200' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        {threads.map((thread) => (
          <ThreadView
            key={thread.rootCommentId}
            thread={thread}
            signedInUserName={signedInUserName}
            reactionsByCommentId={reactionsByCommentId}
            actionsDisabled={isSubmitting}
            onReply={({ replyToCommentId }) => {
              setEditingCommentId(null);
              setReplyingToCommentId(replyToCommentId);
            }}
            onToggleReaction={canUseSignedIdentity ? (action) => void handleToggleReaction(action) : undefined}
            onEdit={({ commentId }) => {
              setReplyingToCommentId(null);
              setEditingCommentId(commentId);
            }}
            onDelete={({ commentId }) => setPendingDeleteCommentId(commentId)}
            renderCommentEditor={(commentId) =>
              editingCommentId === commentId ? (
                <div className="mt-3">
                  <CommentInput
                    autoFocus
                    disabled={isSubmitting}
                    embedded
                    forceAnonymous={forceAnonymous}
                    initialText={findComment(commentId)?.comment.text ?? ''}
                    initialImageUrl={findComment(commentId)?.comment.imageUrl ?? null}
                    placeholder="Edit your comment..."
                    submitLabel="Comment"
                    onCancel={() => setEditingCommentId(null)}
                    onSubmit={(text, commentAnonymously, imageUrl) =>
                      handleEdit(text, commentAnonymously, imageUrl, commentId)
                    }
                  />
                </div>
              ) : null
            }
            renderAfterComment={(commentId) =>
              replyingToCommentId === commentId ? (
                <div className="mt-3 pl-2">
                  <CommentInput
                    autoFocus
                    disabled={isSubmitting}
                    forceAnonymous={forceAnonymous}
                    placeholder="Add a reply..."
                    submitLabel="Reply"
                    onCancel={() => setReplyingToCommentId(null)}
                    onSubmit={(text, commentAnonymously, imageUrl) =>
                      handleReply(text, commentAnonymously, imageUrl, commentId)
                    }
                  />
                </div>
              ) : null
            }
          />
        ))}
      </div>

      <Dialog
        open={pendingDeleteCommentId !== null}
        onClose={() => setPendingDeleteCommentId(null)}
        slotProps={{
          root: {
            sx: { zIndex: 2300 },
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
        <DialogTitle sx={isDarkMode ? { color: '#f1f5f9' } : undefined}>Delete comment?</DialogTitle>
        <DialogContent sx={isDarkMode ? { color: '#cbd5e1' } : undefined}>
          <DialogContentText sx={isDarkMode ? { color: '#cbd5e1' } : undefined}>
            This will delete the comment and every reply below it. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions
          sx={
            isDarkMode
              ? {
                  backgroundColor: 'rgba(2, 6, 23, 0.4)',
                  borderTop: '1px solid #1e293b',
                }
              : undefined
          }
        >
          <Button
            onClick={() => setPendingDeleteCommentId(null)}
            disabled={isSubmitting}
            sx={isDarkMode ? { color: '#cbd5e1', '&:hover': { backgroundColor: '#1e293b' } } : undefined}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={isSubmitting || pendingDeleteCommentId === null}
            sx={
              isDarkMode
                ? {
                    backgroundColor: '#b91c1c',
                    '&:hover': { backgroundColor: '#dc2626' },
                    '&.Mui-disabled': { backgroundColor: '#334155', color: '#94a3b8' },
                  }
                : undefined
            }
            onClick={() => {
              if (pendingDeleteCommentId) {
                void handleDelete(pendingDeleteCommentId);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
};
