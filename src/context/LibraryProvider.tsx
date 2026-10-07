import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SourceType } from '../constants';
import {
  AccessDeniedReason,
  BookSelectionResult,
  ChapterSelectionResult,
  clearLegacyChapterEncryptionKeys,
  getChapterContentVersionForBook,
  getChapterSecurityForBook,
  getFirstChapterForBook,
  getChapterRouteParameterForBook,
  getResolvedChapterPathForBook,
  getStoredSelectedBook,
  getStoredSelectedChapter,
  isAppStorageEvent,
  isLibrarySelectionStorageKey,
  LibraryContext,
  LibraryContextType,
  LibraryData,
  normalizeChapterReference,
  setStoredSelectedChapter,
  setStoredSelectedBook,
  useLoadContent,
} from './LibraryContext';
import { PatreonContext } from './PatreonContext';
import { APP_STORAGE_CLEARED_EVENT } from '../localStorageReset';

const getStoredLibrarySelection = () => {
  const selectedBook = getStoredSelectedBook();
  const chapterSelection = getStoredSelectedChapter(selectedBook);

  return {
    selectedBook,
    selectedChapter: chapterSelection,
    isSecured: undefined,
    accessDeniedReason: null,
  };
};

const buildInitialLibraryData = (): LibraryData => ({
  ...getStoredLibrarySelection(),
  content: '',
  isLoading: false,
  loadError: null,
});

