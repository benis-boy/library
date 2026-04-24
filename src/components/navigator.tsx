import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourceType } from '../constants';
import { ConfigurationContext } from '../context/ConfigurationContext';
import {
  getAccessDeniedRoute,
  getReaderRoute,
  getStoredChapterSelection,
  LibraryContext,
  normalizeRouteBookId,
} from '../context/LibraryContext';

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

  const getParamsInsideLoadContentOuterHtml = (link: HTMLAnchorElement) => {
    const match = link.outerHTML.match(/loadContent\(([^)]+)\)/);
    if (match) {
      const params = match[1] // Extract the inside of the parentheses
        .split("', ")
        .map((param) => {
          let trimmed = param.trim().replace(/^['"]|['"]$/g, ''); // Remove outer quotes
          trimmed = trimmed.replace(/\\'/g, "'").replace(/\\\\/g, '\\'); // Fix escaped backslashes and single quotes
          return trimmed === 'true' ? true : trimmed === 'false' ? false : trimmed;
        });
      if (params.length === 1) {
        params.push(false);
      }

      const [chapter, isPaid] = params as [string, boolean];
      return { chapter, isPaid };
    }
    return undefined;
  };

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

          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            link.classList.remove('highlight');
            if (selectedChapter && getParamsInsideLoadContentOuterHtml(link)?.chapter.includes(selectedChapter)) {
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
  }, [selectedChapter, selectedBookOrDefault, iframeRef.current?.srcdoc, hasTouch]);
  useEffect(() => {
    // Highlight selected chapter after iframe loads
    function update() {
      if (iframeRef.current) {
        const iframeDocument = iframeRef.current.contentDocument;
        if (iframeDocument) {
          // Select all anchor tags in the iframe
          const links = iframeDocument.querySelectorAll('a');

          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            link.classList.remove('highlight');
            if (selectedChapter && getParamsInsideLoadContentOuterHtml(link)?.chapter.includes(selectedChapter)) {
              link.classList.add('highlight');
              link.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }
          }

          if (links.length === 0) {
            setTimeout(update, 100);
          }
        }
      }
    }
    setTimeout(update);
  }, [selectedChapter]);

  useEffect(() => {
    const handleLoadNextChapter = () => {
      if (iframeRef.current) {
        const iframeDocument = iframeRef.current.contentDocument;
        const currentChapter = lContext?.libraryData.selectedChapter;
        if (iframeDocument) {
          const links = iframeDocument.querySelectorAll('a');

          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            if (currentChapter && getParamsInsideLoadContentOuterHtml(link)?.chapter.includes(currentChapter)) {
              if (index + 1 < links.length) {
                const nextLink = links[index + 1];
                const { chapter, isPaid } = getParamsInsideLoadContentOuterHtml(nextLink)!;
                void setSelectedChapter?.(selectedBookOrDefault, chapter, isPaid).then((result) => {
                  if (result && !result.ok) {
                    navigate(getAccessDeniedRoute(result.reason));
                  } else {
                    navigate(getReaderRoute(selectedBookOrDefault, chapter));
                  }
                });
              } else {
                navigate('/reader/end');
              }
              break;
            }
          }
        }
      }
    };

    window.addEventListener('loadNextChapter', handleLoadNextChapter);
    return () => {
      window.removeEventListener('loadNextChapter', handleLoadNextChapter);
    };
  }, [navigate, selectedBookOrDefault, lContext?.libraryData.selectedChapter, setSelectedChapter]);

  useEffect(() => {
    const handleLoadFirstChapter = (e: Event) => {
      const _e = e as CustomEvent<{ book: SourceType }>;
      const iframeDocument = iframeRef.current!.contentDocument;
      let foundChapter = false;
      if (iframeDocument) {
        const links = iframeDocument.querySelectorAll('a');

        if (links.length > 0) {
          const link = links[0];
          const { chapter, isPaid } = getParamsInsideLoadContentOuterHtml(link)!;
          if (_e.detail.book && chapter.startsWith(_e.detail.book)) {
            void setSelectedChapter?.(_e.detail.book as SourceType, chapter, isPaid).then((result) => {
              if (result && !result.ok) {
                navigate(getAccessDeniedRoute(result.reason));
              } else {
                navigate(getReaderRoute(_e.detail.book as SourceType, chapter));
              }
            });
            foundChapter = true;
          }
        }
      }
      if (iframeRef.current && !foundChapter) {
        iframeRef.current.onload = () => {
          const iframeDocument = iframeRef.current!.contentDocument;
          if (iframeDocument) {
            const links = iframeDocument.querySelectorAll('a');

            if (links.length > 0) {
              const link = links[0];
              const { chapter, isPaid } = getParamsInsideLoadContentOuterHtml(link)!;
              if (_e.detail.book && chapter.startsWith(_e.detail.book)) {
                void setSelectedChapter?.(_e.detail.book as SourceType, chapter, isPaid).then((result) => {
                  if (result && !result.ok) {
                    navigate(getAccessDeniedRoute(result.reason));
                  } else {
                    navigate(getReaderRoute(_e.detail.book as SourceType, chapter));
                  }
                });
              }
            }
          }
        };
      }

      if (!foundChapter && _e.detail.book) {
        const stored = getStoredChapterSelection(_e.detail.book as SourceType);
        if (stored) {
          void setSelectedChapter?.(_e.detail.book as SourceType, stored).then((result) => {
            if (result && !result.ok) {
              navigate(getAccessDeniedRoute(result.reason));
            } else {
              navigate(getReaderRoute(_e.detail.book as SourceType, stored));
            }
          });
        }
      }
    };

    window.addEventListener('loadFirstChapter', handleLoadFirstChapter);
    return () => {
      window.removeEventListener('loadFirstChapter', handleLoadFirstChapter);
    };
  }, [navigate, selectedBookOrDefault, selectedChapter, setSelectedChapter]);

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
