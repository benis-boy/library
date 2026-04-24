import { Fragment, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfigurationContext } from '../context/ConfigurationContext';
import {
  getAccessDeniedRoute,
  getReaderRoute,
  getStoredChapterSelection,
  LibraryContext,
  normalizeRouteBookId,
  parseReaderRoute,
} from '../context/LibraryContext';

export const DataViewer = ({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement | null> }) => {
  const navigate = useNavigate();
  const params = useParams<{ bookId?: string; chapter?: string }>();
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    libraryData: { content } = { content: '' },
    setSelectedBook,
    setSelectedChapter,
  } = lContext || {};

  useEffect(() => {
    if (!setSelectedBook || !setSelectedChapter) {
      return;
    }

    const routeBook = normalizeRouteBookId(params.bookId);
    if (!routeBook) {
      navigate('/', { replace: true });
      return;
    }

    const routeInfo = parseReaderRoute(params.bookId, params.chapter);

    if (!routeInfo) {
      const stored = getStoredChapterSelection(routeBook);
      if (stored) {
        const currentPath = window.location.hash.replace(/^#/, '') || '/';
        const targetPath = getReaderRoute(routeBook, stored);
        if (currentPath !== targetPath) {
          navigate(targetPath, { replace: true });
        }
      } else {
        void setSelectedBook(routeBook, true);
      }
      return;
    }

    const storedSelection = getStoredChapterSelection(routeInfo.book);
    if (storedSelection === routeInfo.chapter && content) {
      return;
    }

    void setSelectedChapter(routeInfo.book, routeInfo.chapter).then((result) => {
      if (!result) {
        return;
      }

      if (!result.ok) {
        navigate(getAccessDeniedRoute(result.reason), { replace: true });
      }
    });
  }, [content, navigate, params.bookId, params.chapter, setSelectedBook, setSelectedChapter]);

  useEffect(() => {
    const adjustHeight = () => {
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (doc) {
          const h = doc.body.getBoundingClientRect().height + 'px';
          iframe.style.height = h;
          doc.body.parentElement!.style.height = h;
        }
      }
    };

    const iframe = iframeRef.current;

    function _adjust() {
      adjustHeight();
      setTimeout(() => {
        adjustHeight();
      }, 300);
    }
    if (iframe) {
      iframe.addEventListener('load', _adjust);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', _adjust);
      }
    };
  }, [content, iframeRef]);

  useEffect(() => {
    const handleLoadedNewChapter = () => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    };

    window.addEventListener('loadedNewChapter', handleLoadedNewChapter);
    return () => {
      window.removeEventListener('loadedNewChapter', handleLoadedNewChapter);
    };
  }, [scrollerRef]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.location.reload();
    }
  }, [isDarkMode, selectedFont, fontSize]);

  if (!lContext) return <Fragment />;

  return (
    <>
      <div className="w-full flex lg:pl-4 px-2 lg:pr-0">
        <iframe
          ref={iframeRef}
          onLoad={() => injectStyles(iframeRef, { isDarkMode, selectedFont, fontSize })}
          srcDoc={`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${content}</div></html></body>`}
          className="flex-grow"
          title="Embedded Content"
        />
      </div>

      <div className="flex justify-center mt-4 pb-4">
        <button
          className="px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
          style={{ maxWidth: '200px' }}
          onClick={(e) => {
            e.currentTarget.blur();
            const event = new CustomEvent('loadNextChapter');
            window.dispatchEvent(event);
          }}
        >
          Next Chapter
        </button>
      </div>
    </>
  );
};
const injectStyles = (
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { isDarkMode, selectedFont, fontSize }: { isDarkMode: boolean; selectedFont: string; fontSize: number }
) => {
  const iframe = iframeRef.current;
  if (iframe) {
    const iframeDocument = iframe.contentDocument;
    if (iframeDocument) {
      const styleElement = iframeDocument.createElement('style');
      styleElement.innerHTML = `
        html, body { 
          margin: 0; 
          padding: 0;
          overflow: hidden;
        }
        body { 
          margin: 0; 
          margin-top: -16px;
          margin-bottom: -16px;
          padding: 0; 
          padding-top: 32px; 
          padding-bottom: 16px; 
          width: 100%;
        }

        p {
          color: ${isDarkMode ? '#ddd' : 'black'};
          font-family: ${selectedFont};
          font-size: ${fontSize}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
        }
      `;
      iframeDocument.head.appendChild(styleElement); // Append styles to the head of the iframe's document
    }
  }
};
