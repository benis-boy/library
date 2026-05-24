import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import './index.css';
import pssjManifest from '../book-data/PSSJ_raw/PSSJ_chapters.json';
import sowbManifest from '../book-data/SoWB_raw/SoWB_chapters.json';
import wtdrManifest from '../book-data/WtDR_raw/WtDR_chapters.json';
import basicBookData from './basicBookData.json';
import type { SourceType } from './constants';
import { FullAppHarness } from './storybook/FullAppHarness';

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
      throw new Error(`Could not read chapter source file: ${chapter.sourceFileUrl}`);
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
  const frameBody = await getReaderFrameBody(canvasElement);

  return waitFor(() => {
    const firstParagraph = normalizeText(frameBody.querySelector('p')?.textContent || '');
    if (!firstParagraph) {
      throw new Error('Reader first paragraph is not ready yet.');
    }

    return firstParagraph;
  });
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
  },
} satisfies Meta<typeof FullAppHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

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
