import CloseIcon from '@mui/icons-material/Close';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';
import { useEffect, useRef } from 'react';

type ImageLightboxProps = {
  open: boolean;
  imageSrc: string;
  imageAlt: string;
  onClose: () => void;
};

const DOUBLE_TAP_MAX_DELAY_MS = 280;
const DOUBLE_TAP_MAX_DISTANCE_PX = 28;
const DOUBLE_TAP_ZOOM_SCALE = 2;

const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

export const ImageLightbox = ({ open, imageSrc, imageAlt, onClose }: ImageLightboxProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const lastTouchTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const drawerPapers = Array.from(document.querySelectorAll<HTMLElement>('.MuiDrawer-paper'));
    const previousDrawerOverflow = drawerPapers.map((drawer) => drawer.style.overflow);
    drawerPapers.forEach((drawer) => {
      drawer.style.overflow = 'hidden';
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      drawerPapers.forEach((drawer, index) => {
        drawer.style.overflow = previousDrawerOverflow[index] || '';
      });
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const viewportElement = viewportRef.current;
    const imageElement = imageRef.current;
    if (!viewportElement || !imageElement) {
      return;
    }

    let currentPanzoom: PanzoomObject | null = null;

    const teardownPanzoom = () => {
      if (!currentPanzoom) {
        return;
      }

      viewportElement.removeEventListener('wheel', handleWheelZoom);
      imageElement.removeEventListener('pointerup', handlePointerUp);
      currentPanzoom.destroy();
      currentPanzoom = null;
      panzoomRef.current = null;
    };

    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      currentPanzoom?.zoomWithWheel(event);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !currentPanzoom) {
        return;
      }

      const now = Date.now();
      const tapPoint = { x: event.clientX, y: event.clientY };
      const lastTap = lastTouchTapRef.current;

      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MAX_DELAY_MS &&
        getDistance(lastTap, tapPoint) <= DOUBLE_TAP_MAX_DISTANCE_PX
      ) {
        const currentScale = currentPanzoom.getScale();
        const targetScale = currentScale < DOUBLE_TAP_ZOOM_SCALE - 0.05 ? DOUBLE_TAP_ZOOM_SCALE : 1;
        currentPanzoom.zoomToPoint(
          targetScale,
          { clientX: event.clientX, clientY: event.clientY },
          { animate: true, force: true }
        );
        lastTouchTapRef.current = null;
        return;
      }

      lastTouchTapRef.current = { time: now, x: tapPoint.x, y: tapPoint.y };
    };

    const initializePanzoom = () => {
      teardownPanzoom();

      const viewportRect = viewportElement.getBoundingClientRect();
      const imageRect = imageElement.getBoundingClientRect();
      const startX = (viewportRect.width - imageRect.width) / 2;
      const startY = (viewportRect.height - imageRect.height) / 2;

      currentPanzoom = Panzoom(imageElement, {
        minScale: 0.5,
        startScale: 1,
        startX,
        startY,
        maxScale: 6,
        step: 0.2,
        panOnlyWhenZoomed: false,
        touchAction: 'none',
        cursor: 'grab',
        canvas: false,
      });

      viewportElement.addEventListener('wheel', handleWheelZoom, { passive: false });
      imageElement.addEventListener('pointerup', handlePointerUp);
      panzoomRef.current = currentPanzoom;

      requestAnimationFrame(() => {
        currentPanzoom?.reset({ animate: false, force: true });
      });
    };

    const isImageReady = imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0;
    if (isImageReady) {
      initializePanzoom();
    } else {
      imageElement.addEventListener('load', initializePanzoom);
    }

    return () => {
      imageElement.removeEventListener('load', initializePanzoom);
      teardownPanzoom();
      lastTouchTapRef.current = null;
    };
  }, [imageSrc, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2200] bg-black/90 p-3 sm:p-6 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute z-[2300] top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-black/45 text-white border border-white/35 shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-sm hover:bg-black/65 transition-colors flex items-center justify-center"
      >
        <CloseIcon className="mix-blend-difference drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
      </button>

      <figure
        className="w-[95vw] h-[92vh] m-0 flex items-center justify-center"
      >
        <div ref={viewportRef} className="w-full h-full flex overflow-hidden select-none">
          <img
            ref={imageRef}
            src={imageSrc}
            alt={imageAlt}
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            className="object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
            decoding="async"
          />
        </div>
      </figure>
    </div>
  );
};
