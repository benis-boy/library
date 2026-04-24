import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourceType } from '../constants';
import { ConfigurationContext } from '../context/ConfigurationContext';
import {
  getAccessDeniedRoute,
  getReaderRoute,
  LibraryContext,
  normalizeChapterPath,
  normalizeRouteBookId,
} from '../context/LibraryContext';

const parseLoadContentParams = (raw: string | null): { chapter: string; isPaid: boolean } | undefined => {
  if (!raw) {
    return undefined;
  }

  const match = raw.match(/loadContent\('((?:\\'|[^'])*)'(?:,\s*(true|false))?\)/);
  if (!match) {
    return undefined;
  }

  const chapterCandidate = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const chapter = normalizeChapterPath(chapterCandidate);
  if (!chapter) {
    return undefined;
  }

  return {
    chapter,
    isPaid: match[2] === 'true',
  };
};

const getParamsInsideLoadContentOuterHtml = (link: HTMLAnchorElement) => {
  return parseLoadContentParams(link.getAttribute('onclick'));
};

export const Navigator = ({
  open,
  setOpen,
  ref,
  isHeaderVisible,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  ref: React.RefObject<HTMLDivElement | null>;
  isHeaderVisible: boolean;
}) => {
  const navigate = useNavigate();
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));

  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    libraryData: { selectedBook, selectedChapter } = {} as { selectedBook: SourceType; selectedChapter?: string },
    setSelectedChapter,
  } = lContext || {};
  const selectedBookOrDefault: SourceType = selectedBook || normalizeRouteBookId(window.location.hash.split('/')[2]) || 'PSSJ';

  useEffect(() => {
    // Listen for messages from the iframe
    const handleMessage = async (event: MessageEvent) => {
      if (!(event.origin.startsWith('https://benis-boy.github.io') || event.origin.startsWith('http://localhost:'))) {
        return; // Ignore untrusted messages
      }

      if (event.data.type === 'link-clicked') {
        const chapter = event.data?.url;
        if (!chapter) {
          return;
        }
        const result = await setSelectedChapter?.(selectedBookOrDefault, chapter, event.data.isPaid);
        if (result && !result.ok) {
          navigate(getAccessDeniedRoute(result.reason));
        } else {
          navigate(getReaderRoute(selectedBookOrDefault, chapter));
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate, selectedBookOrDefault, setSelectedChapter]);

  useEffect(() => {
    // Highlight selected chapter after iframe loads
    function update() {
      if (iframeRef.current) {
        const iframeDocument = iframeRef.current.contentDocument;
        if (iframeDocument) {
          // Select all anchor tags in the iframe
          const links = iframeDocument.querySelectorAll('a');
          const normalizedSelectedChapter = normalizeChapterPath(selectedChapter);

          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            link.classList.remove('highlight');
            const chapterParams = getParamsInsideLoadContentOuterHtml(link);
            const normalizedChapter = normalizeChapterPath(chapterParams?.chapter);
            if (normalizedSelectedChapter && normalizedChapter === normalizedSelectedChapter) {
              link.classList.add('highlight');
              link.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
              if (hasTouch) {
                setTimeout(() => {
                  link.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }, 100);
              }
            }
          }

          if (links.length === 0) {
            setTimeout(update, 100);
          }
        }
      }
    }
    setTimeout(update, 300);
  }, [selectedChapter, selectedBookOrDefault, hasTouch]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.location.reload();
    }
  }, [isDarkMode, selectedFont, fontSize]);

  if (!lContext) return <Fragment />;
  return (
    <SwipeableDrawer
      ref={ref}
      sx={{
        backgroundColor: isDarkMode ? '#09122C' : 'white',
        color: isDarkMode ? 'white' : 'black',
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          backgroundColor: isDarkMode ? '#09122C' : 'white',
          color: isDarkMode ? 'white' : 'black',
          width: 240,
          boxSizing: 'border-box',
        },
      }}
      variant={hasTouch || !isLargeScreen ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      swipeAreaWidth={60}
    >
      <div
        className={`transition-all duration-300 ${isHeaderVisible ? 'pt-[60px] lg:pt-[50px] portrait:pt-[80px]' : ''} h-full pl-4`}
      >
        <iframe
          ref={iframeRef}
          onLoad={() => injectStyles(iframeRef, { isDarkMode, selectedFont, fontSize })}
          src={`navigation-data/${selectedBookOrDefault}_navigation.html`}
          title="External HTML"
          width="100%"
          height="100%"
        />
      </div>
    </SwipeableDrawer>
  );
};

const injectStyles = (
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { isDarkMode }: { isDarkMode: boolean; selectedFont: string; fontSize: number }
) => {
  const iframe = iframeRef.current;
  if (iframe) {
    const iframeDocument = iframe.contentDocument;
    if (iframeDocument) {
      const styleElement = iframeDocument.createElement('style');
      styleElement.innerHTML = `
        ul {
          padding: 0;
          margin: 0;
        }

        li {
          list-style-type: none;
          margin: 10px 0;
          color: ${isDarkMode ? 'white' : 'black'};
        }

        a {
          text-decoration: none;
          color: #3498db;
          display: block;
          padding: 10px;
          border-radius: 5px;
          transition: background-color 0.3s ease;
        }

        a:hover {
          background-color: #ecf0f1;
        }
        a.highlight {
          background-color: #E17564;
          color: white;
        }
      `;
      iframeDocument.head.appendChild(styleElement); // Append styles to the head of the iframe's document

      const scriptElement = iframeDocument.createElement('script');
      scriptElement.innerHTML = `
      function loadContent(url, isPaid = false) {
        window.parent.postMessage({ type: 'link-clicked', url, isPaid }, '*');
      }`;
      iframeDocument.head.appendChild(scriptElement);
    }
  }
};
