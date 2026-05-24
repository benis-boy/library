import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGalleryManifestPath } from '../cacheVersioning';
import { ConfigurationContext } from '../context/ConfigurationContext';
import AccessRestrictedMessage from './notLoggedIn';
import PatreonMessage from './notASupporter';
import { ImageLightbox } from './gallery/ImageLightbox';
import {
  getNextChapterForBook,
  getReaderRoute,
  getReaderRouteForChapter,
  getStoredSelectedChapter,
  LibraryContext,
  normalizeChapterReference,
  normalizeRouteBookId,
  parseReaderRoute,
} from '../context/LibraryContext';

export const DataViewer = ({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement | null> }) => {
  const navigate = useNavigate();
  const params = useParams<{ bookId?: string; chapter?: string }>();
  const { isDarkMode, selectedFont, fontSize } = useContext(ConfigurationContext);
  const lContext = useContext(LibraryContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [galleryMap, setGalleryMap] = useState<Record<string, { fullSrc: string }>>({});
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);
  const {
    libraryData: { content, selectedBook, selectedChapter, accessDeniedReason } = {
      content: '',
      selectedBook: undefined,
      selectedChapter: undefined,
      accessDeniedReason: null,
    },
    setSelectedBook,
    setSelectedChapter,
  } = lContext || {};

  const baseUrl = import.meta.env.BASE_URL;

  useEffect(() => {
    let cancelled = false;

    const syncReaderState = async () => {
      if (!setSelectedBook || !setSelectedChapter) {
        return;
      }

      const routeBook = normalizeRouteBookId(params.bookId);
      if (!routeBook) {
        navigate('/', { replace: true });
        return;
      }

      const routeInfo = parseReaderRoute(params.bookId, params.chapter);

      if (!routeInfo) {
        const activeChapter =
          (selectedBook === routeBook ? normalizeChapterReference(selectedChapter) : undefined) || getStoredSelectedChapter(routeBook);

        if (activeChapter) {
          const currentPath = window.location.hash.replace(/^#/, '') || '/';
          const targetPath = await getReaderRouteForChapter(routeBook, activeChapter).catch(() => getReaderRoute(routeBook, activeChapter));
          if (!cancelled && currentPath !== targetPath) {
            navigate(targetPath, { replace: true });
          }
        } else {
          const result = await setSelectedBook(routeBook, true);
          if (cancelled || !result) {
            return;
          }

          const firstSelectedChapter = getStoredSelectedChapter(routeBook);
          if (!firstSelectedChapter) {
            return;
          }

          const currentPath = window.location.hash.replace(/^#/, '') || '/';
          const targetPath = await getReaderRouteForChapter(routeBook, firstSelectedChapter).catch(() =>
            getReaderRoute(routeBook, firstSelectedChapter)
          );
          if (!cancelled && currentPath !== targetPath) {
            navigate(targetPath, { replace: true });
          }
        }
        return;
      }

      const currentPath = window.location.hash.replace(/^#/, '') || '/';
      const canonicalPath = await getReaderRouteForChapter(routeInfo.book, routeInfo.chapter).catch(() =>
        getReaderRoute(routeInfo.book, routeInfo.chapter)
      );
      if (!cancelled && currentPath !== canonicalPath) {
        navigate(canonicalPath, { replace: true });
        return;
      }

      const currentSelection = selectedBook === routeInfo.book ? normalizeChapterReference(selectedChapter) : undefined;
      if (currentSelection === routeInfo.chapter && (content || accessDeniedReason)) {
        return;
      }

      const result = await setSelectedChapter(routeInfo.book, routeInfo.chapter);
      if (cancelled || !result) {
        return;
      }
    };

    void syncReaderState();

    return () => {
      cancelled = true;
    };
  }, [accessDeniedReason, content, navigate, params.bookId, params.chapter, selectedBook, selectedChapter, setSelectedBook, setSelectedChapter]);

  useEffect(() => {
    const adjustHeight = () => {
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (doc) {
          const h = doc.body.getBoundingClientRect().height + 'px';
          iframe.style.height = h;
          doc.body.parentElement!.style.height = h;
        }
      }
    };

    const iframe = iframeRef.current;

    function _adjust() {
      adjustHeight();
      setTimeout(() => {
        adjustHeight();
      }, 300);
    }
    if (iframe) {
      iframe.addEventListener('load', _adjust);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', _adjust);
      }
    };
  }, [content, iframeRef]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, [params.bookId, params.chapter, scrollerRef]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.location.reload();
    }
  }, [isDarkMode, selectedFont, fontSize]);

  useEffect(() => {
    let cancelled = false;

    const loadGalleryMap = async () => {
      try {
        const response = await fetch(getGalleryManifestPath(baseUrl));
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { images?: Array<{ id?: string; fullSrc?: string }> };
        if (!Array.isArray(payload.images)) {
          return;
        }

        const nextMap: Record<string, { fullSrc: string }> = {};
        for (const image of payload.images) {
          if (typeof image?.id !== 'string' || typeof image?.fullSrc !== 'string') {
            continue;
          }
          nextMap[image.id] = { fullSrc: image.fullSrc };
        }

        if (!cancelled) {
          setGalleryMap(nextMap);
        }
      } catch {
        if (!cancelled) {
          setGalleryMap({});
        }
      }
    };

    void loadGalleryMap();

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const isTrustedOrigin =
        event.origin.startsWith('https://benis-boy.github.io') ||
        event.origin.startsWith('http://localhost:') ||
        event.origin.startsWith('http://127.0.0.1:');
      if (!isTrustedOrigin) {
        return;
      }

      if (event.data?.type !== 'chapter-image-clicked') {
        return;
      }

      const imageId = event.data?.imageId;
      if (typeof imageId !== 'string' || !galleryMap[imageId]) {
        return;
      }

      setLightboxImageId(imageId);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [galleryMap]);

  const selectedLightboxImageSrc = useMemo(() => {
    if (!lightboxImageId) {
      return '';
    }

    const image = galleryMap[lightboxImageId];
    if (!image) {
      return '';
    }

    return `${baseUrl}${image.fullSrc.replace(/^\/+/, '')}`;
  }, [baseUrl, galleryMap, lightboxImageId]);

  if (!lContext) return <Fragment />;

  const readerBody = accessDeniedReason ? (
    accessDeniedReason === 'login_required' ? (
      <AccessRestrictedMessage />
    ) : (
      <PatreonMessage />
    )
  ) : (
    <div className="w-full flex lg:pl-4 px-2 lg:pr-0">
      <iframe
        ref={iframeRef}
        onLoad={() => injectStyles(iframeRef, { isDarkMode, selectedFont, fontSize })}
        srcDoc={`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${content}</div></html></body>`}
        className="flex-grow"
        title="Embedded Content"
      />
    </div>
  );

  const showNextChapterButton = !accessDeniedReason;

  return (
    <>
      {readerBody}

      {showNextChapterButton ? (
        <div className="flex justify-center mt-4 pb-4">
          <button
            className="px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
            style={{ maxWidth: '200px' }}
            onClick={async (e) => {
              e.currentTarget.blur();
              if (!setSelectedChapter) {
                return;
              }

              const routeBook = normalizeRouteBookId(params.bookId);
              const routeInfo = parseReaderRoute(params.bookId, params.chapter);
              const book = routeInfo?.book || routeBook || selectedBook;
              const currentChapter =
                routeInfo?.chapter ||
                (book && selectedBook === book ? normalizeChapterReference(selectedChapter) : undefined) ||
                (book ? getStoredSelectedChapter(book) : undefined);
              if (!book || !currentChapter) {
                return;
              }

            const nextChapter = await getNextChapterForBook(book, currentChapter);
            if (!nextChapter) {
              navigate('/reader/end');
              return;
            }

            const nextChapterReference = nextChapter.chapterId || nextChapter.chapter;
            navigate(getReaderRoute(book, nextChapterReference));
          }}
        >
            Next Chapter
          </button>
        </div>
      ) : null}

      <ImageLightbox
        open={Boolean(lightboxImageId && selectedLightboxImageSrc)}
        imageSrc={selectedLightboxImageSrc}
        imageAlt={lightboxImageId ? `Chapter image ${lightboxImageId}` : 'Chapter image'}
        onClose={() => setLightboxImageId(null)}
      />
    </>
  );
};
const injectStyles = (
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { isDarkMode, selectedFont, fontSize }: { isDarkMode: boolean; selectedFont: string; fontSize: number }
) => {
  const iframe = iframeRef.current;
  if (iframe) {
    const iframeDocument = iframe.contentDocument;
    if (iframeDocument) {
      const styleElement = iframeDocument.createElement('style');
      styleElement.innerHTML = `
        html, body { 
          margin: 0; 
          padding: 0;
          overflow: hidden;
        }
        body { 
          margin: 0; 
          margin-top: -16px;
          margin-bottom: -16px;
          padding: 0; 
          padding-top: 32px; 
          padding-bottom: 16px; 
          width: 100%;
        }

        p {
          color: ${isDarkMode ? '#ddd' : 'black'};
          font-family: ${selectedFont};
          font-size: ${fontSize}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
        }

        .chapter-image-trigger {
          display: flex;
          justify-content: center;
          align-items: center;
          width: fit-content;
          max-width: calc(100% - 20px);
          margin: 16px auto;
          min-height: 44px;
          padding: 8px;
          border: 1px solid ${isDarkMode ? '#4a596f' : '#a5b4c5'};
          border-radius: 10px;
          background: ${isDarkMode ? '#1b2a41' : '#eef2f7'};
          color: ${isDarkMode ? '#f5f7fa' : '#1f2937'};
          font-family: ${selectedFont};
          font-size: ${Math.max(14, fontSize - 1)}px;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
        }

        .chapter-image-trigger img {
          display: block;
          width: auto;
          max-width: min(100%, 320px);
          max-height: 320px;
          height: auto;
          object-fit: contain;
        }

        .chapter-image-trigger:hover {
          filter: brightness(1.05);
        }

        .chapter-image-trigger:focus {
          outline: 2px solid ${isDarkMode ? '#93c5fd' : '#1d4ed8'};
          outline-offset: 2px;
        }
      `;
      iframeDocument.head.appendChild(styleElement); // Append styles to the head of the iframe's document

      const scriptElement = iframeDocument.createElement('script');
      scriptElement.innerHTML = `
        document.addEventListener('click', function(event) {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }

          const trigger = target.closest('.chapter-image-trigger');
          if (!trigger) {
            return;
          }

          event.preventDefault();
          const imageId = trigger.getAttribute('data-image-id');
          if (!imageId) {
            return;
          }

          window.parent.postMessage({ type: 'chapter-image-clicked', imageId: imageId }, '*');
        });
      `;
      iframeDocument.head.appendChild(scriptElement);
    }
  }
};
