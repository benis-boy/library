import { useLayoutEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import wtdrManifest from '../../book-data/WtDR_raw/WtDR_chapters.json';
import { InnerApp } from '../App';
import type { SourceType } from '../constants';
import { ConfigurationProvider } from '../context/ConfigurationProvider';
import { LibraryProvider } from '../context/LibraryProvider';
import { MockPatreonProvider } from './MockPatreonProvider';

export type FullAppHarnessProps = {
  initialHash?: string;
  isLoggedIn?: boolean;
  isSupporter?: boolean;
  userName?: string;
  selectedBook?: SourceType;
  selectedChapter?: string;
  storageState?: Record<string, string>;
};

type FetchLike = typeof window.fetch;

type ChapterManifestEntry = {
  chapter: string;
  isSecured: boolean;
};

type ChapterManifest = {
  chapters: ChapterManifestEntry[];
};

const STORYBOOK_WTDR_PASSWORD = 'storybook-wtdr-key';

const STORYBOOK_ENCRYPTION_IV = new TextEncoder().encode('fixed_iv_123456_');
const encryptedChapterCache = new Map<string, Promise<string>>();
const keyCache = new Map<string, Promise<CryptoKey>>();

const mockedWtDRSecureChapterPaths = new Set(
  ((wtdrManifest as ChapterManifest).chapters || [])
    .filter((chapter) => chapter.isSecured)
    .map((chapter) => `/book-data/${chapter.chapter.replace(/\\/g, '/')}`)
);

const encodePathSegments = (value: string) =>
  value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const getStorybookSourcePath = (publicPath: string) => {
  const normalized = publicPath.replace(/\\/g, '/');
  const prefix = '/book-data/WtDR/';
  if (!normalized.startsWith(prefix)) {
    throw new Error(`Unexpected Storybook secure chapter path: ${publicPath}`);
  }

  return `/storybook-book-data/WtDR_raw/${encodePathSegments(normalized.slice(prefix.length))}`;
};

const getEncryptionKey = (password: string) => {
  const cached = keyCache.get(password);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode('salt_'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-CBC',
        length: 256,
      },
      false,
      ['encrypt']
    );
  })();

  keyCache.set(password, promise);
  return promise;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

const encryptString = async (plainText: string, password: string) => {
  const key = await getEncryptionKey(password);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: STORYBOOK_ENCRYPTION_IV },
    key,
    new TextEncoder().encode(plainText)
  );

  const encryptedBytes = new Uint8Array(STORYBOOK_ENCRYPTION_IV.length + ciphertext.byteLength);
  encryptedBytes.set(STORYBOOK_ENCRYPTION_IV, 0);
  encryptedBytes.set(new Uint8Array(ciphertext), STORYBOOK_ENCRYPTION_IV.length);
  return bytesToBase64(encryptedBytes);
};

const getEncryptedSecureChapter = async (fetchImpl: FetchLike, publicPath: string) => {
  const cached = encryptedChapterCache.get(publicPath);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const sourceResponse = await fetchImpl(getStorybookSourcePath(publicPath));
    if (!sourceResponse.ok) {
      throw new Error(`Failed to load Storybook source chapter: ${publicPath}`);
    }

    return encryptString(await sourceResponse.text(), STORYBOOK_WTDR_PASSWORD);
  })();

  encryptedChapterCache.set(publicPath, promise);
  return promise;
};

const appStorageKeys = [
  'SELECTED_BOOK',
  'PSSJ_SELECTED_CHAPTER',
  'WtDR_SELECTED_CHAPTER',
  'SoWB_SELECTED_CHAPTER',
  'config_isDarkMode',
  'config_selectedFont',
  'config_fontSize',
  'config_whiteTone',
  'gallery:last-visited-at',
  'patreon_token',
  'PENDING_PATREON_LOGIN',
  'forceRelogin_2025_07',
];

const normalizeHash = (initialHash: string) => {
  if (!initialHash) {
    return '#/';
  }

  return initialHash.startsWith('#') ? initialHash : `#${initialHash}`;
};

const resetAppStorage = () => {
  for (const key of appStorageKeys) {
    window.localStorage.removeItem(key);
  }
};

const installSecureChapterFetchMock = (fetchImpl: FetchLike): (() => void) => {
  window.fetch = async (input, init) => {
    const requestUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pathname = decodeURIComponent(new URL(requestUrl, window.location.href).pathname);
    if (mockedWtDRSecureChapterPaths.has(pathname)) {
      const body = await getEncryptedSecureChapter(fetchImpl, pathname);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return fetchImpl(input, init);
  };

  return () => {
    window.fetch = fetchImpl;
  };
};

export const FullAppHarness = ({
  initialHash = '#/',
  isLoggedIn = false,
  isSupporter = false,
  userName = 'Storybook Reader',
  selectedBook,
  selectedChapter,
  storageState,
}: FullAppHarnessProps) => {
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    const previousHash = window.location.hash;
    const restoreFetch = installSecureChapterFetchMock(window.fetch.bind(window));

    resetAppStorage();
    if (selectedBook) {
      window.localStorage.setItem('SELECTED_BOOK', selectedBook);
    }
    if (selectedBook && selectedChapter) {
      window.localStorage.setItem(`${selectedBook}_SELECTED_CHAPTER`, selectedChapter);
    }
    if (storageState) {
      for (const [key, value] of Object.entries(storageState)) {
        window.localStorage.setItem(key, value);
      }
    }

    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}${normalizeHash(initialHash)}`);
    setIsReady(true);

    return () => {
      setIsReady(false);
      restoreFetch();
      resetAppStorage();
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}${previousHash}`);
    };
  }, [initialHash, selectedBook, selectedChapter, storageState]);

  if (!isReady) {
    return null;
  }

  return (
    <HashRouter>
      <MockPatreonProvider
        isLoggedIn={isLoggedIn}
        isSupporter={isSupporter}
        userName={userName}
        encryptionPasswordV2={{
          WtDR: STORYBOOK_WTDR_PASSWORD,
        }}
      >
        <LibraryProvider>
          <ConfigurationProvider>
            <InnerApp />
          </ConfigurationProvider>
        </LibraryProvider>
      </MockPatreonProvider>
    </HashRouter>
  );
};
