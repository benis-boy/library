import { createContext, useCallback, useContext } from 'react';
import { SourceType, SourceTypes } from '../constants';
import { PatreonContext } from './PatreonContext';

export type LibraryPageType =
  | false
  | 'homepage'
  | 'not_a_supporter'
  | 'not_logged_in'
  | 'configuration'
  | 'end_of_book';

export type LibraryData = {
  selectedBook: SourceType;
  selectedChapter: string | undefined;
  content: string;
  isSecured: boolean | undefined;
};

export type LibraryContextType = {
  libraryData: LibraryData;
  setSelectedBook: (book: SourceType, loadChapterToo: boolean) => void;
  setSelectedChapter: (book: SourceType, chapter: string, secured: boolean) => Promise<void>;
  otherPageInfo: {
    pageType: LibraryPageType;
    showOtherPage: (pageType: LibraryPageType) => void;
  };
};

export const LIBRARY_SELECTED_BOOK_KEY = 'SELECTED_BOOK';
export const LIBRARY_SELECTED_CHAPTER_SUFFIX = '_SELECTED_CHAPTER';
export const LIBRARY_ENCRYPTION_PREFIX = 'IS_ENCRYPTED_';

export const DEFAULT_BOOK: SourceType = 'PSSJ';

const isSourceType = (value: string | null): value is SourceType =>
  value !== null && SourceTypes.includes(value as SourceType);

export const getSelectedChapterStorageKey = (book: SourceType) => `${book}${LIBRARY_SELECTED_CHAPTER_SUFFIX}`;

export const getChapterEncryptionStorageKey = (book: SourceType, chapter: string) =>
  `${LIBRARY_ENCRYPTION_PREFIX}${book}_${chapter}`;

export const isLibrarySelectionStorageKey = (key: string) =>
  key === LIBRARY_SELECTED_BOOK_KEY ||
  key.endsWith(LIBRARY_SELECTED_CHAPTER_SUFFIX) ||
  key.startsWith(LIBRARY_ENCRYPTION_PREFIX);

export function getStoredSelectedBook(): SourceType {
  const storedBook = localStorage.getItem(LIBRARY_SELECTED_BOOK_KEY);
  if (isSourceType(storedBook)) {
    return storedBook;
  }

  localStorage.setItem(LIBRARY_SELECTED_BOOK_KEY, DEFAULT_BOOK);
  return DEFAULT_BOOK;
}

export function setStoredSelectedBook(book: SourceType) {
  localStorage.setItem(LIBRARY_SELECTED_BOOK_KEY, book);
}

export function getStoredSelectedChapter(book: SourceType): string | undefined {
  return localStorage.getItem(getSelectedChapterStorageKey(book)) || undefined;
}

export function getStoredChapterEncrypted(book: SourceType, chapter: string): boolean {
  return localStorage.getItem(getChapterEncryptionStorageKey(book, chapter)) === 'true';
}

export function setStoredChapterSelection(book: SourceType, chapter: string, isSecured: boolean) {
  localStorage.setItem(getSelectedChapterStorageKey(book), chapter);
  localStorage.setItem(getChapterEncryptionStorageKey(book, chapter), String(isSecured));
}

export function getStoredChapterSelection(book: SourceType): { chapter: string; isSecured: boolean } | undefined {
  const chapter = getStoredSelectedChapter(book);
  if (!chapter) {
    return undefined;
  }

  return {
    chapter,
    isSecured: getStoredChapterEncrypted(book, chapter),
  };
}

export const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function useLoadContent(setData: (data: string) => void) {
  const pContext = useContext(PatreonContext);
  const encryptionPassword = pContext?.encryptionPassword ?? '';
  const encryptionPasswordV2 = pContext?.encryptionPasswordV2;

  const loadContent = useCallback(
    async (selectedBook: SourceType, selectedChapter: string, isSecured: boolean) => {
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
          const key = encryptionPasswordV2?.[selectedBook];
          if (!key || key === 'unset' || key === 'NOT_ALLOWED') {
            throw new Error(`Missing valid decryption key for ${selectedBook}.`);
          }

          data = await decryptString(data, key);
        }

        setData(data);
      } catch (error) {
        console.error('Error loading content:', error);
      }
    },
    [encryptionPassword, encryptionPasswordV2, setData]
  );

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
