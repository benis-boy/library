import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  isLibrarySelectionStorageKey,
  LibraryContext,
  LibraryContextType,
  LibraryData,
  normalizeChapterReference,
  setStoredChapterSelection,
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

const buildInitialLibraryData = (): LibraryData => {
  const { selectedBook, selectedChapter, isSecured, accessDeniedReason } = getStoredLibrarySelection();

  return {
    selectedBook,
    selectedChapter,
    isSecured,
    accessDeniedReason,
    content: '',
  };
};

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const pContext = useContext(PatreonContext);

  const [libraryData, setLibraryData] = useState<LibraryData>(() => buildInitialLibraryData());

  const clearContent = useCallback(() => {
    setLibraryData((old) => {
      if (!old.content) {
        return old;
      }

      return { ...old, content: '' };
    });
  }, []);

  useEffect(() => {
    clearLegacyChapterEncryptionKeys();
  }, []);

  useEffect(() => {
    const handleAppStorageCleared = () => {
      setLibraryData(buildInitialLibraryData());
    };

    window.addEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    return () => {
      window.removeEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return;
      }

      if (!event.key) {
        return;
      }

      if (!isLibrarySelectionStorageKey(event.key)) {
        return;
      }

      const selection = getStoredLibrarySelection();
      setLibraryData((old) => {
        if (
          old.selectedBook === selection.selectedBook &&
          old.selectedChapter === selection.selectedChapter &&
          old.isSecured === selection.isSecured &&
          old.accessDeniedReason === selection.accessDeniedReason
        ) {
          return old;
        }

        return {
          ...old,
          ...selection,
        };
      });
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleLoadedContent = useCallback((data: string) => {
    setLibraryData((old) => {
      if (old.content === data && old.accessDeniedReason === null) {
        return old;
      }

      return { ...old, content: data, accessDeniedReason: null };
    });
  }, []);

  const loadContent = useLoadContent(handleLoadedContent);

  const resolveChapterSecuredFromMetadata = useCallback(async (book: SourceType, chapter: string) => {
    try {
      return await getChapterSecurityForBook(book, chapter);
    } catch {
      return undefined;
    }
  }, []);

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

  const setSelection = useCallback(
    (book: SourceType, chapter: string | undefined, isSecured: boolean | undefined, accessDeniedReason: AccessDeniedReason | null = null) => {
      const normalizedChapter = normalizeChapterReference(chapter);
      setLibraryData((old) => {
        if (
          old.selectedBook === book &&
          old.selectedChapter === normalizedChapter &&
          old.isSecured === isSecured &&
          old.accessDeniedReason === accessDeniedReason
        ) {
          return old;
        }

        return {
          ...old,
          selectedBook: book,
          selectedChapter: normalizedChapter,
          isSecured,
          accessDeniedReason,
        };
      });

      setStoredSelectedBook(book);
      if (normalizedChapter) {
        setStoredChapterSelection(book, normalizedChapter);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const selectedChapter = libraryData.selectedChapter;
    if (!selectedChapter) {
      return;
    }

    void getChapterRouteParameterForBook(libraryData.selectedBook, selectedChapter)
      .then((canonicalChapter) => {
        if (cancelled || !canonicalChapter || canonicalChapter === selectedChapter) {
          return;
        }

        setSelection(libraryData.selectedBook, canonicalChapter, libraryData.isSecured, libraryData.accessDeniedReason);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [libraryData.accessDeniedReason, libraryData.isSecured, libraryData.selectedBook, libraryData.selectedChapter, setSelection]);

  useEffect(() => {
    setLibraryData((old) => {
      if (old.accessDeniedReason === null) {
        return old;
      }

      if (old.accessDeniedReason === 'login_required' && !pContext?.isLoggedIn) {
        return old;
      }

      if (old.accessDeniedReason === 'supporter_required' && !pContext?.isSupporter) {
        return old;
      }

      return {
        ...old,
        accessDeniedReason: null,
      };
    });
  }, [pContext?.isLoggedIn, pContext?.isSupporter]);

  const setSelectedChapter = useCallback(
    async (book: SourceType, chapter: string, secured?: boolean): Promise<ChapterSelectionResult> => {
      const normalizedChapter = normalizeChapterReference(chapter);
      if (!normalizedChapter) {
        return { ok: true };
      }

      const canonicalChapter = await getChapterRouteParameterForBook(book, normalizedChapter).catch(() => normalizedChapter);
      const resolvedChapterPath = await getResolvedChapterPathForBook(book, normalizedChapter).catch(() => undefined);
      const contentVersion = await getChapterContentVersionForBook(book, normalizedChapter).catch(() => undefined);
      const selectedChapterReference = canonicalChapter || normalizedChapter;
      const contentChapterPath = resolvedChapterPath || normalizedChapter;

      let effectiveSecured = secured;
      if (typeof effectiveSecured !== 'boolean') {
        const resolved = await resolveChapterSecuredFromMetadata(book, selectedChapterReference);
        effectiveSecured = resolved === true;
      }

      const deniedReason = getAccessDeniedReason(effectiveSecured);
      if (deniedReason) {
        setSelection(book, selectedChapterReference, effectiveSecured, deniedReason);
        clearContent();
        return { ok: false, reason: deniedReason };
      }

      setSelection(book, selectedChapterReference, effectiveSecured, null);
      await loadContent(book, contentChapterPath, effectiveSecured, contentVersion);
      return { ok: true };
    },
    [clearContent, getAccessDeniedReason, loadContent, resolveChapterSecuredFromMetadata, setSelection]
  );

  const setSelectedBook = useCallback(
    async (book: SourceType, loadChapterToo: boolean): Promise<BookSelectionResult> => {
      const chapterSelection = getStoredSelectedChapter(book);
      setSelection(book, chapterSelection, undefined);

      if (!loadChapterToo) {
        return { ok: true, mode: 'selected_only' };
      }

      if (!chapterSelection) {
        const firstChapter = await getFirstChapterForBook(book).catch(() => undefined);
        if (!firstChapter) {
          return { ok: true, mode: 'selected_only' };
        }

        const chapterResult = await setSelectedChapter(book, firstChapter.chapter, firstChapter.isSecured);
        if (!chapterResult.ok) {
          return chapterResult;
        }

        return { ok: true, mode: 'loaded_chapter' };
      }

      const chapterResult = await setSelectedChapter(book, chapterSelection);
      if (!chapterResult.ok) {
        return chapterResult;
      }

      return { ok: true, mode: 'loaded_stored_chapter' };
    },
    [setSelectedChapter, setSelection]
  );

  const value = useMemo<LibraryContextType>(
    () => ({
      libraryData,
      setSelectedBook,
      setSelectedChapter,
    }),
    [libraryData, setSelectedBook, setSelectedChapter]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};
