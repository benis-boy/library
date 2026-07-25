import { SourceType, SourceTypes } from '../constants';
import type { PatreonVerifierResponseBody } from '../context/PatreonContext';

const CHAPTER_ID_PATTERN = /^[0-9a-f]{8}$/i;
const READER_HASH_PREFIX = '#/reader/';

export const DEFAULT_BOOK: SourceType = 'PSSJ';

export type StoredConfig = {
  isDarkMode: boolean;
  selectedFont: string;
  fontSize: number;
  whiteTone: string;
};

export type StoredPatreonLogin = {
  nonce: string;
  targetHash: string;
};

export type StoredReaderScroll = {
  chapter: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  updatedAt: number;
};

const DEFAULT_CONFIG: StoredConfig = {
  isDarkMode: false,
  selectedFont: 'Lexend',
  fontSize: 17,
  whiteTone: '#d',
};

const keys = {
  config: {
    isDarkMode: 'config_isDarkMode',
    selectedFont: 'config_selectedFont',
    fontSize: 'config_fontSize',
    whiteTone: 'config_whiteTone',
  },
  library: {
    selectedBook: 'SELECTED_BOOK',
    selectedChapterSuffix: '_SELECTED_CHAPTER',
    legacyEncryptionPrefix: 'IS_ENCRYPTED_',
  },
  auth: {
    patreonToken: 'patreon_token',
    pendingPatreonLogin: 'PENDING_PATREON_LOGIN',
    forceRelogin: 'forceRelogin_2025_07',
  },
  gallery: {
    lastVisitedAt: 'gallery:last-visited-at',
  },
  readerScroll: {
    prefix: 'reader_scroll:',
  },
} as const;

const canUseStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const readString = (key: string): string | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeString = (key: string, value: string) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; accessors always provide safe fallbacks.
  }
};

const readJson = <T,>(key: string): T | null => {
  const raw = readString(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    writeString(key, JSON.stringify(value));
  } catch {
    // Ignore serialization failures for non-serializable values.
  }
};

const remove = (key: string) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; accessors always provide safe fallbacks.
  }
};

const isSourceType = (value: string | null): value is SourceType =>
  value !== null && SourceTypes.includes(value as SourceType);

const normalizeChapterId = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || !CHAPTER_ID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed.toLowerCase();
};

const normalizeChapterPath = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\\/g, '/').replace(/#/g, '_');
};

const normalizeStoredChapterReference = (value: string | undefined): string | undefined => {
  const chapterId = normalizeChapterId(value);
  if (chapterId) {
    return chapterId;
  }

  return normalizeChapterPath(value);
};

const getSelectedChapterStorageKey = (book: SourceType) => `${book}${keys.library.selectedChapterSuffix}`;

const getReaderScrollStorageKey = (book: SourceType) => `${keys.readerScroll.prefix}${book}`;

const isReaderHash = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.startsWith(READER_HASH_PREFIX);

export const getStoredConfig = (): StoredConfig => {
  const isDarkMode = readJson<unknown>(keys.config.isDarkMode);
  const selectedFont = readString(keys.config.selectedFont);
  const fontSize = readJson<unknown>(keys.config.fontSize);
  const whiteTone = readString(keys.config.whiteTone);

  return {
    isDarkMode: typeof isDarkMode === 'boolean' ? isDarkMode : DEFAULT_CONFIG.isDarkMode,
    selectedFont: selectedFont || DEFAULT_CONFIG.selectedFont,
    fontSize: typeof fontSize === 'number' && Number.isFinite(fontSize) ? fontSize : DEFAULT_CONFIG.fontSize,
    whiteTone: whiteTone || DEFAULT_CONFIG.whiteTone,
  };
};

export const setStoredIsDarkMode = (value: boolean) => writeJson(keys.config.isDarkMode, value);

export const setStoredSelectedFont = (value: string) => writeString(keys.config.selectedFont, value);

export const setStoredFontSize = (value: number) => writeJson(keys.config.fontSize, value);

export const setStoredWhiteTone = (value: string) => writeString(keys.config.whiteTone, value);

export const isLibrarySelectionStorageKey = (key: string) =>
  key === keys.library.selectedBook || key.endsWith(keys.library.selectedChapterSuffix);

