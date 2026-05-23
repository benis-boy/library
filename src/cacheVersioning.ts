import cacheVersionsData from './cacheVersions.json';
import { SourceType } from './constants';

type BookCacheVersionEntry = {
  manifest?: string;
};

type CacheVersions = {
  general?: {
    galleryManifest?: string;
  };
  books?: Partial<Record<SourceType, BookCacheVersionEntry>>;
};

const DEFAULT_VERSION = '1';

const cacheVersions = cacheVersionsData as CacheVersions;

const appendCacheVersion = (path: string, version: string | undefined) => {
  const normalizedVersion = version?.trim();
  if (!normalizedVersion) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(normalizedVersion)}`;
};

const getBookEntry = (book: SourceType): BookCacheVersionEntry => cacheVersions.books?.[book] || {};

export const getGalleryManifestPath = (baseUrl: string) =>
  appendCacheVersion(`${baseUrl}assets/gallery/gallery.json`, cacheVersions.general?.galleryManifest || DEFAULT_VERSION);

export const getBookManifestMetadataPath = (book: SourceType) =>
  appendCacheVersion(`navigation-data/${book}_chapters.json`, getBookEntry(book).manifest || DEFAULT_VERSION);

export const getBookNavigationHtmlPath = (book: SourceType) =>
  appendCacheVersion(`navigation-data/${book}_navigation.html`, getBookEntry(book).manifest || DEFAULT_VERSION);

export const getBookChapterContentPath = (book: SourceType, chapterPath: string, contentVersion?: string) =>
  appendCacheVersion(`book-data/${book}/../${chapterPath}`, contentVersion || DEFAULT_VERSION);
