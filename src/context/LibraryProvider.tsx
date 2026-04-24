import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SourceType } from '../constants';
import {
  getStoredChapterSelection,
  getStoredSelectedBook,
  isLibrarySelectionStorageKey,
  LIBRARY_SELECTED_BOOK_KEY,
  LibraryContext,
  LibraryContextType,
  LibraryData,
  LibraryPageType,
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
    selectedChapter: chapterSelection?.chapter,
    isSecured: chapterSelection?.isSecured,
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

  const [otherPageInfoType, setOtherPageInfoType] = useState<LibraryPageType>('homepage');
  const [libraryData, setLibraryData] = useState<LibraryData>(() => buildInitialLibraryData());

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
      setLibraryData((old) => ({
        ...old,
        ...selection,
      }));

      if (event.key === LIBRARY_SELECTED_BOOK_KEY) {
        setOtherPageInfoType('homepage');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const loadContent = useLoadContent((data) => {
    setLibraryData((old) => ({ ...old, content: data }));
  });

  const getBlockedPageForSecuredChapter = useCallback(
    (secured: boolean): LibraryPageType => {
      if (!secured) {
        return false;
      }

      if (!pContext?.isLoggedIn) {
        return 'not_logged_in';
      }

      if (!pContext?.isSupporter) {
        return 'not_a_supporter';
      }

      return false;
    },
    [pContext?.isLoggedIn, pContext?.isSupporter]
  );

  const setSelection = useCallback((book: SourceType, chapter: string | undefined, isSecured: boolean | undefined) => {
    setLibraryData((old) => ({
      ...old,
      selectedBook: book,
      selectedChapter: chapter,
      isSecured,
    }));

    setStoredSelectedBook(book);
    if (chapter) {
      setStoredChapterSelection(book, chapter, isSecured === true);
    }
  }, []);

  const setSelectedChapter = useCallback(
    async (book: SourceType, chapter: string, secured: boolean) => {
      setSelection(book, chapter, secured);

      const blockedPage = getBlockedPageForSecuredChapter(secured);
      if (blockedPage) {
        setOtherPageInfoType(blockedPage);
        return;
      }

      await loadContent(book, chapter, secured);
      setOtherPageInfoType(false);
      emitLoadedChapterEvent();
    },
    [getBlockedPageForSecuredChapter, loadContent, setSelection]
  );

  const setSelectedBook = useCallback(
    (book: SourceType, loadChapterToo: boolean) => {
      const chapterSelection = getStoredChapterSelection(book);
      setSelection(book, chapterSelection?.chapter, chapterSelection?.isSecured);

      if (!loadChapterToo) {
        return;
      }

      if (!chapterSelection) {
        emitLoadFirstChapterEvent(book);
        return;
      }

      const blockedPage = getBlockedPageForSecuredChapter(chapterSelection.isSecured);
      if (blockedPage) {
        setOtherPageInfoType(blockedPage);
        return;
      }

      void setSelectedChapter(book, chapterSelection.chapter, chapterSelection.isSecured);
    },
    [getBlockedPageForSecuredChapter, setSelectedChapter, setSelection]
  );

  const showOtherPage = useCallback((newType: LibraryPageType) => {
    setOtherPageInfoType(newType);
  }, []);

  const value = useMemo<LibraryContextType>(
    () => ({
      libraryData,
      setSelectedBook,
      setSelectedChapter,
      otherPageInfo: {
        pageType: otherPageInfoType,
        showOtherPage,
      },
    }),
    [libraryData, otherPageInfoType, setSelectedBook, setSelectedChapter, showOtherPage]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};
