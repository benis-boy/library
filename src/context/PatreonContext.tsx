import { createContext } from 'react';

export type PatreonContextType = {
  userInfo: MembershipData | null;
  isLoggedIn: boolean;
  isSupporter: boolean;
  encryptionPassword: string;
  handleLogin: () => void;
  handleLogout: () => void;
};

export interface MembershipData {
  userName: string;
  supportsMe: boolean;
  currently_entitled_tiers: object[]; // Adjust the type based on the actual structure of `currently_entitled_tiers`
}
export interface PatreonVerifierResponseBody {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  userInfo: MembershipData;
  encryption_password: string;
}

export const PatreonContext = createContext<PatreonContextType | undefined>(undefined);
