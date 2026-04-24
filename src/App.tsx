import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DataViewer } from './components/data-viewer';
import WebsiteHeader from './components/header';
import { Navigator } from './components/navigator';
import { ConfigurationView } from './components/ConfigurationView';
import EndOfBookMessage from './components/endOfBook';
import { Homepage } from './components/homepage';
import PatreonMessage from './components/notASupporter';
import AccessRestrictedMessage from './components/notLoggedIn';
import { DEFAULT_BOOK, getReaderRoute } from './context/LibraryContext';
import { LibraryProvider } from './context/LibraryProvider';
import { PatreonProvider } from './context/PatreonProvider';
import { ConfigurationProvider } from './context/ConfigurationProvider';

const ROUTE_PATHS = {
  home: '/',
  settings: '/settings',
  readerBookChapter: '/reader/:bookId/:chapter',
  readerBook: '/reader/:bookId',
  readerEnd: '/reader/end',
  loginRequired: '/access/login-required',
  supporterRequired: '/access/supporter-required',
} as const;

// color palette https://colorhunt.co/palette/09122c872341be3144e17564

function InnerApp() {
  const location = useLocation();
  const isReaderRoute = location.pathname.startsWith('/reader/');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(
    () => !('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

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
    [hasTouch, isReaderRoute]
  );

  return (
    <div className="w-full h-full">
      <WebsiteHeader
        isHeaderVisible={isHeaderVisible}
        setNavigatorVisible={setIsNavigatorVisible}
        setIsHeaderVisible={setIsHeaderVisible}
        ref={headerRef}
      />
      <Navigator
        open={isNavigatorVisible}
        setOpen={setIsNavigatorVisible}
        ref={drawerRef}
        isHeaderVisible={isHeaderVisible}
      />
      <Box
        ref={scrollerRef}
        sx={{
          paddingLeft: !hasTouch && isNavigatorVisible ? `${drawerWidth}px` : 0,
          marginTop: isHeaderVisible ? 0 : `${hasTouch ? 0 : -headerHeight}px`,
          transition: 'all 0.3s ease',
        }}
        className={`duration-300 flex flex-col overflow-auto ${isHeaderVisible ? 'max-h-[calc(100vh-60px)] lg:max-h-[calc(100vh-50px)] portrait:max-h-[calc(100vh-80px)] min-h-[calc(100vh-60px)] lg:min-h-[calc(100vh-50px)] portrait:min-h-[calc(100vh-80px)]' : 'max-h-[100vh] min-h-[100vh]'}`}
        onScroll={handleScroll}
      >
        <Routes>
          <Route path={ROUTE_PATHS.home} element={<Homepage />} />
          <Route path={ROUTE_PATHS.settings} element={<ConfigurationView />} />
          <Route path={ROUTE_PATHS.readerBookChapter} element={<DataViewer scrollerRef={scrollerRef} />} />
          <Route path={ROUTE_PATHS.readerBook} element={<DataViewer scrollerRef={scrollerRef} />} />
          <Route path="/reader" element={<Navigate to={getReaderRoute(DEFAULT_BOOK)} replace />} />
          <Route path={ROUTE_PATHS.readerEnd} element={<EndOfBookMessage />} />
          <Route path={ROUTE_PATHS.loginRequired} element={<AccessRestrictedMessage />} />
          <Route path={ROUTE_PATHS.supporterRequired} element={<PatreonMessage />} />
          <Route path="*" element={<Navigate to={ROUTE_PATHS.home} replace />} />
        </Routes>
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
