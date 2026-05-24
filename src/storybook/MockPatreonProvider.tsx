import type { ReactNode } from 'react';
import type { SourceType } from '../constants';
import { PatreonContext } from '../context/PatreonContext';

type MockPatreonProviderProps = {
  children: ReactNode;
  isLoggedIn?: boolean;
  isSupporter?: boolean;
  userName?: string;
  encryptionPassword?: string;
  encryptionPasswordV2?: Partial<Record<SourceType, string>>;
};

const defaultEncryptionPasswordV2: Record<SourceType, string> = {
  PSSJ: 'unused',
  WtDR: 'unset',
  SoWB: 'not-set',
};

export const MockPatreonProvider = ({
  children,
  isLoggedIn = false,
  isSupporter = false,
  userName = 'Storybook Reader',
  encryptionPassword = '',
  encryptionPasswordV2,
}: MockPatreonProviderProps) => {
  const loggedInSupporter = isLoggedIn && isSupporter;

  return (
    <PatreonContext.Provider
      value={{
        userInfo: isLoggedIn
          ? {
              userName,
              supportsMe: loggedInSupporter,
              currently_entitled_tiers: loggedInSupporter ? [{ id: 'storybook-supporter' }] : [],
            }
          : null,
        isLoggedIn,
        isSupporter: loggedInSupporter,
        encryptionPassword,
        encryptionPasswordV2: {
          ...defaultEncryptionPasswordV2,
          ...encryptionPasswordV2,
        },
        handleLogin: () => {},
        handleLogout: () => {},
      }}
    >
      {children}
    </PatreonContext.Provider>
  );
};
