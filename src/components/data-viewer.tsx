import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGalleryManifestPath } from '../cacheVersioning';
import { CommentSection } from '../comments/comment-section';
import { fetchPageCommentSummary } from '../comments/comments-api';
import { PageLocationId, ThreadLocationId } from '../comments/dataModel';
import { createParagraphLocation, type Paragraph } from '../comments/paragraph-comments/paragraph-locator';
import { ConfigurationContext } from '../context/ConfigurationContext';
import dataViewerIframeScript from './data-viewer-iframe-script.js?raw';
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
  const [paragraphCommentLocation, setParagraphCommentLocation] = useState<ThreadLocationId | null>(null);
  const [paragraphCommentCounts, setParagraphCommentCounts] = useState<Record<number, number>>({});
  const [activeParagraphCommentCount, setActiveParagraphCommentCount] = useState(0);
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
          (selectedBook === routeBook ? normalizeChapterReference(selectedChapter) : undefined) ||
          getStoredSelectedChapter(routeBook);

        if (activeChapter) {
          const currentPath = window.location.hash.replace(/^#/, '') || '/';
          const targetPath = await getReaderRouteForChapter(routeBook, activeChapter).catch(() =>
            getReaderRoute(routeBook, activeChapter)
          );
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
  }, [
    accessDeniedReason,
    content,
    navigate,
    params.bookId,
    params.chapter,
    selectedBook,
    selectedChapter,
    setSelectedBook,
    setSelectedChapter,
  ]);

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
    const routeInfo = parseReaderRoute(params.bookId, params.chapter);
    const pageLocationId = routeInfo
      ? { bookId: routeInfo.book, chapterId: routeInfo.chapter }
      : selectedChapter
        ? { bookId: selectedBook, chapterId: selectedChapter }
        : null;
    let cancelled = false;

    const loadParagraphCommentCounts = async () => {
      if (!pageLocationId || accessDeniedReason) {
        setParagraphCommentCounts({});
        return;
      }

      try {
        const summary = await fetchPageCommentSummary(pageLocationId);
        if (cancelled) {
          return;
        }

        const countsByParagraphIndex: Record<number, number> = {};
        for (const threadKey of summary.lineThreadKeys) {
          const match = threadKey.match(/:paragraph:(\d+):[^:]+$/);
          if (!match) {
            continue;
          }

          const paragraphIndex = Number(match[1]);
          if (!Number.isInteger(paragraphIndex)) {
            continue;
          }

          countsByParagraphIndex[paragraphIndex] =
            (countsByParagraphIndex[paragraphIndex] ?? 0) + (summary.commentCountsByThreadKey[threadKey] ?? 0);
        }

        setParagraphCommentCounts(countsByParagraphIndex);
      } catch {
        if (!cancelled) {
          setParagraphCommentCounts({});
        }
      }
    };

    void loadParagraphCommentCounts();

    return () => {
      cancelled = true;
    };
  }, [accessDeniedReason, params.bookId, params.chapter, selectedBook, selectedChapter]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'paragraph-comment-counts-updated',
        countsByParagraphIndex: paragraphCommentCounts,
      },
      '*'
    );
  }, [content, paragraphCommentCounts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const isTrustedOrigin =
        event.origin.startsWith('https://benis-boy.github.io') ||
        event.origin.startsWith('http://localhost:') ||
        event.origin.startsWith('http://127.0.0.1:');
      if (!isTrustedOrigin) {
        return;
      }

      if (event.data?.type === 'chapter-image-clicked') {
        const imageId = event.data?.imageId;
        if (typeof imageId !== 'string' || !galleryMap[imageId]) {
          return;
        }

        setLightboxImageId(imageId);
        return;
      }

      if (event.data?.type === 'paragraph-comment-requested') {
        const paragraphIndex = event.data?.paragraphIndex;
        const routeInfo = parseReaderRoute(params.bookId, params.chapter);
        const bookId = routeInfo?.book || selectedBook;
        const chapterId = routeInfo?.chapter || selectedChapter;
        if (typeof paragraphIndex !== 'number' || !bookId || !chapterId || !iframeRef.current?.contentDocument) {
          return;
        }

        const paragraphs: Paragraph[] = Array.from(
          iframeRef.current.contentDocument.querySelectorAll('p[data-paragraph-index]')
        ).map((paragraph) => ({ content: paragraph.textContent?.trim() ?? '' }));
        if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
          return;
        }

        const paragraphLocation = createParagraphLocation(bookId, chapterId, paragraphs, paragraphIndex);
        console.log('ParagraphLocation', paragraphLocation);
        setActiveParagraphCommentCount(paragraphCommentCounts[paragraphIndex] ?? 0);
        setParagraphCommentLocation({ bookId, chapterId, paragraphLocation });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [galleryMap, paragraphCommentCounts, params.bookId, params.chapter, selectedBook, selectedChapter]);

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

  const handleParagraphModalCommentCountChange = useCallback(
    (commentCount: number) => {
      setActiveParagraphCommentCount(commentCount);

      const paragraphIndex = paragraphCommentLocation?.paragraphLocation?.paragraphIndex;
      if (paragraphIndex === undefined) {
        return;
      }

      setParagraphCommentCounts((previousCounts) => {
        if ((previousCounts[paragraphIndex] ?? 0) === commentCount) {
          return previousCounts;
        }

        if (commentCount <= 0) {
          const nextCounts = { ...previousCounts };
          delete nextCounts[paragraphIndex];
          return nextCounts;
        }

        return {
          ...previousCounts,
          [paragraphIndex]: commentCount,
        };
      });
    },
    [paragraphCommentLocation]
  );

  if (!lContext) return <Fragment />;

  const routeInfo = parseReaderRoute(params.bookId, params.chapter);
  const commentLocation: PageLocationId | null = routeInfo
    ? { bookId: routeInfo.book, chapterId: routeInfo.chapter }
    : selectedChapter
      ? { bookId: selectedBook, chapterId: selectedChapter }
      : null;

  const readerBody = accessDeniedReason ? (
    accessDeniedReason === 'login_required' ? (
      <AccessRestrictedMessage />
    ) : (
      <PatreonMessage />
    )
  ) : (
    <div className="w-full flex">
      <iframe
        ref={iframeRef}
        onLoad={() => {
          injectStyles(iframeRef, { isDarkMode, selectedFont, fontSize });
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'paragraph-comment-counts-updated',
              countsByParagraphIndex: paragraphCommentCounts,
            },
            '*'
          );
        }}
        srcDoc={`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${content}</div></html></body>`}
        className="flex-grow"
        title="Embedded Content"
      />
    </div>
  );

  const showNextChapterButton = !accessDeniedReason;

  return (
    <>
      <div className="w-full px-2 lg:pl-4 lg:pr-0 pb-8">
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

        {commentLocation ? <CommentSection locationId={commentLocation} className="mt-8 mb-4" /> : null}
      </div>

      <ImageLightbox
        open={Boolean(lightboxImageId && selectedLightboxImageSrc)}
        imageSrc={selectedLightboxImageSrc}
        imageAlt={lightboxImageId ? `Chapter image ${lightboxImageId}` : 'Chapter image'}
        onClose={() => setLightboxImageId(null)}
      />

      {paragraphCommentLocation ? (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/60 px-3 py-6" onClick={() => setParagraphCommentLocation(null)}>
          <div
            className={`max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl p-5 shadow-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
                {activeParagraphCommentCount} Paragraph Comment{activeParagraphCommentCount === 1 ? '' : 's'}
              </h2>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  isDarkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setParagraphCommentLocation(null)}
              >
                Close
              </button>
            </div>
            <CommentSection
              locationId={paragraphCommentLocation}
              hideDefaultHeader
              onCommentCountChange={handleParagraphModalCommentCountChange}
            />
          </div>
        </div>
      ) : null}
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
          position: relative;
          color: ${isDarkMode ? '#ddd' : 'black'};
          font-family: ${selectedFont};
          font-size: ${fontSize}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
        }

        p.paragraph-comment-target {
          border-radius: 10px;
          background: ${isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(241, 245, 249, 0.92)'};
          box-shadow: inset 0 0 0 1px ${isDarkMode ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.45)'};
        }

        .paragraph-comment-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.6em;
          height: 1.35em;
          margin-left: 0.45em;
          padding: 0 0.45em;
          border-radius: 999px;
          background: ${isDarkMode ? '#334155' : '#e2e8f0'};
          color: ${isDarkMode ? '#e2e8f0' : '#334155'};
          font-family: ${selectedFont};
          font-size: ${Math.max(11, fontSize - 5)}px;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
          vertical-align: 0.12em;
          cursor: pointer;
        }

        .paragraph-comment-count:hover {
          background: ${isDarkMode ? '#475569' : '#cbd5e1'};
        }

        .paragraph-comment-count:focus {
          outline: 2px solid ${isDarkMode ? '#93c5fd' : '#1d4ed8'};
          outline-offset: 2px;
        }

        .paragraph-comment-button-hit-area {
          position: absolute;
          z-index: 10;
          display: none;
          align-items: center;
          justify-content: center;
          width: min(260px, calc(100% - 16px));
          height: 58px;
        }

        .paragraph-comment-button-hit-area.is-visible {
          display: flex;
        }

        .paragraph-comment-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          padding: 0 14px;
          border: 1px solid ${isDarkMode ? '#64748b' : '#94a3b8'};
          border-radius: 999px;
          background: ${isDarkMode ? '#1e293b' : '#ffffff'};
          color: ${isDarkMode ? '#e2e8f0' : '#334155'};
          font-family: ${selectedFont};
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
          cursor: pointer;
        }

        .paragraph-comment-button::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -6px;
          width: 10px;
          height: 10px;
          border-right: 1px solid ${isDarkMode ? '#64748b' : '#94a3b8'};
          border-bottom: 1px solid ${isDarkMode ? '#64748b' : '#94a3b8'};
          background: ${isDarkMode ? '#1e293b' : '#ffffff'};
          transform: translateX(-50%) rotate(45deg);
        }

        .paragraph-comment-button:hover {
          background: ${isDarkMode ? '#334155' : '#f8fafc'};
        }

        .paragraph-comment-button:focus {
          outline: 2px solid ${isDarkMode ? '#93c5fd' : '#1d4ed8'};
          outline-offset: 2px;
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
      scriptElement.textContent = dataViewerIframeScript;
      iframeDocument.head.appendChild(scriptElement);
    }
  }
};
