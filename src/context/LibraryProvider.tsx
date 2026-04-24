import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SourceType } from '../constants';
import {
  AccessDeniedReason,
  BookSelectionResult,
  ChapterSelectionResult,
  clearLegacyChapterEncryptionKeys,
  getChapterSecurityForBook,
  getFirstChapterForBook,
  getStoredChapterSelection,
  getStoredSelectedBook,
  isLibrarySelectionStorageKey,
  LibraryContext,
  LibraryContextType,
  LibraryData,
  normalizeChapterPath,
  setStoredChapterSelection,
  setStoredSelectedBook,
  useLoadContent,
} from './LibraryContext';
import { PatreonContext } from './PatreonContext';

const getStoredLibrarySelection = () => {
  const selectedBook = getStoredSelectedBook();
  const chapterSelection = getStoredChapterSelection(selectedBook);

  return {
    selectedBook,
    selectedChapter: chapterSelection,
    isSecured: undefined,
  };
};

const buildInitialLibraryData = (): LibraryData => {
  const { selectedBook, selectedChapter, isSecured } = getStoredLibrarySelection();

  return {
    selectedBook,
    selectedChapter,
    isSecured,
    content: '',
  };
};

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const pContext = useContext(PatreonContext);

  const [libraryData, setLibraryData] = useState<LibraryData>(() => buildInitialLibraryData());

  useEffect(() => {
    clearLegacyChapterEncryptionKeys();
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
          old.isSecured === selection.isSecured
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
      if (old.content === data) {
        return old;
      }

      return { ...old, content: data };
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

  const setSelection = useCallback((book: SourceType, chapter: string | undefined, isSecured: boolean | undefined) => {
    const normalizedChapter = normalizeChapterPath(chapter);
    setLibraryData((old) => {
      if (old.selectedBook === book && old.selectedChapter === normalizedChapter && old.isSecured === isSecured) {
        return old;
      }

      return {
        ...old,
        selectedBook: book,
        selectedChapter: normalizedChapter,
        isSecured,
      };
    });

    setStoredSelectedBook(book);
    if (normalizedChapter) {
      setStoredChapterSelection(book, normalizedChapter);
    }
  }, []);

  const setSelectedChapter = useCallback(
    async (book: SourceType, chapter: string, secured?: boolean): Promise<ChapterSelectionResult> => {
      const normalizedChapter = normalizeChapterPath(chapter);
      if (!normalizedChapter) {
        return { ok: true };
      }

      let effectiveSecured = secured;
      if (typeof effectiveSecured !== 'boolean') {
        const resolved = await resolveChapterSecuredFromMetadata(book, normalizedChapter);
        effectiveSecured = resolved === true;
      }

      setSelection(book, normalizedChapter, effectiveSecured);

      const deniedReason = getAccessDeniedReason(effectiveSecured);
      if (deniedReason) {
        return { ok: false, reason: deniedReason };
      }

      await loadContent(book, normalizedChapter, effectiveSecured);
      return { ok: true };
    },
    [getAccessDeniedReason, loadContent, resolveChapterSecuredFromMetadata, setSelection]
  );

  const setSelectedBook = useCallback(
    async (book: SourceType, loadChapterToo: boolean): Promise<BookSelectionResult> => {
      const chapterSelection = getStoredChapterSelection(book);
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
