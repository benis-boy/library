import { createContext, useCallback, useContext } from 'react';
import { SourceType, SourceTypes } from '../constants';
import { PatreonContext } from './PatreonContext';

export type AccessDeniedReason = 'login_required' | 'supporter_required';

export type ChapterSelectionResult = { ok: true } | { ok: false; reason: AccessDeniedReason };

export type ReaderRouteInfo = {
  book: SourceType;
  chapter: string;
};

export type BookSelectionResult =
  | { ok: true; mode: 'selected_only' | 'requested_first_chapter' | 'loaded_stored_chapter' }
  | { ok: false; reason: AccessDeniedReason };

export const getAccessDeniedRoute = (reason: AccessDeniedReason) =>
  reason === 'login_required' ? '/access/login-required' : '/access/supporter-required';

export const getReaderRoute = (book: SourceType, chapter?: string) =>
  chapter
    ? `/reader/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}`
    : `/reader/${encodeURIComponent(book)}`;

export type LibraryData = {
  selectedBook: SourceType;
  selectedChapter: string | undefined;
  content: string;
  isSecured: boolean | undefined;
};

export type LibraryContextType = {
  libraryData: LibraryData;
  setSelectedBook: (book: SourceType, loadChapterToo: boolean) => Promise<BookSelectionResult>;
  setSelectedChapter: (book: SourceType, chapter: string, secured?: boolean) => Promise<ChapterSelectionResult>;
};

export const LIBRARY_SELECTED_BOOK_KEY = 'SELECTED_BOOK';
export const LIBRARY_SELECTED_CHAPTER_SUFFIX = '_SELECTED_CHAPTER';
const LEGACY_LIBRARY_ENCRYPTION_PREFIX = 'IS_ENCRYPTED_';

export const DEFAULT_BOOK: SourceType = 'PSSJ';

const isSourceType = (value: string | null): value is SourceType =>
  value !== null && SourceTypes.includes(value as SourceType);

export const normalizeRouteBookId = (value: string | undefined): SourceType | undefined => {
  if (!value) {
    return undefined;
  }

  const decoded = decodeURIComponent(value);
  return isSourceType(decoded) ? decoded : undefined;
};

const normalizeChapterFromRoute = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const decoded = decodeURIComponent(value);
  return decoded.trim() ? decoded : undefined;
};

export const parseReaderRoute = (bookParam: string | undefined, chapterParam: string | undefined): ReaderRouteInfo | undefined => {
  const book = normalizeRouteBookId(bookParam);
  const chapter = normalizeChapterFromRoute(chapterParam);
  if (!book || !chapter) {
    return undefined;
  }

  return { book, chapter };
};

export const getSelectedChapterStorageKey = (book: SourceType) => `${book}${LIBRARY_SELECTED_CHAPTER_SUFFIX}`;

export const isLibrarySelectionStorageKey = (key: string) =>
  key === LIBRARY_SELECTED_BOOK_KEY ||
  key.endsWith(LIBRARY_SELECTED_CHAPTER_SUFFIX);

export const clearLegacyChapterEncryptionKeys = () => {
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith(LEGACY_LIBRARY_ENCRYPTION_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};

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

export function setStoredChapterSelection(book: SourceType, chapter: string) {
  localStorage.setItem(getSelectedChapterStorageKey(book), chapter);
}

export const getStoredChapterSelection = getStoredSelectedChapter;

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
