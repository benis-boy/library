import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
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
  tags: ['continue-auth-regression'],
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
  tags: ['navigator-touch-regression'],
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
