import { Fragment, useContext, useEffect, useRef } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { LibraryContext } from '../context/LibraryContext';
import { ConfigurationView } from './ConfigurationView';
import EndOfBookMessage from './endOfBook';
import { Homepage } from './homepage';
import PatreonMessage from './notASupporter';
import AccessRestrictedMessage from './notLoggedIn';

export const DataViewer = ({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement | null> }) => {
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    libraryData: { content },
    otherPageInfo,
  } = lContext || { libraryData: {} };

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
  }, [content, iframeRef, otherPageInfo?.pageType]);

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

  if (otherPageInfo?.pageType === 'homepage') {
    return <Homepage />;
  } else if (otherPageInfo?.pageType === 'not_a_supporter') {
    return <PatreonMessage />;
  } else if (otherPageInfo?.pageType === 'not_logged_in') {
    return <AccessRestrictedMessage />;
  } else if (otherPageInfo?.pageType === 'configuration') {
    return <ConfigurationView />;
  } else if (otherPageInfo?.pageType === 'end_of_book') {
    return <EndOfBookMessage />;
  }

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
