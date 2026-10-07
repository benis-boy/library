import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useCallback, useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBookNavigationHtmlPath } from '../cacheVersioning';
import { SourceType } from '../constants';
import { ConfigurationContext } from '../context/ConfigurationContext';
import {
  getReaderRoute,
  getReaderRouteForChapter,
  LibraryContext,
  normalizeChapterReference,
  normalizeRouteBookId,
} from '../context/LibraryContext';
import { HEADER_VISIBLE_TOP_PADDING_CLASSES } from '../header-layout';

const parseLoadContentParams = (raw: string | null): { chapter: string; isPaid: boolean } | undefined => {
  if (!raw) {
    return undefined;
  }

  const match = raw.match(/loadContent\('((?:\\'|[^'])*)'(?:,\s*(true|false))?\)/);
  if (!match) {
    return undefined;
  }

  const chapterCandidate = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const chapter = normalizeChapterReference(chapterCandidate);
  if (!chapter) {
    return undefined;
  }

  return { chapter, isPaid: match[2] === 'true' };
};

const getParamsInsideLoadContentOuterHtml = (link: HTMLAnchorElement) => parseLoadContentParams(link.getAttribute('onclick'));

const isIosNavigatorDevice = (userAgent: string, platform: string, maxTouchPoints: number) =>
  /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);

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
  const location = useLocation();
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isIosDevice = isIosNavigatorDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));
  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    libraryData: { selectedBook, selectedChapter, loadError } = {
      selectedBook: undefined,
      selectedChapter: undefined,
      loadError: null,
    },
    setSelectedChapter,
  } = lContext || {};
  const selectedBookOrDefault: SourceType = selectedBook || normalizeRouteBookId(window.location.hash.split('/')[2]) || 'PSSJ';

  const highlightSelectedChapter = useCallback(() => {
    const iframeDocument = iframeRef.current?.contentDocument;
    if (!iframeDocument) {
      return;
    }

    const normalizedSelectedChapter = normalizeChapterReference(selectedChapter);
    for (const link of Array.from(iframeDocument.querySelectorAll('a'))) {
      link.classList.remove('highlight');
      const chapter = normalizeChapterReference(getParamsInsideLoadContentOuterHtml(link)?.chapter);
      if (normalizedSelectedChapter && chapter === normalizedSelectedChapter) {
        link.classList.add('highlight');
        link.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedChapter]);

  const applyFrameSettings = useCallback(() => {
    injectStyles(iframeRef, { isDarkMode, selectedFont, fontSize });
    highlightSelectedChapter();
  }, [fontSize, highlightSelectedChapter, isDarkMode, selectedFont]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object' ||
        Array.isArray(event.data) ||
        event.data.type !== 'link-clicked' ||
        typeof event.data.url !== 'string' ||
        (event.data.isPaid !== undefined && typeof event.data.isPaid !== 'boolean')
      ) {
        return;
      }

      const chapter = normalizeChapterReference(event.data.url);
      if (!chapter) {
        return;
      }

      const targetRoute = await getReaderRouteForChapter(selectedBookOrDefault, chapter).catch(() =>
        getReaderRoute(selectedBookOrDefault, chapter)
      );
      if (targetRoute === location.pathname) {
        if (loadError && setSelectedChapter) {
          // Retrying is explicit: successful same-chapter selections remain untouched.
          void setSelectedChapter(selectedBookOrDefault, chapter);
        }
        return;
      }

      navigate(targetRoute);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadError, location.pathname, navigate, selectedBookOrDefault, setSelectedChapter]);

  useEffect(() => {
    applyFrameSettings();
    const delayedHighlightId = window.setTimeout(applyFrameSettings, 250);
    const touchHighlightId = hasTouch ? window.setTimeout(highlightSelectedChapter, 100) : undefined;

    return () => {
      if (delayedHighlightId !== undefined) {
        window.clearTimeout(delayedHighlightId);
      }
      if (touchHighlightId !== undefined) {
        window.clearTimeout(touchHighlightId);
      }
    };
  }, [applyFrameSettings, hasTouch, highlightSelectedChapter]);

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
          height: '100dvh',
          maxHeight: '100dvh',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      variant={hasTouch || !isLargeScreen ? 'temporary' : 'persistent'}
      anchor="left"
      disableSwipeToOpen={isIosDevice}
      disableDiscovery
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      swipeAreaWidth={60}
    >
      <div className={`flex h-full min-h-0 flex-1 flex-col transition-all duration-300 ${isHeaderVisible ? HEADER_VISIBLE_TOP_PADDING_CLASSES : ''} pl-4`}>
        <iframe
          ref={iframeRef}
          onLoad={applyFrameSettings}
          src={getBookNavigationHtmlPath(selectedBookOrDefault)}
          title="External HTML"
          className="block h-full min-h-0 w-full flex-1 border-0"
        />
      </div>
    </SwipeableDrawer>
  );
};

const injectStyles = (
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { isDarkMode, selectedFont, fontSize }: { isDarkMode: boolean; selectedFont: string; fontSize: number }
) => {
  const iframeDocument = iframeRef.current?.contentDocument;
  if (!iframeDocument) {
    return;
  }

  let styleElement = iframeDocument.querySelector<HTMLStyleElement>('style[data-navigator-settings]');
  if (!styleElement) {
    styleElement = iframeDocument.createElement('style');
    styleElement.dataset.navigatorSettings = 'true';
    iframeDocument.head.appendChild(styleElement);
  }
  styleElement.textContent = `
    ul { padding: 0; margin: 0; }
    li { list-style-type: none; margin: 10px 0; color: ${isDarkMode ? 'white' : 'black'}; }
    a {
      text-decoration: none;
      color: #3498db;
      display: block;
      padding: 10px;
      border-radius: 5px;
      transition: background-color 0.3s ease;
      font-family: ${selectedFont};
      font-size: ${fontSize}px;
    }
    a:hover { background-color: #ecf0f1; }
    a.highlight { background-color: #E17564; color: white; }
  `;

  if (!iframeDocument.querySelector('script[data-navigator-links]')) {
    const scriptElement = iframeDocument.createElement('script');
    scriptElement.dataset.navigatorLinks = 'true';
    scriptElement.textContent = `
      function loadContent(url, isPaid = false) {
        window.parent.postMessage({ type: 'link-clicked', url, isPaid }, '*');
      }`;
    iframeDocument.head.appendChild(scriptElement);
  }
};
