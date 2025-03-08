import { ReactNode, useEffect, useState } from 'react';
import { MembershipData, PatreonContext, PatreonVerifierResponseBody } from './PatreonContext';

export const PatreonProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfo] = useState<MembershipData | null>({
    userName: 'test',
    supportsMe: false,
    currently_entitled_tiers: [],
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');

  const CLIENT_ID = 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp';
  // const REDIRECT_URI = 'https://benis-boy.github.io/SSJ/';
  // TODO set new URL
  const REDIRECT_URI = 'https://benis-boy.github.io/library/';
  const PATREON_OAUTH_URL = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=identity%20identity.memberships`;

  // Check authentication on mount
  useEffect(() => {
    const _token = localStorage.getItem('patreon_token');
    if (_token) {
      try {
        const token = JSON.parse(_token) as PatreonVerifierResponseBody;

        const { userInfo, encryption_password } = token;
        setUserInfo(userInfo);
        setIsLoggedIn(true);
        setEncryptionPassword(encryption_password);
      } catch (e) {
        console.log(e);
      }
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('patreon_token');
    setIsLoggedIn(false);
    setUserInfo(null);
    setEncryptionPassword('');
  };

  // Handle login
  const handleLogin = () => {
    window.location.href = PATREON_OAUTH_URL;
  };

  // Handle OAuth callback after login
  const handleAuthCode = async (authCode: string) => {
    // const response = await fetch('https://mellow-kitsune-6578b2.netlify.app/.netlify/functions/patreon-oauth', {
    const response = await fetch('http://localhost:5178/patreon-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    });
    const data = await response.json();
    if (data) {
      localStorage.setItem('patreon_token', JSON.stringify(data));
      const { userInfo, encryption_password } = data as PatreonVerifierResponseBody;
      setUserInfo(userInfo);
      setIsLoggedIn(true);
      setEncryptionPassword(encryption_password);
    } else {
      console.error('Error:', data);
    }
  };

  // Parse URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    if (authCode) {
      handleAuthCode(authCode);
      // Clean up URL after handling
      urlParams.delete('code');
      urlParams.delete('state');
      window.history.replaceState({}, document.title, `${window.location.pathname}?${urlParams.toString()}`);
    }
  }, []);

  return (
    <PatreonContext.Provider
      value={{
        userInfo,
        isLoggedIn,
        isSupporter: !!userInfo?.supportsMe,
        encryptionPassword,
        handleLogin,
        handleLogout,
      }}
    >
      {children}
    </PatreonContext.Provider>
  );
};
