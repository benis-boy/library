import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SourceType } from '../constants';
import {
  AccessDeniedReason,
  BookSelectionResult,
  ChapterSelectionResult,
  clearLegacyChapterEncryptionKeys,
  getStoredChapterSelection,
  getStoredSelectedBook,
  isLibrarySelectionStorageKey,
  LibraryContext,
  LibraryContextType,
  LibraryData,
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

const emitLoadFirstChapterEvent = (book: SourceType) => {
  const event = new CustomEvent('loadFirstChapter', { detail: { book } });
  window.dispatchEvent(event);
};

const emitLoadedChapterEvent = () => {
  const loadedEvent = new CustomEvent('loadedNewChapter', {
    detail: { message: 'Next chapter loaded' },
  });
  window.dispatchEvent(loadedEvent);
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

  const resolveChapterSecuredFromNavigator = useCallback(async (book: SourceType, chapter: string) => {
    try {
      const response = await fetch(`navigation-data/${book}_navigation.html`);
      if (!response.ok) {
        return undefined;
      }

      const html = await response.text();
      const escapedChapter = chapter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const chapterRegex = new RegExp(`loadContent\\('${escapedChapter}'(?:,\\s*(true|false))?\\)`);
      const match = html.match(chapterRegex);
      if (!match) {
        return undefined;
      }

      return match[1] === 'true';
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
    setLibraryData((old) => {
      if (old.selectedBook === book && old.selectedChapter === chapter && old.isSecured === isSecured) {
        return old;
      }

      return {
        ...old,
        selectedBook: book,
        selectedChapter: chapter,
        isSecured,
      };
    });

    setStoredSelectedBook(book);
    if (chapter) {
      setStoredChapterSelection(book, chapter);
    }
  }, []);

  const setSelectedChapter = useCallback(
    async (book: SourceType, chapter: string, secured?: boolean): Promise<ChapterSelectionResult> => {
      let effectiveSecured = secured;
      if (typeof effectiveSecured !== 'boolean') {
        const resolved = await resolveChapterSecuredFromNavigator(book, chapter);
        effectiveSecured = resolved === true;
      }

      setSelection(book, chapter, effectiveSecured);

      const deniedReason = getAccessDeniedReason(effectiveSecured);
      if (deniedReason) {
        return { ok: false, reason: deniedReason };
      }

      await loadContent(book, chapter, effectiveSecured);
      emitLoadedChapterEvent();
      return { ok: true };
    },
    [getAccessDeniedReason, loadContent, resolveChapterSecuredFromNavigator, setSelection]
  );

  const setSelectedBook = useCallback(
    async (book: SourceType, loadChapterToo: boolean): Promise<BookSelectionResult> => {
      const chapterSelection = getStoredChapterSelection(book);
      setSelection(book, chapterSelection, undefined);

      if (!loadChapterToo) {
        return { ok: true, mode: 'selected_only' };
      }

      if (!chapterSelection) {
        emitLoadFirstChapterEvent(book);
        return { ok: true, mode: 'requested_first_chapter' };
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
