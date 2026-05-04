import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImageLightbox } from './ImageLightbox';
import {
  GalleryTagOption,
  normalizeGalleryTag,
  parseActiveGalleryTags,
  sortGalleryTagOptions,
} from './tagUtils';

type GalleryImage = {
  id: string;
  thumbSrc: string;
  fullSrc: string;
  entryAddedAt?: string;
  tags?: string[];
};

type GalleryManifest = {
  version: number;
  images: GalleryImage[];
  tagTranslations: Record<string, string>;
};

const DEFAULT_MANIFEST: GalleryManifest = {
  version: 1,
  images: [],
  tagTranslations: {},
};

const BASE_URL = import.meta.env.BASE_URL;

const toPublicAssetPath = (source: string) => {
  const normalized = source.trim().replace(/^\/+/, '');
  return `${BASE_URL}${normalized}`;
};

const toTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

type GalleryPageProps = {
  onTagOptionsChange?: (tagOptions: GalleryTagOption[]) => void;
};

export const GalleryPage = ({ onTagOptionsChange }: GalleryPageProps) => {
  const [searchParams] = useSearchParams();
  const [manifest, setManifest] = useState<GalleryManifest>(DEFAULT_MANIFEST);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [displayedImages, setDisplayedImages] = useState<GalleryImage[]>([]);
  const [gridPhase, setGridPhase] = useState<'idle' | 'fadingOut' | 'fadingIn'>('idle');
  const isFirstFilterRenderRef = useRef(true);
  const swapTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BASE_URL}assets/gallery/gallery.json`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Gallery manifest failed to load (${response.status}).`);
        }

        const payload = (await response.json()) as Partial<GalleryManifest>;
        const images = Array.isArray(payload.images)
          ? payload.images.filter(
              (image): image is GalleryImage =>
                typeof image?.id === 'string' &&
                typeof image?.thumbSrc === 'string' &&
                typeof image?.fullSrc === 'string'
            )
          : [];
        const tagTranslations =
          payload.tagTranslations && typeof payload.tagTranslations === 'object' && !Array.isArray(payload.tagTranslations)
            ? Object.fromEntries(
                Object.entries(payload.tagTranslations)
                  .map(([key, value]) => {
                    const normalizedKey = normalizeGalleryTag(key);
                    if (!normalizedKey || typeof value !== 'string') {
                      return null;
                    }

                    const trimmedLabel = value.trim();
                    if (!trimmedLabel) {
                      return null;
                    }

                    return [normalizedKey, trimmedLabel] as const;
                  })
                  .filter((entry): entry is readonly [string, string] => entry !== null)
              )
            : {};

        if (!cancelled) {
          const version = typeof payload.version === 'number' && Number.isInteger(payload.version) ? payload.version : 1;
          setManifest({
            version,
            images,
            tagTranslations,
          });
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message = caughtError instanceof Error ? caughtError.message : 'Unknown gallery error.';
          setError(message);
          setManifest(DEFAULT_MANIFEST);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeTags = useMemo(() => parseActiveGalleryTags(searchParams), [searchParams]);

  const selectedImage = useMemo(() => {
    if (!selectedImageId) {
      return null;
    }
    return manifest.images.find((image) => image.id === selectedImageId) || null;
  }, [manifest.images, selectedImageId]);

  const sortedImages = useMemo(() => {
    return manifest.images
      .map((image, index) => ({ image, index }))
      .sort((left, right) => {
        const timestampDelta = toTimestamp(right.image.entryAddedAt) - toTimestamp(left.image.entryAddedAt);
        if (timestampDelta !== 0) {
          return timestampDelta;
        }

        return right.index - left.index;
      })
      .map(({ image }) => image);
  }, [manifest.images]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();

    for (const image of sortedImages) {
      if (!Array.isArray(image.tags)) {
        continue;
      }

      for (const rawTag of image.tags) {
        const tag = normalizeGalleryTag(rawTag);
        if (!tag) {
          continue;
        }
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet);
  }, [sortedImages]);

  const tagOptions = useMemo(() => {
    return sortGalleryTagOptions(availableTags, manifest.tagTranslations);
  }, [availableTags, manifest.tagTranslations]);

  const filteredImages = useMemo(() => {
    if (activeTags.length === 0) {
      return sortedImages;
    }

    return sortedImages.filter((image) => {
      const imageTags = new Set<string>();
      if (Array.isArray(image.tags)) {
        for (const rawTag of image.tags) {
          const normalized = normalizeGalleryTag(rawTag);
          if (normalized) {
            imageTags.add(normalized);
          }
        }
      }

      return activeTags.every((tag) => imageTags.has(tag));
    });
  }, [activeTags, sortedImages]);

  useEffect(() => {
    const clearTimers = () => {
      if (swapTimerRef.current) {
        window.clearTimeout(swapTimerRef.current);
        swapTimerRef.current = null;
      }
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };

    clearTimers();

    if (isFirstFilterRenderRef.current) {
      isFirstFilterRenderRef.current = false;
      setDisplayedImages(filteredImages);
      setGridPhase('fadingIn');
      settleTimerRef.current = window.setTimeout(() => {
        setGridPhase('idle');
        settleTimerRef.current = null;
      }, 240);

      return clearTimers;
    }

    setGridPhase('fadingOut');
    swapTimerRef.current = window.setTimeout(() => {
      setDisplayedImages(filteredImages);
      setGridPhase('fadingIn');
      swapTimerRef.current = null;

      settleTimerRef.current = window.setTimeout(() => {
        setGridPhase('idle');
        settleTimerRef.current = null;
      }, 260);
    }, 140);

    return clearTimers;
  }, [filteredImages]);

  useEffect(() => {
    onTagOptionsChange?.(tagOptions);
  }, [onTagOptionsChange, tagOptions]);

  useEffect(() => {
    return () => {
      onTagOptionsChange?.([]);
    };
  }, [onTagOptionsChange]);

  return (
    <section className="min-h-full w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading gallery...</div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : null}

        {!loading && !error && sortedImages.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No gallery images found.</div>
        ) : null}

        {!loading && !error && sortedImages.length > 0 ? (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
              <span>
                Showing <strong>{filteredImages.length}</strong> of <strong>{sortedImages.length}</strong> images
              </span>
              {activeTags.length > 0 ? <span>{activeTags.length} filters active</span> : <span>No filters active</span>}
            </div>

            {filteredImages.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
                No images match the active tags. Try removing one filter.
              </div>
            ) : (
              <div
                className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 transition-all duration-200 ${
                  gridPhase === 'fadingOut' ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
                }`}
              >
                {displayedImages.map((image, index) => {
                  const thumbPath = toPublicAssetPath(image.thumbSrc);
                  const tileAnimationStyle =
                    gridPhase === 'fadingIn'
                      ? {
                          animationName: 'gallery-tile-in',
                          animationDuration: '260ms',
                          animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                          animationFillMode: 'both',
                          animationDelay: `${Math.min(index, 14) * 18}ms`,
                        }
                      : undefined;

                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImageId(image.id)}
                      style={tileAnimationStyle}
                      className="group relative block overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:shadow-xl transition-all duration-200"
                    >
                      <img
                        src={thumbPath}
                        alt={`Gallery image ${image.id}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full aspect-[4/5] object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white rounded-full bg-black/45 p-2">
                          <OpenInFullIcon fontSize="small" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <ImageLightbox
        open={Boolean(selectedImage)}
        imageSrc={selectedImage ? toPublicAssetPath(selectedImage.fullSrc) : ''}
        imageAlt={selectedImage ? `Gallery image ${selectedImage.id}` : 'Gallery image'}
        onClose={() => setSelectedImageId(null)}
      />
    </section>
  );
};
