import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import './index.css';
import pssjManifest from '../book-data/PSSJ_raw/PSSJ_chapters.json';
import sowbManifest from '../book-data/SoWB_raw/SoWB_chapters.json';
import wtdrManifest from '../book-data/WtDR_raw/WtDR_chapters.json';
import basicBookData from './basicBookData.json';
import type { SourceType } from './constants';
import { FullAppHarness } from './storybook/FullAppHarness';
import { clearChapterMetadataCache } from './context/LibraryContext';

type ChapterManifestEntry = {
  chapterId?: string;
  chapter: string;
  title: string;
  isSecured: boolean;
  contentVersion?: string;
  volume?: string;
};

type ChapterManifest = {
  bookId: SourceType;
  chapters: ChapterManifestEntry[];
};

type StoryChapter = {
  book: SourceType;
  chapterId: string;
  chapterPath: string;
  title: string;
  isSecured: boolean;
  sourceFileUrl: string;
};

const getBookTitle = (book: SourceType) => {
  const title = basicBookData.find((entry) => entry.id === book)?.title;
  if (!title) {
    throw new Error(`Missing book title for ${book}`);
  }

  return title;
};

const PSSJ_BOOK_TITLE = getBookTitle('PSSJ');
const WTDR_BOOK_TITLE = getBookTitle('WtDR');
const SOWB_BOOK_TITLE = getBookTitle('SoWB');

const chapterFirstParagraphCache = new Map<string, Promise<string>>();

const chapterManifests: Record<SourceType, ChapterManifest> = {
  PSSJ: pssjManifest as ChapterManifest,
  WtDR: wtdrManifest as ChapterManifest,
  SoWB: sowbManifest as ChapterManifest,
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const encodePathSegments = (value: string) =>
  value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const getChapterSourceFileUrl = (book: SourceType, chapterPath: string) => {
  const normalizedChapterPath = chapterPath.replace(/\\/g, '/');
  const expectedPrefix = `${book}/`;
  if (!normalizedChapterPath.startsWith(expectedPrefix)) {
    throw new Error(`Unexpected chapter path for ${book}: ${chapterPath}`);
  }

  return `/storybook-book-data/${book}_raw/${encodePathSegments(normalizedChapterPath.slice(expectedPrefix.length))}`;
};

const getFirstParagraphFromHtml = (html: string) => {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  const firstParagraph = normalizeText(documentFragment.querySelector('p')?.textContent || '');
  if (!firstParagraph) {
    throw new Error('Could not find a first paragraph in the chapter source file.');
  }

  return firstParagraph;
};

const getChapterFirstParagraph = async (chapter: StoryChapter) => {
  const cached = chapterFirstParagraphCache.get(chapter.sourceFileUrl);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await fetch(chapter.sourceFileUrl);
    if (!response.ok) {
      throw new Error(`Could not read chapter source file (${response.status}): ${chapter.sourceFileUrl}`);
    }

    return getFirstParagraphFromHtml(await response.text());
  })();

  chapterFirstParagraphCache.set(chapter.sourceFileUrl, promise);
  return promise;
};

const buildStoryChapter = (book: SourceType, entry: ChapterManifestEntry): StoryChapter => {
  const chapterId = entry.chapterId?.trim();
  if (!chapterId) {
    throw new Error(`Missing chapterId for ${book}: ${entry.title}`);
  }

  return {
    book,
    chapterId,
    chapterPath: entry.chapter,
    title: entry.title.trim(),
    isSecured: entry.isSecured === true,
    sourceFileUrl: getChapterSourceFileUrl(book, entry.chapter),
  };
};

const storyChaptersByBook: Record<SourceType, StoryChapter[]> = {
  PSSJ: chapterManifests.PSSJ.chapters.map((entry) => buildStoryChapter('PSSJ', entry)),
  WtDR: chapterManifests.WtDR.chapters.map((entry) => buildStoryChapter('WtDR', entry)),
  SoWB: chapterManifests.SoWB.chapters.map((entry) => buildStoryChapter('SoWB', entry)),
};

const getStoryChapterByIndex = (book: SourceType, index: number) => {
  const chapter = storyChaptersByBook[book][index];
  if (!chapter) {
    throw new Error(`Missing chapter ${index + 1} for ${book}.`);
  }

  return chapter;
};

const getFirstSecuredStoryChapter = (book: SourceType) => {
  const chapter = storyChaptersByBook[book].find((entry) => entry.isSecured);
  if (!chapter) {
    throw new Error(`Missing secured chapter for ${book}.`);
  }

  return chapter;
};

const pssjFirstChapter = getStoryChapterByIndex('PSSJ', 0);
const pssjSecondChapter = getStoryChapterByIndex('PSSJ', 1);
const sowbFirstChapter = getStoryChapterByIndex('SoWB', 0);
const sowbSecondChapter = getStoryChapterByIndex('SoWB', 1);
const wtdrFirstChapter = getStoryChapterByIndex('WtDR', 0);
const wtdrSecondChapter = getStoryChapterByIndex('WtDR', 1);
const wtdrThirdChapter = getStoryChapterByIndex('WtDR', 2);
const wtdrFirstSecuredChapter = getFirstSecuredStoryChapter('WtDR');

const getTileByHeading = async (canvas: ReturnType<typeof within>, title: string) => {
  const matches = await canvas.findAllByText(title);
  const tile = matches
    .map((match: HTMLElement) => match.closest('div.shadow-lg'))
    .find((candidate: Element | null): candidate is HTMLElement => candidate instanceof HTMLElement);

  if (!tile) {
    throw new Error(`Could not find the ${title} dashboard tile.`);
  }

  return tile;
};

