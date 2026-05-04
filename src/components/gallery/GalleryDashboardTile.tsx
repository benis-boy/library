import CollectionsIcon from '@mui/icons-material/Collections';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type GalleryImage = {
  id?: string;
  thumbSrc?: string;
  entryAddedAt?: string;
};

const BASE_URL = import.meta.env.BASE_URL;
const FIRST_LEFT = 50;
const FIRST_RIGHT = 40;
const SECOND_LEFT = 35;
const SECOND_RIGHT = 35;
const THIRD_LEFT = 15;
const THIRD_RIGHT = 25;

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

const FALLBACK_BACKGROUND = 'linear-gradient(160deg, rgba(95,15,64,1) 0%, rgba(154,3,30,1) 58%, rgba(251,139,36,1) 100%)';

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

  useEffect(() => {
    let cancelled = false;

    const loadGalleryPreview = async () => {
      try {
        const response = await fetch(`${BASE_URL}assets/gallery/gallery.json`, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { images?: GalleryImage[] };
        if (!Array.isArray(payload.images)) {
          return;
        }

        const sorted = payload.images
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

        if (!cancelled) {
          setGalleryPreviewSources(sorted);
        }
      } catch {
        if (!cancelled) {
          setGalleryPreviewSources([]);
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
          <span className="inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1 text-xs uppercase tracking-[0.2em]">
            Gallery
          </span>
          <CollectionsIcon fontSize="large" />
        </div>
        <div className="flex-grow px-4 pb-4 flex flex-col justify-end text-left">
          <h2 className="font-bold text-2xl leading-tight">View All Artwork</h2>
        </div>
      </div>
    </button>
  );
};
