import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useContext, useEffect, useRef } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { LibraryContext } from '../context/LibraryContext';

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
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));

  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    libraryData: { selectedBook, selectedChapter },
    otherPageInfo,
    setSelectedChapter,
  } = lContext || { libraryData: {} };

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
    const handleMessage = (event: MessageEvent) => {
      // TODO set new URL
      if (!event.origin.startsWith('http://localhost:')) {
        return; // Ignore untrusted messages
      }

      if (event.data.type === 'link-clicked') {
        const chapter = event.data?.url;
        setSelectedChapter?.(chapter, event.data.isPaid);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setSelectedChapter]);

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
  }, [selectedChapter, selectedBook, iframeRef.current?.srcdoc, hasTouch]);
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

  const showOtherPage = otherPageInfo?.showOtherPage;
  useEffect(() => {
    const handleLoadNextChapter = () => {
      if (iframeRef.current) {
        const iframeDocument = iframeRef.current.contentDocument;
        if (iframeDocument) {
          const links = iframeDocument.querySelectorAll('a');

          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            if (selectedChapter && getParamsInsideLoadContentOuterHtml(link)?.chapter.includes(selectedChapter)) {
              if (index + 1 < links.length) {
                const nextLink = links[index + 1];
                const { chapter, isPaid } = getParamsInsideLoadContentOuterHtml(nextLink)!;
                setSelectedChapter?.(chapter, isPaid);
              } else {
                showOtherPage?.('end_of_book');
              }
            }
          }
        }
      }
    };

    window.addEventListener('loadNextChapter', handleLoadNextChapter);
    return () => {
      window.removeEventListener('loadNextChapter', handleLoadNextChapter);
    };
  }, [showOtherPage, selectedChapter, setSelectedChapter]);

  useEffect(() => {
    const handleLoadFirstChapter = (e: Event) => {
      const _e = e as CustomEvent<{ book: string }>;
      const iframeDocument = iframeRef.current!.contentDocument;
      let foundChapter = false;
      if (iframeDocument) {
        const links = iframeDocument.querySelectorAll('a');

        if (links.length > 0) {
          const link = links[0];
          const { chapter, isPaid } = getParamsInsideLoadContentOuterHtml(link)!;
          if (_e.detail.book && chapter.startsWith(_e.detail.book)) {
            setSelectedChapter?.(chapter, isPaid);
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
                setSelectedChapter?.(chapter, isPaid);
              }
            }
          }
        };
      }
    };

    window.addEventListener('loadFirstChapter', handleLoadFirstChapter);
    return () => {
      window.removeEventListener('loadFirstChapter', handleLoadFirstChapter);
    };
  }, [selectedBook, selectedChapter, setSelectedChapter]);

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
          src={`/navigation-data/${selectedBook}_navigation.html`}
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
