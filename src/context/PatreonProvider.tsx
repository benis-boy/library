import { ReactNode, useCallback, useEffect, useState } from 'react';
import { MembershipData, PatreonContext, PatreonVerifierResponseBody } from './PatreonContext';
import { SourceType } from '../constants';
import { APP_STORAGE_CLEARED_EVENT } from '../localStorageReset';
import {
  clearPendingPatreonLogin,
  clearStoredPatreonToken,
  getForceReloginFlag,
  getPendingPatreonLogin,
  getStoredPatreonToken,
  setForceReloginFlag,
  setPendingPatreonLogin,
  setStoredPatreonToken,
} from '../storage/appStorage';

const READER_HASH_PREFIX = '#/reader/';
const DEFAULT_ENCRYPTION_PASSWORD_V2: Record<SourceType, string> = {
  PSSJ: 'unused',
  WtDR: 'unset',
  SoWB: 'not-set'
};

const createOAuthNonce = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const isReaderHash = (value: string | null | undefined): value is string => typeof value === 'string' && value.startsWith(READER_HASH_PREFIX);

const isLocalDevLoginEnabled = () => import.meta.env.DEV && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

const loadLocalDevToken = async (): Promise<PatreonVerifierResponseBody | null> => {
  if (!isLocalDevLoginEnabled()) {
    return null;
  }

  try {
    const module = await import('../../admin.secret?raw');
    const raw = typeof module.default === 'string' ? module.default : null;
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PatreonVerifierResponseBody;
  } catch (error) {
    console.error('Error loading local dev admin login:', error);
    return null;
  }
};

const restorePendingReaderRoute = (expectedNonce?: string | null) => {
  const pending = getPendingPatreonLogin();
  if (!pending) {
    clearPendingPatreonLogin();
    return;
  }

  if (expectedNonce && pending.nonce !== expectedNonce) {
    clearPendingPatreonLogin();
    return;
  }

  clearPendingPatreonLogin();
  if (!isReaderHash(pending.targetHash) || window.location.hash === pending.targetHash) {
    return;
  }

  window.location.hash = pending.targetHash;
};

