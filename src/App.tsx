import { Box } from '@mui/material';
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { GalleryNavigator } from './components/gallery/GalleryNavigator';
import { GalleryTagOption } from './components/gallery/tagUtils';
import WebsiteHeader from './components/header';
import { Navigator } from './components/navigator';
import { ConfigurationProvider } from './context/ConfigurationProvider';
import { HEADER_VISIBLE_SCROLLER_CLASSES } from './header-layout';
import { DEFAULT_BOOK, getReaderRoute, parseReaderRoute } from './context/LibraryContext';
import { LibraryProvider } from './context/LibraryProvider';
import { PatreonProvider } from './context/PatreonProvider';
import { setReaderScroll } from './storage/appStorage';

const Homepage = lazy(() => import('./components/homepage').then((module) => ({ default: module.Homepage })));
const GalleryPage = lazy(() =>
  import('./components/gallery/GalleryPage').then((module) => ({ default: module.GalleryPage }))
);
const ConfigurationView = lazy(() =>
  import('./components/ConfigurationView').then((module) => ({ default: module.ConfigurationView }))
);
const DataViewer = lazy(() => import('./components/data-viewer').then((module) => ({ default: module.DataViewer })));
const EndOfBookMessage = lazy(() => import('./components/endOfBook'));

const ROUTE_PATHS = {
  home: '/',
  gallery: '/gallery',
  settings: '/settings',
  readerBookChapter: '/reader/:bookId/:chapter',
  readerBook: '/reader/:bookId',
  readerEnd: '/reader/end',
} as const;

// color palette https://colorhunt.co/palette/09122c872341be3144e17564

export function InnerApp() {
  const location = useLocation();
  const isReaderRoute = location.pathname.startsWith('/reader/');
  const isGalleryRoute = location.pathname === ROUTE_PATHS.gallery;
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(
    () => !('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
  const [galleryTagOptions, setGalleryTagOptions] = useState<GalleryTagOption[]>([]);

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const scrollSaveTimeoutRef = useRef<number | undefined>(undefined);

  const activeReaderRoute = useMemo(() => {
    const match = location.pathname.match(/^\/reader\/([^/]+)\/([^/]+)$/);
    return parseReaderRoute(match?.[1], match?.[2]);
  }, [location.pathname]);

  const saveReaderScrollNow = useCallback(
    (scroller: HTMLDivElement | null = scrollerRef.current) => {
      if (!activeReaderRoute || !scroller) {
        return;
      }

      const payload = {
        chapter: activeReaderRoute.chapter,
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        updatedAt: Date.now(),
      };
      setReaderScroll(activeReaderRoute.book, payload);
      window.history.replaceState({ ...window.history.state, readerScroll: payload }, document.title, window.location.href);
    },
    [activeReaderRoute]
  );

  const scheduleReaderScrollSave = useCallback(
    (scroller: HTMLDivElement) => {
      if (!activeReaderRoute || scrollSaveTimeoutRef.current !== undefined) {
        return;
      }

      scrollSaveTimeoutRef.current = window.setTimeout(() => {
        scrollSaveTimeoutRef.current = undefined;
        saveReaderScrollNow(scroller);
      }, 250);
    },
    [activeReaderRoute, saveReaderScrollNow]
  );

  const [drawerWidth, setDrawerWidth] = useState(0);
  useEffect(() => {
    if (drawerRef.current) {
      setDrawerWidth(drawerRef.current.getBoundingClientRect().width);
    }
  }, [isNavigatorVisible]);

  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.getBoundingClientRect().height);
    }
  }, [isHeaderVisible]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
      const y = e.currentTarget.scrollTop;
      const restoreUntil = Number(e.currentTarget.dataset.readerRestoreUntil || 0);
      if (restoreUntil > Date.now()) {
        lastScrollY.current = y;
        return;
      }

      scheduleReaderScrollSave(e.currentTarget);
      if (y > lastScrollY.current) {
        if (isReaderRoute) {
          setIsHeaderVisible(false);
        }
      } else if (y < lastScrollY.current) {
        if (!hasTouch) {
          setIsHeaderVisible(true);
        }
      }
      lastScrollY.current = y;
    },
    [hasTouch, isReaderRoute, scheduleReaderScrollSave]
  );

  useEffect(() => {
    const flushReaderScroll = () => {
      if (scrollSaveTimeoutRef.current !== undefined) {
        window.clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = undefined;
      }
      saveReaderScrollNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushReaderScroll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushReaderScroll);
    window.addEventListener('beforeunload', flushReaderScroll);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushReaderScroll);
      window.removeEventListener('beforeunload', flushReaderScroll);
      flushReaderScroll();
      if (scrollSaveTimeoutRef.current !== undefined) {
        window.clearTimeout(scrollSaveTimeoutRef.current);
      }
    };
  }, [saveReaderScrollNow]);

  return (
    <div className="w-full h-full">
      <WebsiteHeader
        isHeaderVisible={isHeaderVisible}
        setNavigatorVisible={setIsNavigatorVisible}
        setIsHeaderVisible={setIsHeaderVisible}
        ref={headerRef}
      />
      {isGalleryRoute ? (
        <GalleryNavigator
          open={isNavigatorVisible}
          setOpen={setIsNavigatorVisible}
          ref={drawerRef}
          isHeaderVisible={isHeaderVisible}
          tagOptions={galleryTagOptions}
        />
      ) : (
        <Navigator
          open={isNavigatorVisible}
          setOpen={setIsNavigatorVisible}
          ref={drawerRef}
          isHeaderVisible={isHeaderVisible}
        />
      )}
      <Box
        ref={scrollerRef}
        sx={{
          paddingLeft: !hasTouch && isNavigatorVisible ? `${drawerWidth}px` : 0,
          marginTop: isHeaderVisible ? 0 : `${hasTouch ? 0 : -headerHeight}px`,
          transition: 'all 0.3s ease',
        }}
        className={`duration-300 flex flex-col overflow-auto ${isHeaderVisible ? HEADER_VISIBLE_SCROLLER_CLASSES : 'max-h-[100vh] min-h-[100vh]'}`}
        onScroll={handleScroll}
      >
        <Suspense fallback={null}>
          <Routes>
            <Route path={ROUTE_PATHS.home} element={<Homepage />} />
            <Route path={ROUTE_PATHS.gallery} element={<GalleryPage onTagOptionsChange={setGalleryTagOptions} />} />
            <Route path={ROUTE_PATHS.settings} element={<ConfigurationView />} />
            <Route path={ROUTE_PATHS.readerBookChapter} element={<DataViewer scrollerRef={scrollerRef} />} />
            <Route path={ROUTE_PATHS.readerBook} element={<DataViewer scrollerRef={scrollerRef} />} />
            <Route path="/reader" element={<Navigate to={getReaderRoute(DEFAULT_BOOK)} replace />} />
            <Route path={ROUTE_PATHS.readerEnd} element={<EndOfBookMessage />} />
            <Route path="*" element={<Navigate to={ROUTE_PATHS.home} replace />} />
          </Routes>
        </Suspense>
      </Box>
    </div>
  );
}

const App = () => (
  <PatreonProvider>
    <LibraryProvider>
      <ConfigurationProvider>
        <InnerApp />
      </ConfigurationProvider>
    </LibraryProvider>
  </PatreonProvider>
);

export default App;