const getNavigatorFrame = async (canvasElement: HTMLElement) => {
  return waitFor(() => {
    const frame = canvasElement.querySelector('iframe[title="External HTML"]') as HTMLIFrameElement | null;
    if (!frame?.contentDocument) {
      throw new Error('Navigator iframe is not ready yet.');
    }

    return frame;
  });
};

const getReaderFrameBody = async (canvasElement: HTMLElement) => {
  return waitFor(() => {
    const iframe = canvasElement.querySelector('iframe[title="Embedded Content"]') as HTMLIFrameElement | null;
    if (!iframe?.contentDocument?.body) {
      throw new Error('Reader iframe is not ready yet.');
    }

    const body = iframe.contentDocument.body;
    if (!body.textContent?.trim()) {
      throw new Error('Reader iframe does not contain content yet.');
    }

    return body;
  });
};

const getReaderFirstParagraphText = async (canvasElement: HTMLElement) => {
  return waitFor(() => {
    // Query the live iframe on every retry: chapter changes replace srcDoc documents,
    // so retaining the prior document body can wait forever on a detached frame.
    const iframe = canvasElement.querySelector<HTMLIFrameElement>('iframe[title="Embedded Content"]');
    const firstParagraph = normalizeText(iframe?.contentDocument?.querySelector('p')?.textContent || '');
    if (!firstParagraph) {
      throw new Error('Reader first paragraph is not ready yet.');
    }

    return firstParagraph;
  }, { timeout: 10000 });
};

const expectNavigatorHighlight = async (canvasElement: HTMLElement, label: string) => {
  const navigatorFrame = await getNavigatorFrame(canvasElement);

  await waitFor(() => {
    const highlightedLink = Array.from(navigatorFrame.contentDocument?.querySelectorAll('a.highlight') || []).find(
      (link) => link.textContent?.includes(label)
    );

    if (!highlightedLink) {
      throw new Error(`Navigator did not highlight chapter: ${label}`);
    }

    expect(highlightedLink).toBeVisible();
  });
};

