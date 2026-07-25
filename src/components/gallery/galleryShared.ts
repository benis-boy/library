export { getGalleryLastVisitedAt } from '../../storage/appStorage';

export const BASE_URL = import.meta.env.BASE_URL;

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

export const countNewGalleryImages = <T extends { entryAddedAt?: string }>(images: T[], lastVisitedAt: number) => {
  return images.reduce((count, image) => {
    return toTimestamp(image.entryAddedAt) > lastVisitedAt ? count + 1 : count;
  }, 0);
};
