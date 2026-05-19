import CollectionsIcon from '@mui/icons-material/Collections';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  countNewGalleryImages,
  getGalleryLastVisitedAt,
  toPublicAssetPath,
  toTimestamp,
  BASE_URL,
} from './galleryShared';

type GalleryImage = {
  id?: string;
  thumbSrc?: string;
  entryAddedAt?: string;
};

type GalleryManifest = {
  images?: GalleryImage[];
  dashboardTileImageIds?: string[];
};

const FIRST_LEFT = 50;
const FIRST_RIGHT = 40;
const SECOND_LEFT = 35;
const SECOND_RIGHT = 35;
const THIRD_LEFT = 15;
const THIRD_RIGHT = 25;
const liquidGlassBadgeClassName =
  'relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/45 bg-white/[0.08] px-3 py-1 text-xs font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_0_9px_rgba(0,0,0,0.18),0_3px_8px_rgba(0,0,0,0.16)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-white/55 before:via-transparent before:to-transparent before:opacity-70 after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-gradient-to-tl after:from-white/20 after:via-transparent after:to-transparent after:opacity-60';

const getRecentPreviewSources = (images: GalleryImage[]) => {
  return images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => typeof image.thumbSrc === 'string')
    .sort((left, right) => {
      const timestampDelta = toTimestamp(right.image.entryAddedAt) - toTimestamp(left.image.entryAddedAt);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return right.index - left.index;
    })
    .slice(0, 3)
    .map(({ image }) => toPublicAssetPath(image.thumbSrc as string));
};

const getConfiguredPreviewSources = (images: GalleryImage[], configuredIds: unknown) => {
  if (!Array.isArray(configuredIds)) {
    return [];
  }

  const thumbSourceById = new Map<string, string>();
  for (const image of images) {
    if (typeof image.id !== 'string' || typeof image.thumbSrc !== 'string') {
      continue;
    }

    if (!thumbSourceById.has(image.id)) {
      thumbSourceById.set(image.id, image.thumbSrc);
    }
  }

  const sources: string[] = [];
  const seenIds = new Set<string>();
  for (const rawId of configuredIds) {
    if (typeof rawId !== 'string') {
      continue;
    }

    const imageId = rawId.trim();
    if (!imageId || seenIds.has(imageId)) {
      continue;
    }

    seenIds.add(imageId);
    const thumbSrc = thumbSourceById.get(imageId);
    if (!thumbSrc) {
      continue;
    }

    sources.push(toPublicAssetPath(thumbSrc));
    if (sources.length >= 3) {
      break;
    }
  }

  return sources;
};

const FALLBACK_BACKGROUND =
  'linear-gradient(160deg, rgba(95,15,64,1) 0%, rgba(154,3,30,1) 58%, rgba(251,139,36,1) 100%)';

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const firstLeftEnd = clampPercent(FIRST_LEFT);
const firstRightEnd = clampPercent(FIRST_RIGHT);
const secondLeftEnd = clampPercent(firstLeftEnd + SECOND_LEFT);
const secondRightEnd = clampPercent(firstRightEnd + SECOND_RIGHT);
const thirdLeftEnd = clampPercent(secondLeftEnd + THIRD_LEFT);
const thirdRightEnd = clampPercent(secondRightEnd + THIRD_RIGHT);

const topLayerClipPath = `polygon(0 0, 100% 0, 100% ${firstRightEnd}%, 0 ${firstLeftEnd}%)`;
const middleLayerClipPath = `polygon(0 ${firstLeftEnd}%, 100% ${firstRightEnd}%, 100% ${secondRightEnd}%, 0 ${secondLeftEnd}%)`;
const bottomLayerClipPath = `polygon(0 ${secondLeftEnd}%, 100% ${secondRightEnd}%, 100% ${thirdRightEnd}%, 0 ${thirdLeftEnd}%)`;

const buildLayerStyle = (source?: string) => {
  if (!source) {
    return {
      backgroundImage: FALLBACK_BACKGROUND,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return {
    backgroundImage: `url('${source}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
};

export const GalleryDashboardTile = () => {
  const navigate = useNavigate();
  const [galleryPreviewSources, setGalleryPreviewSources] = useState<string[]>([]);
  const [newImageCount, setNewImageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadGalleryPreview = async () => {
      try {
        const response = await fetch(`${BASE_URL}assets/gallery/gallery.json`, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as GalleryManifest;
        if (!Array.isArray(payload.images)) {
          if (!cancelled) {
            setNewImageCount(0);
          }
          return;
        }

        const configuredSources = getConfiguredPreviewSources(payload.images, payload.dashboardTileImageIds);
        const previewSources =
          configuredSources.length > 0 ? configuredSources : getRecentPreviewSources(payload.images);
        const unseenCount = countNewGalleryImages(payload.images, getGalleryLastVisitedAt());

        if (!cancelled) {
          setGalleryPreviewSources(previewSources);
          setNewImageCount(unseenCount);
        }
      } catch {
        if (!cancelled) {
          setGalleryPreviewSources([]);
          setNewImageCount(0);
        }
      }
    };

    void loadGalleryPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  const newestSource = galleryPreviewSources[0];
  const middleSource = galleryPreviewSources.length >= 3 ? galleryPreviewSources[1] : undefined;
  const oldestSource =
    galleryPreviewSources.length >= 3
      ? galleryPreviewSources[2]
      : galleryPreviewSources.length === 2
        ? galleryPreviewSources[1]
        : galleryPreviewSources[0];
  const hasNewImages = newImageCount > 0;
  const newImageBadgeLabel = newImageCount > 9 ? '9+ new' : `${newImageCount} new`;

  return (
    <button
      onClick={() => navigate('/gallery')}
      className="relative shadow-lg rounded-lg overflow-hidden transform transition-all duration-300 w-72 hover:scale-105 hover:shadow-2xl flex text-white"
    >
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            ...buildLayerStyle(oldestSource),
            clipPath: bottomLayerClipPath,
          }}
        />
        {middleSource ? (
          <div
            className="absolute inset-0"
            style={{
              ...buildLayerStyle(middleSource),
              clipPath: middleLayerClipPath,
            }}
          />
        ) : null}
        {newestSource ? (
          <div
            className="absolute inset-0"
            style={{
              ...buildLayerStyle(newestSource),
              clipPath: topLayerClipPath,
            }}
          />
        ) : null}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-black/10 to-black/70" />
      <div className="relative w-full flex flex-col min-h-[320px] sm:min-h-[384px]">
        <div className="flex items-start justify-between p-4">
          <div className="flex flex-wrap gap-2 pr-3 text-left">
            <span className={`${liquidGlassBadgeClassName} uppercase tracking-[0.2em]`}>
              <span className="relative z-10">Gallery</span>
            </span>
            {hasNewImages ? (
              <span className={`${liquidGlassBadgeClassName} uppercase tracking-[0.1em]`}>
                <span className="relative z-10">{newImageBadgeLabel}</span>
              </span>
            ) : null}
          </div>
          <div className="relative shrink-0">
            <CollectionsIcon fontSize="large" />
            {hasNewImages ? (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/70" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border border-white/60 bg-amber-300" />
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex-grow px-4 pb-4 flex flex-col justify-end text-left">
          <h2 className="font-bold text-2xl leading-tight">View All Artwork</h2>
        </div>
      </div>
    </button>
  );
};
