export const BASE_URL = import.meta.env.BASE_URL;
export const GALLERY_LAST_VISITED_AT_STORAGE_KEY = 'gallery:last-visited-at';

export const toPublicAssetPath = (source: string) => {
  const normalized = source.trim().replace(/^\/+/, '');
  return `${BASE_URL}${normalized}`;
};

export const toTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getGalleryLastVisitedAt = () => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(GALLERY_LAST_VISITED_AT_STORAGE_KEY);
    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

export const markGalleryAsVisited = (visitedAt: number = Date.now()) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(GALLERY_LAST_VISITED_AT_STORAGE_KEY, String(visitedAt));
  } catch {
    // Ignore storage failures and keep the gallery usable.
  }
};

export const countNewGalleryImages = <T extends { entryAddedAt?: string }>(images: T[], lastVisitedAt: number) => {
  return images.reduce((count, image) => {
    return toTimestamp(image.entryAddedAt) > lastVisitedAt ? count + 1 : count;
  }, 0);
};
