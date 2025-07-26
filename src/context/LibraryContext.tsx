import { createContext, useContext } from 'react';
import { SourceType } from '../constants';
import { PatreonContext } from './PatreonContext';

export type LibraryContextType = {
  libraryData: {
    selectedBook: SourceType;
    selectedChapter: string | undefined;
    content: string;
  };
  setSelectedBook: (book: SourceType, loadChapterToo: boolean) => void;
  setSelectedChapter: (chapter: string, secured: boolean) => void;
  otherPageInfo: {
    pageType: false | 'homepage' | 'not_a_supporter' | 'not_logged_in' | 'configuration' | 'end_of_book';
    showOtherPage: (
      pageType: false | 'homepage' | 'not_a_supporter' | 'not_logged_in' | 'configuration' | 'end_of_book'
    ) => void;
  };
};
export const LibraryContext = createContext<LibraryContextType | undefined>({
  libraryData: {
    content: '',
    selectedBook: 'PSSJ',
    selectedChapter: '',
  },
  setSelectedBook: () => undefined,
  setSelectedChapter: () => undefined,
  otherPageInfo: {
    pageType: 'homepage',
    showOtherPage: () => undefined,
  },
});

export function useLoadContent(setData: (data: string) => void) {
  const pContext = useContext(PatreonContext);
  const { encryptionPassword, encryptionPasswordV2 } = pContext!;

  async function loadContent(selectedBook: SourceType, selectedChapter: string, isSecured: boolean) {
    const path = `book-data/${selectedBook}/../${selectedChapter}`;
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      let data = await response.text();
      if (isSecured && selectedBook === 'PSSJ') {
        data = await decryptString(data, encryptionPassword);
      } else if (isSecured) {
        if (encryptionPasswordV2[selectedBook] === 'unset') {
          console.error('Using encryption key before requesting it from backend. Try re-login.');
        } else if (encryptionPasswordV2[selectedBook] === 'NOT_ALLOWED') {
          console.error("Backend said you're not allowed. Which is weird. This function should only be callable after being allowed.");
        }
        data = await decryptString(data, encryptionPasswordV2[selectedBook]);
      }

      setData(data);
    } catch (error) {
      console.error('Error loading content:', error);
    }
  }

  return loadContent;
}

async function decryptString(encryptedText: string, password: string) {
  const textBytes = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));

  // Extract IV and ciphertext from the encrypted string
  const iv = textBytes.slice(0, 16); // First 16 bytes are the IV
  const ciphertext = textBytes.slice(16); // The rest is the encrypted data

  // Derive a key from the password using PBKDF2
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('salt_'), // Ensure the salt matches the one in Python
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-CBC',
      length: 256,
    },
    false,
    ['decrypt']
  );

  // Decrypt the data
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, ciphertext);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
