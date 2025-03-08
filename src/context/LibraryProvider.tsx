import { ReactNode, useContext, useEffect, useState } from 'react';
import { SourceType, SourceTypes } from '../constants';
import { LibraryContext, LibraryContextType, useLoadContent } from './LibraryContext';
import { PatreonContext } from './PatreonContext';

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const pContext = useContext(PatreonContext);

  const [otherPageInfoType, setOtherPageInfoType] =
    useState<LibraryContextType['otherPageInfo']['pageType']>('homepage');
  const [libraryData, setLibraryData] = useState<LibraryContextType['libraryData']>(() => {
    let initialBook = (localStorage.getItem('SELECTED_BOOK') as SourceType) || 'PSSJ';
    if (!SourceTypes.includes(initialBook)) {
      initialBook = 'PSSJ';
      localStorage.setItem('SELECTED_BOOK', initialBook);
    }
    return {
      selectedBook: initialBook,
      selectedChapter: localStorage.getItem(initialBook + '_SELECTED_CHAPTER') || undefined,
      content: '',
    };
  });
  const loadContent = useLoadContent((data) => setLibraryData((old) => ({ ...old, content: data })));

  const setSelectedBook = (book: SourceType) => {
    setLibraryData((old) => ({ ...old, selectedBook: book }));
    localStorage.setItem('SELECTED_BOOK', book);
    const tryLoadOldChapter = localStorage.getItem(book + '_SELECTED_CHAPTER') || undefined;
    const isEncrypted = tryLoadOldChapter
      ? localStorage.getItem(`IS_ENCRYPTED_${book}_${tryLoadOldChapter}`)! === 'true'
      : false;

    if (isEncrypted && !pContext?.isLoggedIn) {
      setOtherPageInfoType('not_logged_in');
      return;
    }
    if (isEncrypted && !pContext?.isSupporter) {
      setOtherPageInfoType('not_a_supporter');
      return;
    }

    if (tryLoadOldChapter) {
      setSelectedChapter(tryLoadOldChapter, isEncrypted);
    } else {
      setOtherPageInfoType('homepage');
      const event = new CustomEvent('loadFirstChapter', { detail: { book } });
      window.dispatchEvent(event);
    }
  };

  const setSelectedChapter = async (chapter: string, secured: boolean) => {
    setLibraryData((old) => ({ ...old, selectedChapter: chapter, isSecured: secured }));
    localStorage.setItem(
      ((localStorage.getItem('SELECTED_BOOK') as SourceType) || 'PSSJ') + '_SELECTED_CHAPTER',
      chapter
    );
    localStorage.setItem(`IS_ENCRYPTED_${libraryData.selectedBook}_${chapter}`, String(secured));

    if (secured && !pContext?.isLoggedIn) {
      setOtherPageInfoType('not_logged_in');
      return;
    }
    if (secured && !pContext?.isSupporter) {
      setOtherPageInfoType('not_a_supporter');
      return;
    }

    await loadContent(libraryData.selectedBook, chapter, secured);
    setOtherPageInfoType(false);

    const loadedEvent = new CustomEvent('loadedNewChapter', {
      detail: { message: 'Next chapter loaded' },
    });
    window.dispatchEvent(loadedEvent);
  };

  useEffect(() => {
    // Only call loadContent if both selectedBook and selectedChapter are set.
    if (libraryData.selectedBook && libraryData.selectedChapter) {
      const isEncrypted =
        (localStorage.getItem(`IS_ENCRYPTED_${libraryData.selectedBook}_${libraryData.selectedChapter}`) ?? 'false') ===
        'true';

      if (isEncrypted && !pContext?.isLoggedIn) {
        setOtherPageInfoType('homepage');
        return;
      }
      if (isEncrypted && !pContext?.isSupporter) {
        setOtherPageInfoType('homepage');
        return;
      }
      if (!pContext?.isLoggedIn) {
        setOtherPageInfoType('homepage');
        return;
      }
      loadContent(libraryData.selectedBook, libraryData.selectedChapter, isEncrypted);
      setOtherPageInfoType(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pContext?.encryptionPassword, pContext?.isLoggedIn, pContext?.isSupporter]);

  return (
    <LibraryContext.Provider
      value={{
        libraryData,
        setSelectedBook,
        setSelectedChapter,
        otherPageInfo: {
          pageType: otherPageInfoType,
          showOtherPage: (newType) => {
            setOtherPageInfoType(newType);
          },
        },
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};
