import { Box } from '@mui/material';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DataViewer } from './components/data-viewer';
import WebsiteHeader from './components/header';
import { Navigator } from './components/navigator';
import { LibraryContext } from './context/LibraryContext';
import { LibraryProvider } from './context/LibraryProvider';
import { PatreonProvider } from './context/PatreonProvider';
import { ConfigurationProvider } from './context/ConfigurationProvider';

// color palette https://colorhunt.co/palette/09122c872341be3144e17564

function InnerApp() {
  const lContext = useContext(LibraryContext);
  const { otherPageInfo } = lContext ?? {};
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true);

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
  }, [isNavigatorVisible]); // Recalculate width whenever the drawer is opened/closed
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.getBoundingClientRect().height);
    }
  }, [isHeaderVisible]); // Recalculate width whenever the drawer is opened/closed

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
      const y = e.currentTarget.scrollTop;
      if (y > lastScrollY.current) {
        if (!otherPageInfo?.pageType) {
          setIsHeaderVisible(false);
        }
      } else if (y < lastScrollY.current) {
        if (!hasTouch) {
          setIsHeaderVisible(true);
        }
      }
      lastScrollY.current = y;
    },
    [hasTouch, otherPageInfo?.pageType]
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
        <DataViewer scrollerRef={scrollerRef} />
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