const clickNavigatorChapter = async (canvasElement: HTMLElement, label: string) => {
  const navigatorFrame = await getNavigatorFrame(canvasElement);

  const link = await waitFor(() => {
    const match = Array.from(navigatorFrame.contentDocument?.querySelectorAll('a') || []).find((anchor) =>
      anchor.textContent?.includes(label)
    ) as HTMLAnchorElement | undefined;

    if (!match) {
      throw new Error(`Navigator chapter link not found: ${label}`);
    }

    return match;
  });

  const rawOnClick = link.getAttribute('onclick') || '';
  const match = rawOnClick.match(/loadContent\('((?:\\'|[^'])*)'(?:,\s*(true|false))?\)/);
  if (!match) {
    throw new Error(`Navigator chapter link does not contain loadContent parameters: ${label}`);
  }

  const chapter = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const isPaid = match[2] === 'true';
  const frameWindow = navigatorFrame.contentWindow as
    | (Window & {
        loadContent?: (url: string, isPaid?: boolean) => void;
      })
    | null;

  if (typeof frameWindow?.loadContent !== 'function') {
    throw new Error('Navigator iframe loadContent helper is not ready yet.');
  }

  frameWindow.loadContent(chapter, isPaid);
};

const expectBookTitle = async (title: string) => {
  await waitFor(() => expect((document.getElementById('bookTitle')?.textContent || '').trim()).toBe(title));
};

const expectReaderHash = async (hash: string) => {
  await waitFor(() => expect(window.location.hash).toBe(hash));
};

const getChapterHash = (chapter: StoryChapter) => `#/reader/${chapter.book}/${chapter.chapterId}`;

const getButtonById = (id: string) => {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find button: ${id}`);
  }

  return button;
};

const verifyChapter = async (canvasElement: HTMLElement, chapter: StoryChapter) => {
  const expectedFirstParagraph = await getChapterFirstParagraph(chapter);

  await expectReaderHash(getChapterHash(chapter));
  await expectNavigatorHighlight(canvasElement, chapter.title);

  const firstParagraph = await getReaderFirstParagraphText(canvasElement);
  expect(firstParagraph).toBe(expectedFirstParagraph);
};

const verifyRenderedChapter = async (canvasElement: HTMLElement, chapter: StoryChapter) => {
  await expectReaderHash(getChapterHash(chapter));
  await expectNavigatorHighlight(canvasElement, chapter.title);
  const result = await waitFor(() => {
    const error = canvasElement.querySelector<HTMLElement>('[data-reader-load-state="error"]');
    if (error) {
      return { error: error.innerText };
    }
    const iframe = canvasElement.querySelector<HTMLIFrameElement>('iframe[title="Embedded Content"]');
    const firstParagraph = normalizeText(iframe?.contentDocument?.querySelector('p')?.textContent || '');
    if (!firstParagraph) {
      throw new Error('Waiting for selected chapter text.');
    }
    return { firstParagraph };
  }, { timeout: 10000 });
  if (result?.error) {
    throw new Error(`Chapter selection failed: ${result.error}`);
  }
  const firstParagraph = result?.firstParagraph || '';
  expect(firstParagraph.length).toBeGreaterThan(0);
  return firstParagraph;
};

const expectReadableDecryptedParagraph = async (canvasElement: HTMLElement) => {
  const firstParagraph = await getReaderFirstParagraphText(canvasElement);

  expect(firstParagraph).toMatch(/[A-Za-z]{3,}(?:\s+[A-Za-z][A-Za-z'.,-]*){5,}/);
  expect(firstParagraph).not.toMatch(/^[A-Za-z0-9+/=]{32,}$/);
};

const verifyBlockedChapter = async ({
  canvas,
  canvasElement,
  chapter,
  heading,
  body,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
  chapter: StoryChapter;
  heading: string;
  body: string | RegExp;
}) => {
  await expectReaderHash(getChapterHash(chapter));
  await expectNavigatorHighlight(canvasElement, chapter.title);
  await expect(await canvas.findByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(await canvas.findByText(body)).toBeVisible();
  await expect(canvas.queryByRole('button', { name: 'Next Chapter' })).toBeNull();
  await expect(canvas.queryByRole('heading', { level: 2, name: /comments/i })).toBeNull();

  const readerFrame = canvasElement.querySelector('iframe[title="Embedded Content"]');
  expect(readerFrame).toBeNull();
};

const meta = {
  title: 'App/Whole App',
  component: FullAppHarness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    initialHash: '#/',
    isLoggedIn: true,
    isSupporter: true,
    userName: 'Storybook Supporter',
  },
  argTypes: {
    initialHash: { control: 'text' },
    isLoggedIn: { control: 'boolean' },
    isSupporter: { control: 'boolean' },
    userName: { control: 'text' },
    storageState: { control: false },
    selectedBook: { control: false },
    selectedChapter: { control: false },
    simulateTouch: { control: false },
    simulateIOS: { control: false },
    showConfigurationTestControls: { control: false },
    showAccessTestControls: { control: false },
  },
} satisfies Meta<typeof FullAppHarness>;

export default meta;

type Story = StoryObj<typeof meta>;
type StoryPlay = NonNullable<Story['play']>;
type StoryPlayContext = Parameters<StoryPlay>[0];

export const ChangingBooksUpdatesTitleAndNavigator: Story = {
  name: '1. Changing books updates title and navigator',
  args: {
    storageState: {
      SELECTED_BOOK: 'PSSJ',
      PSSJ_SELECTED_CHAPTER: pssjFirstChapter.chapterId,
      WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Homepage shows the library heading', async () => {
      await expect(await canvas.findByText("BenisBoy's Library")).toBeVisible();
    });

    await step('Homepage shows the PSSJ and WtDR book tiles', async () => {
      const pssjTile = await getTileByHeading(canvas, PSSJ_BOOK_TITLE);
      await expect(within(pssjTile).getByText(PSSJ_BOOK_TITLE)).toBeVisible();
      await expect(await canvas.findByText(WTDR_BOOK_TITLE)).toBeVisible();
    });

    await step('PSSJ starts selected in the header and navigator', async () => {
      await expectBookTitle(PSSJ_BOOK_TITLE);
      await expectNavigatorHighlight(canvasElement, pssjFirstChapter.title);
    });

    await step('Selecting WtDR updates the header and navigator', async () => {
      const wtdrTile = await getTileByHeading(canvas, WTDR_BOOK_TITLE);
      await userEvent.click(wtdrTile);

      await expectBookTitle(WTDR_BOOK_TITLE);
      await expectNavigatorHighlight(canvasElement, wtdrFirstChapter.title);
    });
  },
};

export const ClearStorageShowsStartReadingAndLoadsFirstChapter: Story = {
  name: '2. Clearing storage resets start reading behavior',
  args: {
    initialHash: '#/settings',
    storageState: {
      SELECTED_BOOK: 'WtDR',
      PSSJ_SELECTED_CHAPTER: pssjSecondChapter.chapterId,
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
      SoWB_SELECTED_CHAPTER: sowbSecondChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Use Clear Local Files and return to the homepage', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Clear Local Files (Debug)' }));

      await waitFor(() => {
        expect(window.localStorage.getItem('PSSJ_SELECTED_CHAPTER')).toBeNull();
        expect(window.localStorage.getItem('WtDR_SELECTED_CHAPTER')).toBeNull();
        expect(window.localStorage.getItem('SoWB_SELECTED_CHAPTER')).toBeNull();
      });

      await userEvent.click(getButtonById('home-button'));
      await expect(await canvas.findByText("BenisBoy's Library")).toBeVisible();
    });

    await step('Every book shows Start Reading', async () => {
      const startButtons = await canvas.findAllByRole('button', { name: 'Start Reading' });
      await expect(startButtons).toHaveLength(3);
    });

    await step('Starting PSSJ opens its first chapter', async () => {
      const pssjTile = await getTileByHeading(canvas, PSSJ_BOOK_TITLE);
      await userEvent.click(within(pssjTile).getByRole('button', { name: 'Start Reading' }));

      await verifyChapter(canvasElement, pssjFirstChapter);
    });
  },
};

export const StartReadingOnNonSelectedBookSelectsAndLoadsFirstChapter: Story = {
  name: '3. Start reading selects unselected book and opens first chapter',
  args: {
    storageState: {
      SELECTED_BOOK: 'PSSJ',
      PSSJ_SELECTED_CHAPTER: pssjFirstChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('PSSJ starts selected on the homepage', async () => {
      await expectBookTitle(PSSJ_BOOK_TITLE);
    });

    await step('Starting SoWB selects the book and opens its first chapter', async () => {
      const sowbTile = await getTileByHeading(canvas, SOWB_BOOK_TITLE);
      await userEvent.click(within(sowbTile).getByRole('button', { name: 'Start Reading' }));

      await expectBookTitle(SOWB_BOOK_TITLE);
      await verifyChapter(canvasElement, sowbFirstChapter);
    });
  },
};

export const NavigatorSelectionAndNextChapterFlow: Story = {
  name: '4. Navigator selection and next chapter flow in WtDR',
  tags: ['navigator-chapter-flow-reliability-regression'],
  args: {
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('WtDR opens on chapter 1', async () => {
      await verifyChapter(canvasElement, wtdrFirstChapter);
    });

    await step('Selecting chapter 2 in the navigator updates route, highlight, and content', async () => {
      await clickNavigatorChapter(canvasElement, wtdrSecondChapter.title);

      await verifyChapter(canvasElement, wtdrSecondChapter);
    });

    await step('Next Chapter advances to chapter 3 and updates route, highlight, and content', async () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      await userEvent.click(await canvas.findByRole('button', { name: 'Next Chapter' }));

      await verifyChapter(canvasElement, wtdrThirdChapter);
    });
  },
};

export const ContinueWhereYouLeftOffLoadsStoredChapter: Story = {
  name: '5. Continue where you left off loads stored chapter',
  tags: ['continue-auth-regression', 'continue-stored-chapter-reliability-regression'],
  args: {
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Homepage shows continue-reading for WtDR', async () => {
      await expect(await canvas.findByText("BenisBoy's Library")).toBeVisible();

      const wtdrTile = await getTileByHeading(canvas, WTDR_BOOK_TITLE);
      await expect(within(wtdrTile).getByRole('button', { name: 'Continue where you left off' })).toBeVisible();
    });

    await step('Continuing WtDR opens the stored secured chapter and highlights it', async () => {
      const wtdrTile = await getTileByHeading(canvas, WTDR_BOOK_TITLE);
      await userEvent.click(within(wtdrTile).getByRole('button', { name: 'Continue where you left off' }));

      await expectReadableDecryptedParagraph(canvasElement);
      await verifyChapter(canvasElement, wtdrFirstSecuredChapter);
    });
  },
};

export const ContinueFreeChapterWhileLoggedOut: Story = {
  name: '8. Logged-out Continue opens the saved free chapter',
  tags: ['continue-auth-regression'],
  args: {
    isLoggedIn: false,
    isSupporter: false,
    storageState: {
      SELECTED_BOOK: 'PSSJ',
      PSSJ_SELECTED_CHAPTER: pssjSecondChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Continue opens the canonical saved free chapter without login', async () => {
      const tile = await getTileByHeading(canvas, PSSJ_BOOK_TITLE);
      await userEvent.click(within(tile).getByRole('button', { name: 'Continue where you left off' }));

      await verifyChapter(canvasElement, pssjSecondChapter);
      expect(window.localStorage.getItem('PSSJ_SELECTED_CHAPTER')).toBe(pssjSecondChapter.chapterId);
    });
  },
};

export const ContinueSecuredChapterWhileLoggedOut: Story = {
  name: '9. Logged-out Continue retains saved secured chapter behind login gate',
  tags: ['continue-auth-regression'],
  args: {
    isLoggedIn: false,
    isSupporter: false,
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Continue preserves the saved secured route and displays the login gate', async () => {
      const tile = await getTileByHeading(canvas, WTDR_BOOK_TITLE);
      await userEvent.click(within(tile).getByRole('button', { name: 'Continue where you left off' }));

      await verifyBlockedChapter({
        canvas,
        canvasElement,
        chapter: wtdrFirstSecuredChapter,
        heading: 'Access Restricted',
        body: /You need to log in to view this content/i,
      });
      expect(window.localStorage.getItem('WtDR_SELECTED_CHAPTER')).toBe(wtdrFirstSecuredChapter.chapterId);
    });
  },
};

export const ContinueSecuredChapterAsLoggedInNonSupporter: Story = {
  name: '10. Non-supporter Continue retains saved secured chapter behind Patreon gate',
  tags: ['continue-auth-regression'],
  args: {
    isLoggedIn: true,
    isSupporter: false,
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Continue preserves the saved secured route and displays the Patreon gate', async () => {
      const tile = await getTileByHeading(canvas, WTDR_BOOK_TITLE);
      await userEvent.click(within(tile).getByRole('button', { name: 'Continue where you left off' }));

      await verifyBlockedChapter({
        canvas,
        canvasElement,
        chapter: wtdrFirstSecuredChapter,
        heading: 'Support me on Patreon',
        body: /To access the full content, please consider subscribing to me on/i,
      });
      expect(window.localStorage.getItem('WtDR_SELECTED_CHAPTER')).toBe(wtdrFirstSecuredChapter.chapterId);
    });
  },
};

export const TouchNavigatorStartsVisible: Story = {
  name: '11. Touch navigator starts open and has an accessible toggle',
  tags: ['navigator-touch-regression', 'navigator-touch-policy-regression'],
  args: {
    simulateTouch: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId,
    },
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('Fresh touch mount shows the navigator', async () => {
      const navigatorFrame = await waitFor(() => {
        const frame = document.querySelector('iframe[title="External HTML"]') as HTMLIFrameElement | null;
        if (!frame?.contentDocument) {
          throw new Error('Touch navigator iframe is not ready yet.');
        }
        return frame;
      });
      await expect(navigatorFrame).toBeVisible();
    });

    await step('Closed navigator exposes an accessible portrait toggle and can be reopened by touch swipe', async () => {
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (!(backdrop instanceof HTMLElement)) {
        throw new Error('The open mobile navigator backdrop was not found.');
      }
      await userEvent.click(backdrop);

      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).not.toBeVisible());
      const navigatorToggle = await canvas.findByRole('button', { name: 'Toggle chapter navigator' });
      await expect(navigatorToggle).toBeVisible();
      await userEvent.click(navigatorToggle);
      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).toBeVisible());

      const reopenedBackdrop = document.querySelector('.MuiBackdrop-root');
      if (!(reopenedBackdrop instanceof HTMLElement)) {
        throw new Error('The reopened mobile navigator backdrop was not found.');
      }
      await userEvent.click(reopenedBackdrop);
      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).not.toBeVisible());

      const swipeArea = await waitFor(() => {
        const area = document.querySelector('.PrivateSwipeArea-root');
        if (!(area instanceof HTMLElement)) {
          throw new Error('The navigator swipe-to-open area was not rendered.');
        }
        return area;
      });

      const touchAt = (clientX: number) => new Touch({ identifier: 1, target: swipeArea, clientX, clientY: 180 });
      const startTouch = touchAt(2);
      const endTouch = touchAt(170);
      fireEvent.touchStart(swipeArea, { touches: [startTouch], changedTouches: [startTouch] });
      fireEvent.touchMove(swipeArea, { touches: [endTouch], changedTouches: [endTouch] });
      fireEvent.touchEnd(swipeArea, { touches: [], changedTouches: [endTouch] });

      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).toBeVisible());
    });
  },
};

export const TouchHomepageStartsVisibleWithoutNavigator: Story = {
  name: '12. Touch homepage keeps library visible without navigator overlay',
  tags: ['navigator-touch-regression'],
  args: {
    simulateTouch: true,
  },
  play: async ({ canvas, step }) => {
    await step('Fresh touch homepage shows the library entry', async () => {
      await expect(await canvas.findByText("BenisBoy's Library")).toBeVisible();
    });

    await step('Fresh touch homepage does not show the chapter navigator overlay', async () => {
      const navigatorFrame = document.querySelector('iframe[title="External HTML"]');
      if (navigatorFrame) {
        await expect(navigatorFrame).not.toBeVisible();
      }

      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        await expect(backdrop).not.toBeVisible();
      }
    });
  },
};

const verifyTouchHeaderControlSizing = async (
  canvas: ReturnType<typeof within>,
  step: StoryPlayContext['step'],
  userEvent: StoryPlayContext['userEvent'],
  viewport: { width: number; height: number }
) => {
  await step(`Runner uses a ${viewport.width}x${viewport.height} portrait viewport`, async () => {
    expect(window.innerWidth).toBe(viewport.width);
    expect(window.innerHeight).toBe(viewport.height);
  });

  await step('Closing the fresh reader navigator shows the mobile toggle', async () => {
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (!(backdrop instanceof HTMLElement)) {
      throw new Error('The open mobile navigator backdrop was not found.');
    }
    await userEvent.click(backdrop);
    await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).not.toBeVisible());

    await expect(await canvas.findByRole('button', { name: 'Toggle chapter navigator' })).toBeVisible();
  });

  await step('Navigator, Home, and Patreon controls each render at equal 44x44 CSS pixels', async () => {
    const navigatorToggle = await canvas.findByRole('button', { name: 'Toggle chapter navigator' });
    const homeButton = document.getElementById('home-button');
    const patreonLink = document.getElementById('patreon-link');
    if (!(homeButton instanceof HTMLElement) || !(patreonLink instanceof HTMLElement)) {
      throw new Error('The Home button or Patreon link was not rendered.');
    }

    const controls = [navigatorToggle, homeButton, patreonLink];
    const rectangles = controls.map((control) => control.getBoundingClientRect());
    for (const [index, control] of controls.entries()) {
      await expect(control).toBeVisible();
      expect(rectangles[index].width).toBe(44);
      expect(rectangles[index].height).toBe(44);
    }

    expect(rectangles[0].width).toBe(rectangles[1].width);
    expect(rectangles[0].height).toBe(rectangles[1].height);
    expect(rectangles[0].width).toBe(rectangles[2].width);
    expect(rectangles[0].height).toBe(rectangles[2].height);
  });
};

const makeTouchHeaderControlSizingPlay = (viewport: { width: number; height: number }) =>
  (async ({ canvas, step, userEvent }) => {
    await verifyTouchHeaderControlSizing(canvas, step, userEvent, viewport);
  }) satisfies StoryPlay;

export const TouchHeaderControlsMatchAt375x812: Story = {
  name: '13. Touch header controls match at 375x812',
  tags: ['navigator-touch-regression'],
  args: {
    simulateTouch: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId,
    },
  },
  play: makeTouchHeaderControlSizingPlay({ width: 375, height: 812 }),
};

export const TouchHeaderControlsMatchAt390x844: Story = {
  name: '14. Touch header controls match at 390x844',
  tags: ['navigator-touch-regression'],
  args: {
    simulateTouch: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId,
    },
  },
  play: makeTouchHeaderControlSizingPlay({ width: 390, height: 844 }),
};

export const FailedChapterLoadCanBeRetried: Story = {
  name: '15. Failed chapter load clears old content and retries',
  tags: ['reader-retry-regression'],
  args: {
    isLoggedIn: true,
    isSupporter: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    const initialParagraph = await verifyRenderedChapter(canvasElement, wtdrFirstChapter);
    const originalFetch = window.fetch.bind(window);
    let failuresRemaining = 2;
    window.fetch = async (input, init) => {
      if (failuresRemaining > 0 && String(input).includes('book-data/WtDR/../WtDR/')) {
        failuresRemaining -= 1;
        return new Response('temporary chapter failure', { status: 503 });
      }
      return originalFetch(input, init);
    };

    try {
      await step('A failed chapter request shows an error instead of the previous chapter', async () => {
        await clickNavigatorChapter(canvasElement, wtdrSecondChapter.title);
        await expect(await canvas.findByRole('alert')).toBeVisible();
        await expectReaderHash(getChapterHash(wtdrSecondChapter));
        expect(canvasElement.querySelector('iframe[title="Embedded Content"]')).toBeNull();
        expect(window.localStorage.getItem('WtDR_SELECTED_CHAPTER')).toBe(wtdrSecondChapter.chapterId);
      });

      await step('Reselecting the failed navigator item explicitly retries that same route', async () => {
        await clickNavigatorChapter(canvasElement, wtdrSecondChapter.title);
        await waitFor(() => expect(failuresRemaining).toBe(0));
        await expect(await canvas.findByRole('alert')).toBeVisible();
        await expectReaderHash(getChapterHash(wtdrSecondChapter));
      });

      await step('The visible Retry button recovers and clears the error state', async () => {
        await userEvent.click(await canvas.findByRole('button', { name: 'Retry loading chapter' }));
        const retriedParagraph = await verifyRenderedChapter(canvasElement, wtdrSecondChapter);
        expect(retriedParagraph).not.toBe(initialParagraph);
        expect(canvas.queryByRole('alert')).toBeNull();
      });
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const OutOfOrderChapterLoadsKeepNewestRouteAndContent: Story = {
  name: '16. Out-of-order chapter responses cannot replace the chosen chapter',
  tags: ['reader-content-race-regression'],
  args: {
    isLoggedIn: true,
    isSupporter: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvasElement, step }) => {
    await verifyRenderedChapter(canvasElement, wtdrFirstChapter);
    const originalFetch = window.fetch.bind(window);
    const waiting: Array<{ input: RequestInfo | URL; init?: RequestInit; resolve: (response: Response) => void }> = [];
    window.fetch = (input, init) => {
      if (String(input).includes('book-data/WtDR/../WtDR/')) {
        return new Promise<Response>((resolve) => waiting.push({ input, init, resolve }));
      }
      return originalFetch(input, init);
    };

    try {
      await step('Hold two chapter responses while navigating rapidly', async () => {
        await clickNavigatorChapter(canvasElement, wtdrSecondChapter.title);
        await waitFor(() => expect(waiting).toHaveLength(1));
        await clickNavigatorChapter(canvasElement, wtdrThirdChapter.title);
        await waitFor(() => expect(waiting).toHaveLength(2));
      });

      await step('The newest response renders, and the older response cannot overwrite it', async () => {
        const newest = waiting[1];
        newest.resolve(await originalFetch(newest.input, newest.init));
        const newestParagraph = await verifyRenderedChapter(canvasElement, wtdrThirdChapter);

        const stale = waiting[0];
        stale.resolve(await originalFetch(stale.input, stale.init));
        await waitFor(async () => {
          await expectReaderHash(getChapterHash(wtdrThirdChapter));
          expect(await getReaderFirstParagraphText(canvasElement)).toBe(newestParagraph);
        });
        expect(window.localStorage.getItem('WtDR_SELECTED_CHAPTER')).toBe(wtdrThirdChapter.chapterId);
      });
    } finally {
      window.fetch = originalFetch;
      for (const request of waiting) {
        request.resolve(new Response('', { status: 500 }));
      }
    }
  },
};

export const DelayedMetadataCannotSelectAnOlderBookChapter: Story = {
  name: '17. Delayed chapter metadata cannot replace a newer book route',
  tags: ['reader-metadata-race-regression'],
  args: { initialHash: '#/' },
  play: async ({ canvas, canvasElement, step }) => {
    await expect(await canvas.findByText("BenisBoy's Library")).toBeVisible();
    clearChapterMetadataCache();
    const originalFetch = window.fetch.bind(window);
    const pendingMetadata: Array<{ input: RequestInfo | URL; init?: RequestInit; resolve: (response: Response) => void }> = [];
    window.fetch = (input, init) => {
      const request = String(input);
      if (request.includes('_chapters.json') && (request.includes('PSSJ') || request.includes('WtDR'))) {
        return new Promise<Response>((resolve) => pendingMetadata.push({ input, init, resolve }));
      }
      return originalFetch(input, init);
    };

    try {
      await step('Start two reader routes before either book metadata request resolves', async () => {
        window.location.hash = getChapterHash(pssjFirstChapter);
        await waitFor(() => expect(pendingMetadata.some(({ input }) => String(input).includes('PSSJ'))).toBe(true));
        window.location.hash = getChapterHash(wtdrFirstChapter);
        await waitFor(() => expect(pendingMetadata.some(({ input }) => String(input).includes('WtDR'))).toBe(true));
      });

      await step('Resolve the newest book first, then ensure stale metadata does not change selection/content', async () => {
        const latest = pendingMetadata.find(({ input }) => String(input).includes('WtDR'))!;
        latest.resolve(await originalFetch(latest.input, latest.init));
        const newestParagraph = await verifyRenderedChapter(canvasElement, wtdrFirstChapter);

        const stale = pendingMetadata.find(({ input }) => String(input).includes('PSSJ'))!;
        stale.resolve(await originalFetch(stale.input, stale.init));
        expect(await verifyRenderedChapter(canvasElement, wtdrFirstChapter)).toBe(newestParagraph);
        expect(window.localStorage.getItem('SELECTED_BOOK')).toBe('WtDR');
      });
    } finally {
      window.fetch = originalFetch;
      for (const request of pendingMetadata) {
        request.resolve(new Response('', { status: 500 }));
      }
    }
  },
};

export const ReaderAndNavigatorSettingsUpdateWithoutReload: Story = {
  name: '18. Reader settings update iframe styles without reloading content',
  tags: ['reader-iframe-settings-regression'],
  args: {
    initialHash: getChapterHash(wtdrFirstChapter),
    isLoggedIn: true,
    isSupporter: true,
    showConfigurationTestControls: true,
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await verifyRenderedChapter(canvasElement, wtdrFirstChapter);
    const navigatorFrame = await getNavigatorFrame(canvasElement);
    const readerFrame = await getReaderFrameBody(canvasElement);
    const navigatorDocument = navigatorFrame.contentDocument;
    const readerDocument = readerFrame.ownerDocument;

    await step('Changing appearance updates styles in the existing navigator and reader frames', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle dark mode' }));
      await waitFor(() => {
        expect(navigatorFrame.contentDocument).toBe(navigatorDocument);
        expect(navigatorDocument?.querySelector('style[data-navigator-settings]')?.textContent).toContain('color: white');
        expect(readerFrame.ownerDocument).toBe(readerDocument);
        expect(readerDocument?.querySelector('style[data-reader-settings]')?.textContent).toContain('#ddd');
      });
    });
  },
};

export const IOSNavigatorUsesToggleAndLeavesEdgeSwipeForBrowser: Story = {
  name: '19. Simulated iOS navigator opens by toggle, not edge swipe',
  tags: ['navigator-ios-policy-regression'],
  args: {
    simulateTouch: true,
    simulateIOS: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('The simulated iOS drawer has no swipe-open area', async () => {
      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).toBeVisible());
      expect(document.querySelector('.PrivateSwipeArea-root')).toBeNull();
    });

    await step('The visible header toggle still closes and reopens the navigator', async () => {
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (!(backdrop instanceof HTMLElement)) {
        throw new Error('Expected the temporary navigator backdrop.');
      }
      await userEvent.click(backdrop);
      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).not.toBeVisible());
      await userEvent.click(await canvas.findByRole('button', { name: 'Toggle chapter navigator' }));
      await waitFor(() => expect(document.querySelector('iframe[title="External HTML"]')).toBeVisible());
    });
  },
};

export const NavigatorIconFitsItsButton: Story = {
  name: '20. Navigator icon fits within its touch target',
  tags: ['navigator-icon-size-regression'],
  args: {
    simulateTouch: true,
    initialHash: getChapterHash(wtdrFirstChapter),
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvas, userEvent }) => {
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (backdrop instanceof HTMLElement) {
      await userEvent.click(backdrop);
    }
    const button = await canvas.findByRole('button', { name: 'Toggle chapter navigator' });
    const icon = button.querySelector('svg');
    if (!icon) {
      throw new Error('Navigator toggle SVG was not rendered.');
    }
    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    expect(iconRect.width).toBeGreaterThan(0);
    expect(iconRect.height).toBeGreaterThan(0);
    expect(iconRect.left).toBeGreaterThanOrEqual(buttonRect.left);
    expect(iconRect.top).toBeGreaterThanOrEqual(buttonRect.top);
    expect(iconRect.right).toBeLessThanOrEqual(buttonRect.right);
    expect(iconRect.bottom).toBeLessThanOrEqual(buttonRect.bottom);
  },
};

export const LoginUnlocksTheCurrentSecuredChapter: Story = {
  name: '21. Login unlocks the current secured reader route',
  tags: ['reader-auth-transition-regression'],
  args: {
    initialHash: getChapterHash(wtdrFirstSecuredChapter),
    isLoggedIn: false,
    isSupporter: true,
    showAccessTestControls: true,
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('A logged-out reader sees the login gate for the secured chapter', async () => {
      await verifyBlockedChapter({
        canvas,
        canvasElement,
        chapter: wtdrFirstSecuredChapter,
        heading: 'Access Restricted',
        body: /You need to log in to view this content/i,
      });
    });

    await step('Logging in unlocks the same canonical route without another navigator selection', async () => {
      await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle login' }));
      const decryptedParagraph = await verifyRenderedChapter(canvasElement, wtdrFirstSecuredChapter);
      expect(decryptedParagraph).toMatch(/[A-Za-z]{3,}(?:\s+[A-Za-z][A-Za-z'.,-]*){5,}/);
      expect(decryptedParagraph).not.toMatch(/^[A-Za-z0-9+/=]{32,}$/);
    });
  },
};

export const DowngradingWhileChapterMetadataIsPendingKeepsTheGate: Story = {
  name: '22. Auth downgrade during chapter metadata cannot open secured content',
  tags: ['reader-auth-metadata-downgrade-regression'],
  args: {
    initialHash: getChapterHash(pssjFirstChapter),
    isLoggedIn: true,
    isSupporter: true,
    showAccessTestControls: true,
    storageState: { SELECTED_BOOK: 'PSSJ', PSSJ_SELECTED_CHAPTER: pssjFirstChapter.chapterId },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await verifyRenderedChapter(canvasElement, pssjFirstChapter);
    clearChapterMetadataCache();
    const originalFetch = window.fetch.bind(window);
    const pendingMetadata: Array<{ input: RequestInfo | URL; init?: RequestInit; resolve: (response: Response) => void }> = [];
    let securedContentRequestCount = 0;
    window.fetch = (input, init) => {
      const request = String(input);
      if (request.includes('navigation-data/WtDR_chapters.json')) {
        return new Promise<Response>((resolve) => pendingMetadata.push({ input, init, resolve }));
      }
      if (request.includes(wtdrFirstSecuredChapter.chapterPath.slice('WtDR/'.length))) {
        securedContentRequestCount += 1;
      }
      return originalFetch(input, init);
    };

    try {
      await step('Start a secured WtDR route while its chapter metadata is held', async () => {
        window.location.hash = getChapterHash(wtdrFirstSecuredChapter);
        await waitFor(() => expect(pendingMetadata).toHaveLength(1));
        await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle login' }));
      });

      await step('After metadata resolves, the current ineligible reader remains gated without fetching content', async () => {
        pendingMetadata[0].resolve(await originalFetch(pendingMetadata[0].input, pendingMetadata[0].init));
        await verifyBlockedChapter({
          canvas,
          canvasElement,
          chapter: wtdrFirstSecuredChapter,
          heading: 'Access Restricted',
          body: /You need to log in to view this content/i,
        });
        expect(securedContentRequestCount).toBe(0);
      });

      await step('Restoring supporter login retries metadata selection and unlocks the same route', async () => {
        await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle login' }));
        const paragraph = await verifyRenderedChapter(canvasElement, wtdrFirstSecuredChapter);
        expect(paragraph).toMatch(/[A-Za-z]{3,}(?:\s+[A-Za-z][A-Za-z'.,-]*){5,}/);
      });
    } finally {
      window.fetch = originalFetch;
      for (const request of pendingMetadata) {
        request.resolve(new Response('', { status: 500 }));
      }
    }
  },
};

export const DowngradingWhileSecuredContentIsPendingDiscardsIt: Story = {
  name: '23. Auth downgrade during chapter fetch discards decrypted content',
  tags: ['reader-auth-content-downgrade-regression'],
  args: {
    initialHash: getChapterHash(wtdrFirstChapter),
    isLoggedIn: true,
    isSupporter: true,
    showAccessTestControls: true,
    storageState: { SELECTED_BOOK: 'WtDR', WtDR_SELECTED_CHAPTER: wtdrFirstChapter.chapterId },
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await verifyRenderedChapter(canvasElement, wtdrFirstChapter);
    const originalFetch = window.fetch.bind(window);
    const securedPath = wtdrFirstSecuredChapter.chapterPath.slice('WtDR/'.length);
    const pendingContent: Array<{ input: RequestInfo | URL; init?: RequestInit; resolve: (response: Response) => void }> = [];
    let holdNextSecuredRequest = true;
    window.fetch = (input, init) => {
      if (holdNextSecuredRequest && String(input).includes(securedPath)) {
        holdNextSecuredRequest = false;
        return new Promise<Response>((resolve) => pendingContent.push({ input, init, resolve }));
      }
      return originalFetch(input, init);
    };

    try {
      await step('Hold an eligible secured chapter response, then revoke supporter access', async () => {
        window.location.hash = getChapterHash(wtdrFirstSecuredChapter);
        await waitFor(() => expect(pendingContent).toHaveLength(1));
        await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle supporter' }));
        await verifyBlockedChapter({
          canvas,
          canvasElement,
          chapter: wtdrFirstSecuredChapter,
          heading: 'Support me on Patreon',
          body: /To access the full content, please consider subscribing to me on/i,
        });
      });

      await step('The late encrypted response cannot replace the supporter gate', async () => {
        pendingContent[0].resolve(await originalFetch(pendingContent[0].input, pendingContent[0].init));
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await verifyBlockedChapter({
          canvas,
          canvasElement,
          chapter: wtdrFirstSecuredChapter,
          heading: 'Support me on Patreon',
          body: /To access the full content, please consider subscribing to me on/i,
        });
      });

      await step('Restoring supporter eligibility can reload and unlock the selected chapter', async () => {
        await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle supporter' }));
        const paragraph = await verifyRenderedChapter(canvasElement, wtdrFirstSecuredChapter);
        expect(paragraph).toMatch(/[A-Za-z]{3,}(?:\s+[A-Za-z][A-Za-z'.,-]*){5,}/);
      });

      await step('Logging out after content was loaded also removes the secured document', async () => {
        await userEvent.click(await canvas.findByRole('button', { name: 'Test toggle login' }));
        await verifyBlockedChapter({
          canvas,
          canvasElement,
          chapter: wtdrFirstSecuredChapter,
          heading: 'Access Restricted',
          body: /You need to log in to view this content/i,
        });
      });
    } finally {
      window.fetch = originalFetch;
      for (const request of pendingContent) {
        request.resolve(new Response('', { status: 500 }));
      }
    }
  },
};

export const NonSupporterOpeningEncryptedChapterShowsPatreonMessage: Story = {
  name: '6. Non-supporter opening encrypted chapter shows Patreon message',
  args: {
    initialHash: getChapterHash(wtdrFirstSecuredChapter),
    isLoggedIn: true,
    isSupporter: false,
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step }) => {
    await step('Opening a secured WtDR chapter as a non-supporter shows the Patreon paywall inline', async () => {
      await verifyBlockedChapter({
        canvas,
        canvasElement,
        chapter: wtdrFirstSecuredChapter,
        heading: 'Support me on Patreon',
        body: /To access the full content, please consider subscribing to me on/i,
      });
    });
  },
};

export const LoggedOutOpeningEncryptedChapterShowsLoginMessage: Story = {
  name: '7. Logged-out opening encrypted chapter shows login message',
  args: {
    initialHash: getChapterHash(wtdrFirstSecuredChapter),
    isLoggedIn: false,
    isSupporter: false,
    storageState: {
      SELECTED_BOOK: 'WtDR',
      WtDR_SELECTED_CHAPTER: wtdrFirstSecuredChapter.chapterId,
    },
  },
  play: async ({ canvas, canvasElement, step }) => {
    await step('Opening a secured WtDR chapter while logged out shows the login-required message inline', async () => {
      await verifyBlockedChapter({
        canvas,
        canvasElement,
        chapter: wtdrFirstSecuredChapter,
        heading: 'Access Restricted',
        body: /You need to log in to view this content/i,
      });
    });
  },
};