export const isAppStorageEvent = (event: StorageEvent) => {
  if (!canUseStorage()) {
    return false;
  }

  try {
    return event.storageArea === window.localStorage;
  } catch {
    return false;
  }
};

export const clearLegacyChapterEncryptionKeys = () => {
  if (!canUseStorage()) {
    return;
  }

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(keys.library.legacyEncryptionPrefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore legacy cleanup failures.
  }
};

export function getStoredSelectedBook(): SourceType {
  const storedBook = readString(keys.library.selectedBook);
  if (isSourceType(storedBook)) {
    return storedBook;
  }

  writeString(keys.library.selectedBook, DEFAULT_BOOK);
  return DEFAULT_BOOK;
}

export function setStoredSelectedBook(book: SourceType) {
  writeString(keys.library.selectedBook, book);
}

export function getStoredSelectedChapter(book: SourceType): string | undefined {
  return normalizeStoredChapterReference(readString(getSelectedChapterStorageKey(book)) || undefined);
}

export function setStoredSelectedChapter(book: SourceType, chapter: string) {
  const normalized = normalizeStoredChapterReference(chapter);
  if (!normalized) {
    return;
  }

  writeString(getSelectedChapterStorageKey(book), normalized);
}

export const getStoredPatreonToken = (): PatreonVerifierResponseBody | null =>
  readJson<PatreonVerifierResponseBody>(keys.auth.patreonToken);

export const setStoredPatreonToken = (token: PatreonVerifierResponseBody) => writeJson(keys.auth.patreonToken, token);

export const clearStoredPatreonToken = () => remove(keys.auth.patreonToken);

export const getPendingPatreonLogin = (): StoredPatreonLogin | null => {
  const parsed = readJson<Partial<StoredPatreonLogin>>(keys.auth.pendingPatreonLogin);
  if (typeof parsed?.nonce !== 'string' || !isReaderHash(parsed?.targetHash)) {
    return null;
  }

  return {
    nonce: parsed.nonce,
    targetHash: parsed.targetHash,
  };
};

export const setPendingPatreonLogin = (value: StoredPatreonLogin) => writeJson(keys.auth.pendingPatreonLogin, value);

export const clearPendingPatreonLogin = () => remove(keys.auth.pendingPatreonLogin);

export const getForceReloginFlag = () => readString(keys.auth.forceRelogin) === 'done';

export const setForceReloginFlag = (value: boolean) => {
  if (value) {
    writeString(keys.auth.forceRelogin, 'done');
  } else {
    remove(keys.auth.forceRelogin);
  }
};

export const getGalleryLastVisitedAt = () => {
  const raw = readString(keys.gallery.lastVisitedAt);
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const setGalleryLastVisitedAt = (timestamp: number) => writeString(keys.gallery.lastVisitedAt, String(timestamp));

export const getReaderScroll = (book: SourceType): StoredReaderScroll | null => {
  const parsed = readJson<Partial<StoredReaderScroll>>(getReaderScrollStorageKey(book));
  if (
    typeof parsed?.chapter !== 'string' ||
    typeof parsed.scrollTop !== 'number' ||
    typeof parsed.scrollHeight !== 'number' ||
    typeof parsed.clientHeight !== 'number' ||
    typeof parsed.updatedAt !== 'number'
  ) {
    return null;
  }

  const chapter = normalizeStoredChapterReference(parsed.chapter);
  if (!chapter) {
    return null;
  }

  return {
    chapter,
    scrollTop: Math.max(0, parsed.scrollTop),
    scrollHeight: Math.max(0, parsed.scrollHeight),
    clientHeight: Math.max(0, parsed.clientHeight),
    updatedAt: parsed.updatedAt,
  };
};

export const setReaderScroll = (book: SourceType, payload: StoredReaderScroll) => {
  const chapter = normalizeStoredChapterReference(payload.chapter);
  if (!chapter) {
    return;
  }

  writeJson(getReaderScrollStorageKey(book), {
    chapter,
    scrollTop: Math.max(0, payload.scrollTop),
    scrollHeight: Math.max(0, payload.scrollHeight),
    clientHeight: Math.max(0, payload.clientHeight),
    updatedAt: payload.updatedAt,
  });
};

export const clearReaderScroll = (book: SourceType) => remove(getReaderScrollStorageKey(book));