export const PatreonProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfo] = useState<MembershipData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patreonUserId, setPatreonUserId] = useState<string | null>(null);
  const [signedUser, setSignedUser] = useState<string | null>(null);
  const [isAuthResolving, setIsAuthResolving] = useState(() => new URLSearchParams(window.location.search).has('code'));
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [encryptionPasswordV2, setEncryptionPasswordV2] = useState<Record<SourceType, string>>(DEFAULT_ENCRYPTION_PASSWORD_V2);

  const CLIENT_ID = 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp';
  const REDIRECT_URI = 'https://benis-boy.github.io/library/';

  const resetSession = useCallback((clearPendingLogin: boolean) => {
    clearStoredPatreonToken();
    if (clearPendingLogin) {
      clearPendingPatreonLogin();
    }
    setIsLoggedIn(false);
    setUserInfo(null);
    setPatreonUserId(null);
    setSignedUser(null);
    setEncryptionPassword('');
    setEncryptionPasswordV2(DEFAULT_ENCRYPTION_PASSWORD_V2);
  }, []);

  const applyAuthenticatedSession = useCallback((token: PatreonVerifierResponseBody) => {
    const { userInfo, patreonUserId, signedUser, encryption_password, encryption_passwordv2 } = token;
    setStoredPatreonToken(token);
    setUserInfo(userInfo);
    setIsLoggedIn(true);
    setPatreonUserId(patreonUserId);
    setSignedUser(signedUser);
    setEncryptionPassword(encryption_password);
    setEncryptionPasswordV2({
      ...DEFAULT_ENCRYPTION_PASSWORD_V2,
      ...encryption_passwordv2,
    });
  }, []);

  useEffect(() => {
    const handleAppStorageCleared = () => {
      resetSession(true);
    };

    window.addEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    return () => {
      window.removeEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    };
  }, [resetSession]);

  // Check authentication on mount
  useEffect(() => {
    const token = getStoredPatreonToken();
    if (token) {
      const { userInfo, patreonUserId, signedUser, encryption_password, encryption_passwordv2 } = token;
      if (typeof patreonUserId !== 'string' || typeof signedUser !== 'string') {
        resetSession(false);
        return;
      }

      setUserInfo(userInfo);
      setIsLoggedIn(true);
      setPatreonUserId(patreonUserId);
      setSignedUser(signedUser);
      setEncryptionPassword(encryption_password);
      setEncryptionPasswordV2({
        ...DEFAULT_ENCRYPTION_PASSWORD_V2,
        ...encryption_passwordv2,
      });
    }
  }, [resetSession]);

  // Handle logout
  const handleLogout = () => {
    resetSession(true);
  };

  // Handle login
  const handleLogin = () => {
    if (isLocalDevLoginEnabled()) {
      setIsAuthResolving(true);
      void loadLocalDevToken()
        .then((token) => {
          if (!token) {
            return;
          }

          applyAuthenticatedSession(token);
        })
        .finally(() => {
          setIsAuthResolving(false);
        });
      return;
    }

    const nonce = createOAuthNonce();
    const currentHash = window.location.hash;
    if (isReaderHash(currentHash)) {
      setPendingPatreonLogin({ nonce, targetHash: currentHash });
    } else {
      clearPendingPatreonLogin();
    }

    const oauthUrl =
      `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent('identity identity.memberships')}` +
      `&state=${encodeURIComponent(nonce)}`;
    window.location.href = oauthUrl;
  };

  // Handle OAuth callback after login
  const handleAuthCode = useCallback(async (authCode: string): Promise<boolean> => {
    const response = await fetch('https://mellow-kitsune-6578b2.netlify.app/.netlify/functions/patreon-oauth', {
      // const response = await fetch('http://localhost:5178/patreon-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    });

    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    if (!response.ok) {
      console.error('Error completing Patreon login:', data);
      return false;
    }

    const parsedData = data as Partial<PatreonVerifierResponseBody> | null;
    if (
      parsedData &&
      parsedData.userInfo &&
      typeof parsedData.patreonUserId === 'string' &&
      typeof parsedData.signedUser === 'string' &&
      parsedData.encryption_passwordv2 &&
      typeof parsedData.encryption_password === 'string'
    ) {
      applyAuthenticatedSession(parsedData as PatreonVerifierResponseBody);
      return true;
    } else {
      console.error('Error:', data);
      return false;
    }
  }, [applyAuthenticatedSession]);

  // Parse URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const returnedState = urlParams.get('state');
    if (authCode) {
      setIsAuthResolving(true);
      void handleAuthCode(authCode)
        .then((didLogin) => {
          urlParams.delete('code');
          urlParams.delete('state');
          const nextSearch = urlParams.toString();
          const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
          window.history.replaceState({}, document.title, nextUrl);

          if (didLogin) {
            restorePendingReaderRoute(returnedState);
          } else {
            clearPendingPatreonLogin();
          }

          setIsAuthResolving(false);
        })
        .catch((error) => {
          console.error('Error handling Patreon auth code:', error);
          clearPendingPatreonLogin();
          setIsAuthResolving(false);
        });
    } else {
      setIsAuthResolving(false);
    }
  }, [handleAuthCode, resetSession]);

  // One-Time force relogin
  useEffect(() => {
    if (!getForceReloginFlag()) {
      setForceReloginFlag(true);
      resetSession(false);
      window.location.reload();
    }
  }, [resetSession]);

  if (isAuthResolving) {
    return null;
  }

  return (
    <PatreonContext.Provider
      value={{
        userInfo,
        isLoggedIn,
        isSupporter: !!userInfo?.supportsMe,
        patreonUserId,
        signedUser,
        encryptionPassword,
        encryptionPasswordV2,
        handleLogin,
        handleLogout,
      }}
    >
      {children}
    </PatreonContext.Provider>
  );
};
