import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LibraryContext } from '../context/LibraryContext';
import { PatreonContext } from '../context/PatreonContext';
import { Box, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import basicBookData from '../basicBookData';
import { fetchNotificationSummary } from '../comments/comments-api';
import { NotificationsModal } from './notifications-modal';
import { getHeaderHeightPx } from '../header-layout';

const WebsiteHeader = ({
  isHeaderVisible,
  setIsHeaderVisible,
  setNavigatorVisible,
  ref,
}: {
  isHeaderVisible: boolean;
  setIsHeaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setNavigatorVisible: React.Dispatch<React.SetStateAction<boolean>>;
  ref: React.RefObject<HTMLDivElement | null>;
}) => {
  const navigate = useNavigate();
  const lContext = useContext(LibraryContext);
  const pContext = useContext(PatreonContext);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Define responsive styles
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const headerHeight = getHeaderHeightPx({ isPortrait, isLargeScreen });

  const [wasVisible, setWasVisible] = useState(isHeaderVisible);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationLastCheckedAt, setNotificationLastCheckedAt] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [modalUnreadCutoff, setModalUnreadCutoff] = useState<number | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isHeaderVisible) setWasVisible(true);
    else
      setTimeout(() => {
        setWasVisible(false);
      }, 225);
  }, [isHeaderVisible]);

  const isLoggedIn = pContext?.isLoggedIn ?? false;
  const patreonUserId = pContext?.patreonUserId ?? null;
  const userInfo = pContext?.userInfo ?? null;
  const signedUser = pContext?.signedUser ?? null;
  const notificationOwner = useMemo(
    () =>
      isLoggedIn && userInfo?.userName && patreonUserId && signedUser
        ? { userName: userInfo.userName, patreonUserId, signedUser }
        : null,
    [isLoggedIn, patreonUserId, signedUser, userInfo?.userName]
  );

  useEffect(() => {
    if (!notificationOwner) {
      setNotificationUnreadCount(0);
      setNotificationLastCheckedAt(0);
      setIsNotificationsOpen(false);
      setModalUnreadCutoff(null);
      setIsAccountMenuOpen(false);
      return;
    }

    let cancelled = false;
    void fetchNotificationSummary(notificationOwner)
      .then((summary) => {
        if (cancelled) {
          return;
        }
        setNotificationUnreadCount(summary.unreadCount);
        setNotificationLastCheckedAt(summary.lastCheckedAt);
      })
      .catch(() => {
        if (!cancelled) {
          setNotificationUnreadCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [notificationOwner]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isAccountMenuOpen]);

  const openNotifications = () => {
    setModalUnreadCutoff((cutoff) => cutoff ?? notificationLastCheckedAt);
    setIsNotificationsOpen(true);
  };

  const closeNotifications = (_options?: { preserveUnreadCutoff?: boolean }) => {
    setIsNotificationsOpen(false);
  };

  if (!lContext) return <Fragment />;
  if (!pContext) return <Fragment />;
  const { libraryData: { selectedBook } } = lContext;
  const { handleLogin, handleLogout } = pContext;
  const title = basicBookData.find((bbd) => bbd.id === selectedBook)?.title ?? 'Error - book not found';

  const handleMobileLogout = () => {
    setIsAccountMenuOpen(false);
    handleLogout();
  };

  return (
    <>
      <SwipeableDrawer
      sx={{
        transition: !isHeaderVisible ? '' : 'all 0.225s ease',
        width: '100%',
        height: headerHeight,
        '& .MuiDrawer-paper': {
          transition: !isHeaderVisible ? '' : 'all 0.225s ease',
          height: headerHeight,
          width: '100%',
          zIndex: 1500,
          overflow: 'visible',
          margin: 0,
          border: 0,
          backgroundColor: '#09122C', // Equivalent to
          color: '#FFFFFF', // Equivalent to text-white
          boxShadow: theme.shadows[4], // Equivalent to shadow-md
        },
      }}
      className="w-full"
      variant={hasTouch && !wasVisible ? 'temporary' : 'persistent'}
      anchor="top"
      open={isHeaderVisible}
      onClose={() => setIsHeaderVisible(false)}
      onOpen={() => setIsHeaderVisible(true)}
      swipeAreaWidth={60}
      ref={ref}
    >
      <Box
        sx={{
          height: headerHeight,
        }}
        className="relative w-full flex items-center justify-between overflow-visible px-4 portrait:px-2"
      >
        <div className="flex items-center my-2 space-x-2">
          <button
            id="toggleNav"
            className="bg-[#BE3144] h-11 w-11 flex items-center justify-center p-2 portrait:hidden"
            onClick={() => {
              setNavigatorVisible((old) => !old);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <button
            id="home-button"
            onClick={() => navigate('/')}
            className="bg-[#BE3144] p-2 h-11 w-11 flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </button>
          <button
            id="patreon-link"
            onClick={() => window.open('https://patreon.com/BenisBoy16', '_blank')}
            className="bg-[#BE3144] p-1 h-11 w-11 flex items-center justify-center"
          >
            <img src="assets/pfp_patreon.png" alt="Patreon" width="36" height="36" className="inline" />
          </button>
        </div>
        <h1
          id="bookTitle"
          className="text-center flex-grow text-gray-200 text-2xl lg:text-3xl font-bold portrait:text-[14px]"
        >
          {title}
        </h1>
        <div id="patreon-section" className="flex items-center">
          {!isLoggedIn && (
            <button id="patreon-login" className="bg-[#BE3144] px-4 py-1" onClick={handleLogin}>
              Login with Patreon
            </button>
          )}
          {isLoggedIn && (
            <div ref={accountMenuRef} className="relative flex items-center gap-2">
              {notificationOwner ? (
                <button
                  id="notification-bell"
                  type="button"
                  aria-label="Open reply notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#BE3144] text-white"
                  onClick={openNotifications}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {notificationUnreadCount > 0 ? (
                    <span className="absolute -bottom-2 -right-2 min-w-5 rounded-full bg-white px-1 text-xs font-bold text-[#872341]">
                      {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
              <span id="patreon-username" className="ml-2 hidden text-lg font-bold text-white sm:inline portrait:text-[12px]">
                User: <span className="portrait:text-[14px]">{userInfo?.userName}</span>
              </span>
              <button id="patreon-logout" className="hidden bg-[#BE3144] px-4 py-2 sm:inline-block portrait:px-2" onClick={handleLogout}>
                Logout
              </button>
              <button
                id="patreon-mobile-menu"
                type="button"
                aria-label="Open account menu"
                aria-expanded={isAccountMenuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#BE3144] text-white sm:hidden"
                onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              {isAccountMenuOpen ? (
                <div className="absolute flex flex-col right-0 top-full z-10 mt-2 rounded-xl border border-slate-700 bg-[#09122C] p-3 shadow-2xl sm:hidden">
                  <p className="text-sm font-bold text-white text-nowrap">User: {userInfo?.userName}</p>
                  <button
                    type="button"
                    className="ml-auto mt-3 bg-[#BE3144] px-4 py-2 text-left text-sm font-semibold text-white"
                    onClick={handleMobileLogout}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Box>
      </SwipeableDrawer>
      {notificationOwner && modalUnreadCutoff !== null ? (
        <NotificationsModal
          open={isNotificationsOpen}
          owner={notificationOwner}
          initialUnreadCutoff={modalUnreadCutoff}
          onClose={closeNotifications}
          onSummaryChange={({ unreadCount, lastCheckedAt }) => {
            setNotificationUnreadCount(unreadCount);
            setNotificationLastCheckedAt(lastCheckedAt);
          }}
        />
      ) : null}
    </>
  );
};

export default WebsiteHeader;
