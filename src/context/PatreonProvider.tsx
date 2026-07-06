import { ReactNode, useCallback, useEffect, useState } from 'react';
import { MembershipData, PatreonContext, PatreonVerifierResponseBody } from './PatreonContext';
import { SourceType } from '../constants';
import { APP_STORAGE_CLEARED_EVENT } from '../localStorageReset';

const PENDING_PATREON_LOGIN_KEY = 'PENDING_PATREON_LOGIN';
const READER_HASH_PREFIX = '#/reader/';

type PendingPatreonLogin = {
  nonce: string;
  targetHash: string;
};

const createOAuthNonce = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const isReaderHash = (value: string | null | undefined): value is string => typeof value === 'string' && value.startsWith(READER_HASH_PREFIX);

const readPendingPatreonLogin = (): PendingPatreonLogin | null => {
  const raw = localStorage.getItem(PENDING_PATREON_LOGIN_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPatreonLogin>;
    if (typeof parsed?.nonce !== 'string' || !isReaderHash(parsed?.targetHash)) {
      return null;
    }

    return {
      nonce: parsed.nonce,
      targetHash: parsed.targetHash,
    };
  } catch {
    return null;
  }
};

const clearPendingPatreonLogin = () => {
  localStorage.removeItem(PENDING_PATREON_LOGIN_KEY);
};

const storePendingPatreonLogin = (pending: PendingPatreonLogin) => {
  localStorage.setItem(PENDING_PATREON_LOGIN_KEY, JSON.stringify(pending));
};

const restorePendingReaderRoute = (expectedNonce?: string | null) => {
  const pending = readPendingPatreonLogin();
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
  const [isAuthResolving, setIsAuthResolving] = useState(() => new URLSearchParams(window.location.search).has('code'));
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [encryptionPasswordV2, setEncryptionPasswordV2] = useState<Record<SourceType, string>>({
    PSSJ: 'unused',
    WtDR: 'unset',
    SoWB: 'not-set'
  });

  const CLIENT_ID = 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp';
  const REDIRECT_URI = 'https://benis-boy.github.io/library/';

  const resetSession = useCallback((clearPendingLogin: boolean) => {
    localStorage.removeItem('patreon_token');
    if (clearPendingLogin) {
      clearPendingPatreonLogin();
    }
    setIsLoggedIn(false);
    setUserInfo(null);
    setEncryptionPassword('');
    setEncryptionPasswordV2({
      PSSJ: 'unused',
      WtDR: 'unset',
      SoWB: 'not-set'
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
    const _token = localStorage.getItem('patreon_token');
    if (_token) {
      try {
        const token = JSON.parse(_token) as PatreonVerifierResponseBody;

        const { userInfo, encryption_password, encryption_passwordv2 } = token;
        setUserInfo(userInfo);
        setIsLoggedIn(true);
        setEncryptionPassword(encryption_password);
        setEncryptionPasswordV2(encryption_passwordv2);
      } catch (e) {
        console.log(e);
      }
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    resetSession(true);
  };

  // Handle login
  const handleLogin = () => {
    const nonce = createOAuthNonce();
    const currentHash = window.location.hash;
    if (isReaderHash(currentHash)) {
      storePendingPatreonLogin({ nonce, targetHash: currentHash });
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
  const handleAuthCode = async (authCode: string): Promise<boolean> => {
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
    if (parsedData && parsedData.userInfo && parsedData.encryption_passwordv2 && typeof parsedData.encryption_password === 'string') {
      localStorage.setItem('patreon_token', JSON.stringify(parsedData));
      const { userInfo, encryption_password, encryption_passwordv2 } = parsedData as PatreonVerifierResponseBody;
      setUserInfo(userInfo);
      setIsLoggedIn(true);
      setEncryptionPassword(encryption_password);
      setEncryptionPasswordV2(encryption_passwordv2);
      return true;
    } else {
      console.error('Error:', data);
      return false;
    }
  };

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
  }, [resetSession]);

  // One-Time force relogin
  useEffect(() => {
    const FLAG_KEY = 'forceRelogin_2025_07';
    if (!localStorage.getItem(FLAG_KEY)) {
      localStorage.setItem(FLAG_KEY, 'done');
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