type InFlightChapter = {
  requestId: number;
  key: string;
  promise: Promise<ChapterSelectionResult>;
};

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const pContext = useContext(PatreonContext);
  const [libraryData, setLibraryData] = useState<LibraryData>(() => buildInitialLibraryData());
  const nextRequestIdRef = useRef(0);
  const inFlightChapterRef = useRef<InFlightChapter | null>(null);
  const accessSignature = JSON.stringify([
    pContext?.isLoggedIn === true,
    pContext?.isSupporter === true,
    pContext?.encryptionPassword ?? '',
    Object.entries(pContext?.encryptionPasswordV2 ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  ]);
  const lastAccessSignatureRef = useRef(accessSignature);
  const handledAccessSignatureRef = useRef(accessSignature);
  if (lastAccessSignatureRef.current !== accessSignature) {
    lastAccessSignatureRef.current = accessSignature;
    // Invalidate synchronously during the auth/key render, before a pending fetch can commit.
    nextRequestIdRef.current += 1;
    inFlightChapterRef.current = null;
  }

  const invalidateRequests = useCallback(() => {
    nextRequestIdRef.current += 1;
    inFlightChapterRef.current = null;
  }, []);

  useEffect(() => {
    clearLegacyChapterEncryptionKeys();
  }, []);

  useEffect(() => {
    const handleAppStorageCleared = () => {
      invalidateRequests();
      setLibraryData(buildInitialLibraryData());
    };

    window.addEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    return () => window.removeEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
  }, [invalidateRequests]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isAppStorageEvent(event) || !event.key || !isLibrarySelectionStorageKey(event.key)) {
        return;
      }

      const selection = getStoredLibrarySelection();
      invalidateRequests();
      setLibraryData((old) => ({
        ...old,
        ...selection,
        content: '',
        isLoading: false,
        loadError: null,
      }));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [invalidateRequests]);

  const loadContent = useLoadContent();

  const getAccessDeniedReason = useCallback(
    (secured: boolean): AccessDeniedReason | null => {
      if (!secured) {
        return null;
      }

      if (!pContext?.isLoggedIn) {
        return 'login_required';
      }

      if (!pContext?.isSupporter) {
        return 'supporter_required';
      }

      return null;
    },
    [pContext?.isLoggedIn, pContext?.isSupporter]
  );
  const accessCheckRef = useRef(getAccessDeniedReason);
  accessCheckRef.current = getAccessDeniedReason;

  const beginSelection = useCallback((book: SourceType, chapter: string | undefined, secured?: boolean) => {
    const normalizedChapter = normalizeChapterReference(chapter);
    setLibraryData((old) => ({
      ...old,
      selectedBook: book,
      selectedChapter: normalizedChapter,
      content: '',
      isLoading: true,
      loadError: null,
      isSecured: secured,
      accessDeniedReason: null,
    }));
    setStoredSelectedBook(book);
    if (normalizedChapter) {
      setStoredSelectedChapter(book, normalizedChapter);
    }
  }, []);

  const setSelection = useCallback((
    book: SourceType,
    chapter: string | undefined,
    isSecured: boolean | undefined,
    accessDeniedReason: AccessDeniedReason | null
  ) => {
    const normalizedChapter = normalizeChapterReference(chapter);
    setLibraryData((old) => ({
      ...old,
      selectedBook: book,
      selectedChapter: normalizedChapter,
      isSecured,
      accessDeniedReason,
    }));
    setStoredSelectedBook(book);
    if (normalizedChapter) {
      setStoredSelectedChapter(book, normalizedChapter);
    }
  }, []);

  const markLoadFailure = useCallback((requestId: number, message: string) => {
    if (nextRequestIdRef.current !== requestId) {
      return;
    }

    setLibraryData((old) => ({
      ...old,
      content: '',
      isLoading: false,
      loadError: message || 'Unable to load this chapter. Please try again.',
      accessDeniedReason: null,
    }));
  }, []);

  const setSelectedChapter = useCallback(
    (book: SourceType, chapter: string, secured?: boolean): Promise<ChapterSelectionResult> => {
      const normalizedChapter = normalizeChapterReference(chapter);
      if (!normalizedChapter) {
        return Promise.resolve({ ok: true });
      }

      const key = `${book}:${normalizedChapter}`;
      const pending = inFlightChapterRef.current;
      if (pending?.key === key && pending.requestId === nextRequestIdRef.current) {
        return pending.promise;
      }

      const requestId = ++nextRequestIdRef.current;
      beginSelection(book, normalizedChapter, secured);

      const promise = (async (): Promise<ChapterSelectionResult> => {
        try {
          // The request owns the selection before any metadata or content await.
          const [canonicalChapter, resolvedChapterPath, contentVersion, metadataSecurity] = await Promise.all([
            getChapterRouteParameterForBook(book, normalizedChapter),
            getResolvedChapterPathForBook(book, normalizedChapter),
            getChapterContentVersionForBook(book, normalizedChapter),
            getChapterSecurityForBook(book, normalizedChapter),
          ]);

          if (nextRequestIdRef.current !== requestId) {
            return { ok: false, reason: 'superseded' };
          }

          const selectedChapterReference = canonicalChapter || normalizedChapter;
          const contentChapterPath = resolvedChapterPath || normalizedChapter;
          const effectiveSecured = typeof metadataSecurity === 'boolean' ? metadataSecurity : secured === true;
          const deniedReason = getAccessDeniedReason(effectiveSecured);

          if (deniedReason) {
            setSelection(book, selectedChapterReference, effectiveSecured, deniedReason);
            setLibraryData((old) => ({ ...old, content: '', isLoading: false, loadError: null }));
            return { ok: false, reason: deniedReason };
          }

          setSelection(book, selectedChapterReference, effectiveSecured, null);
          const data = await loadContent(book, contentChapterPath, effectiveSecured, contentVersion);
          if (nextRequestIdRef.current === requestId) {
            const currentDeniedReason = effectiveSecured ? accessCheckRef.current(true) : null;
            if (currentDeniedReason) {
              setSelection(book, selectedChapterReference, effectiveSecured, currentDeniedReason);
              setLibraryData((old) => ({ ...old, content: '', isLoading: false, loadError: null }));
              return { ok: false, reason: currentDeniedReason };
            }

            setLibraryData((old) => ({
              ...old,
              content: data,
              isLoading: false,
              loadError: null,
              accessDeniedReason: null,
            }));
          }
          return nextRequestIdRef.current === requestId ? { ok: true } : { ok: false, reason: 'superseded' };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to load this chapter. Please try again.';
          markLoadFailure(requestId, message);
          return nextRequestIdRef.current === requestId ? { ok: true } : { ok: false, reason: 'superseded' };
        }
      })();

      inFlightChapterRef.current = { requestId, key, promise };
      void promise.finally(() => {
        if (inFlightChapterRef.current?.requestId === requestId) {
          inFlightChapterRef.current = null;
        }
      });
      return promise;
    },
    [beginSelection, getAccessDeniedReason, loadContent, markLoadFailure, setSelection]
  );

  const setSelectedBook = useCallback(
    async (book: SourceType, loadChapterToo: boolean): Promise<BookSelectionResult | undefined> => {
      const chapterSelection = getStoredSelectedChapter(book);
      const requestId = ++nextRequestIdRef.current;
      inFlightChapterRef.current = null;

      if (!loadChapterToo) {
        setLibraryData((old) => ({
          ...old,
          selectedBook: book,
          selectedChapter: chapterSelection,
          content: '',
          isLoading: false,
          loadError: null,
          isSecured: undefined,
          accessDeniedReason: null,
        }));
        setStoredSelectedBook(book);
        return { ok: true, mode: 'selected_only' };
      }

      beginSelection(book, chapterSelection);
      let chapter = chapterSelection;
      let secured: boolean | undefined;
      if (!chapter) {
        try {
          const firstChapter = await getFirstChapterForBook(book);
          if (nextRequestIdRef.current !== requestId) {
            return undefined;
          }
          if (!firstChapter) {
            throw new Error(`No chapters are available for ${book}.`);
          }
          chapter = firstChapter.chapterId || firstChapter.chapter;
          secured = firstChapter.isSecured;
        } catch (error) {
          markLoadFailure(requestId, error instanceof Error ? error.message : 'Unable to load chapter metadata.');
          return { ok: true, mode: 'selected_only' };
        }
      }

      if (nextRequestIdRef.current !== requestId || !chapter) {
        return nextRequestIdRef.current !== requestId ? undefined : { ok: true, mode: 'selected_only' };
      }

      const chapterResult = await setSelectedChapter(book, chapter, secured);
      if (!chapterResult.ok) {
        return chapterResult.reason === 'superseded' ? undefined : chapterResult;
      }

      return { ok: true, mode: chapterSelection ? 'loaded_stored_chapter' : 'loaded_chapter' };
    },
    [beginSelection, markLoadFailure, setSelectedChapter]
  );

  useEffect(() => {
    if (handledAccessSignatureRef.current === accessSignature) {
      return;
    }
    handledAccessSignatureRef.current = accessSignature;

    const deniedReason = getAccessDeniedReason(true);
    setLibraryData((old) => {
      if (old.isSecured === true) {
        return {
          ...old,
          content: '',
          isLoading: false,
          loadError: null,
          accessDeniedReason: deniedReason,
        };
      }

      if (old.isLoading) {
        return {
          ...old,
          content: '',
          isLoading: false,
          loadError: null,
          accessDeniedReason: null,
        };
      }

      if (old.accessDeniedReason !== null) {
        return { ...old, accessDeniedReason: null };
      }

      return old;
    });
  }, [accessSignature, getAccessDeniedReason]);

  const value = useMemo<LibraryContextType>(
    () => {
      const currentDeniedReason = libraryData.isSecured === true ? getAccessDeniedReason(true) : null;
      const visibleLibraryData: LibraryData = currentDeniedReason
        ? {
            ...libraryData,
            content: '',
            isLoading: false,
            loadError: null,
            accessDeniedReason: currentDeniedReason,
          }
        : libraryData.accessDeniedReason !== null
          ? { ...libraryData, accessDeniedReason: null }
          : libraryData;
      return { libraryData: visibleLibraryData, setSelectedBook, setSelectedChapter };
    },
    [getAccessDeniedReason, libraryData, setSelectedBook, setSelectedChapter]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};
