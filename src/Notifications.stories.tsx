import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import './index.css';
import pssjManifest from '../book-data/PSSJ_raw/PSSJ_chapters.json';
import sowbManifest from '../book-data/SoWB_raw/SoWB_chapters.json';
import type { CommentNotification } from './comments/comments-api';
import type { Comment, CommentId, PageLocationId, Thread, ThreadLocationId } from './comments/dataModel';
import { toThreadLocationKey } from './comments/dataModel';
import { createParagraphLocation, type Paragraph } from './comments/paragraph-comments/paragraph-locator';
import type { SourceType } from './constants';
import { FullAppHarness } from './storybook/FullAppHarness';
import type { MockCommentsApiState } from './storybook/commentsApiMock';

type ChapterManifestEntry = {
  chapterId?: string;
  chapter: string;
  title: string;
  isSecured: boolean;
};

type ChapterManifest = {
  bookId: SourceType;
  chapters: ChapterManifestEntry[];
};

type StoryChapter = {
  book: SourceType;
  chapterId: string;
  chapterPath: string;
  sourceFileUrl: string;
};

const TEST_SIGNED_USER = 'storybook-signed-user';
const BASE_TIMESTAMP = Date.UTC(2026, 6, 25, 12, 0, 0);
const MAIN_IMAGE_URL = 'https://example.com/storybook-main-comment.png';
const PARENT_IMAGE_URL = 'https://example.com/storybook-parent-comment.png';

const chapterManifests: Record<'PSSJ' | 'SoWB', ChapterManifest> = {
  PSSJ: pssjManifest as ChapterManifest,
  SoWB: sowbManifest as ChapterManifest,
};

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

const getStoryChapter = (book: 'PSSJ' | 'SoWB', index: number): StoryChapter => {
  const entry = chapterManifests[book].chapters[index];
  if (!entry?.chapterId) {
    throw new Error(`Missing Storybook chapter fixture for ${book} index ${index}.`);
  }

  return {
    book,
    chapterId: entry.chapterId,
    chapterPath: entry.chapter,
    sourceFileUrl: getChapterSourceFileUrl(book, entry.chapter),
  };
};

const pssjFirstChapter = getStoryChapter('PSSJ', 0);
const pssjSecondChapter = getStoryChapter('PSSJ', 1);
const sowbFirstChapter = getStoryChapter('SoWB', 0);

const createComment = (
  text: string,
  replyIds: CommentId[] = [],
  timestampOffset = 0,
  userName: string | null = 'Story Reader',
  imageUrl: string | null = null
): Comment => ({
  timestamp: BASE_TIMESTAMP + timestampOffset * 60_000,
  userName,
  text,
  imageUrl,
  replyIds,
});

const createThread = (locationId: ThreadLocationId, rootCommentId: CommentId, commentsById: Record<CommentId, Comment>): Thread => ({
  locationId,
  rootCommentId,
  commentsById: commentsById as Thread['commentsById'],
});

const createParagraphLocationForIndex = async (chapter: StoryChapter, paragraphIndex: number) => {
  const response = await fetch(chapter.sourceFileUrl);
  if (!response.ok) {
    throw new Error(`Could not load chapter fixture: ${chapter.sourceFileUrl}`);
  }

  const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
  const paragraphs: Paragraph[] = Array.from(documentFragment.querySelectorAll('p')).map((paragraph) => ({
    content: paragraph.textContent?.trim() ?? '',
  }));

  return createParagraphLocation(chapter.book, chapter.chapterId, paragraphs, paragraphIndex);
};

const addThread = (state: MockCommentsApiState, thread: Thread) => {
  const locationKey = toThreadLocationKey(thread.locationId);
  state.threadsByLocationKey[locationKey] = [...(state.threadsByLocationKey[locationKey] ?? []), thread];
};

const createNotificationState = (notifications: CommentNotification[], threads: Thread[] = []): MockCommentsApiState => {
  const state: MockCommentsApiState = {
    notificationsBySignedUser: {
      [TEST_SIGNED_USER]: notifications,
    },
    summariesBySignedUser: {
      [TEST_SIGNED_USER]: {
        unreadCount: notifications.length,
        lastCheckedAt: BASE_TIMESTAMP - 60_000,
      },
    },
    threadsByLocationKey: {},
    reactionsByCommentId: {},
    requestLog: [],
  };

  for (const thread of threads) {
    addThread(state, thread);
  }

  return state;
};

const createReplyNotification = (
  id: string,
  locationId: ThreadLocationId,
  parentCommentId: CommentId,
  replyCommentId: CommentId,
  ageMinutes: number
): CommentNotification => ({
  id,
  type: 'comment-reply',
  createdAt: BASE_TIMESTAMP - ageMinutes * 60_000,
  actorUserName: 'Notifier',
  locationId,
  parentCommentId,
  replyCommentId,
});

const createThreadStartNotification = (
  id: string,
  locationId: ThreadLocationId,
  rootCommentId: CommentId,
  ageMinutes: number
): CommentNotification => ({
  id,
  type: 'comment-thread-start',
  createdAt: BASE_TIMESTAMP - ageMinutes * 60_000,
  actorUserName: 'Thread Starter',
  locationId,
  rootCommentId,
});

const createPagedNotificationState = () => {
  const locationId: PageLocationId = { bookId: pssjFirstChapter.book, chapterId: pssjFirstChapter.chapterId };
  const notifications: CommentNotification[] = [];
  const threads: Thread[] = [];

  for (let index = 0; index < 13; index += 1) {
    const rootCommentId = `paged-root-${index}`;
    threads.push(
      createThread(locationId, rootCommentId, {
        [rootCommentId]: createComment(`Paged notification root ${index}`, [], index),
      })
    );
    notifications.push(createThreadStartNotification(`paged-notification-${index}`, locationId, rootCommentId, index));
  }

  return createNotificationState(notifications, threads);
};

const createChapterTargetState = () => {
  const locationId: PageLocationId = { bookId: pssjFirstChapter.book, chapterId: pssjFirstChapter.chapterId };
  const rootThread = createThread(locationId, 'chapter-root', {
    'chapter-root': createComment('Chapter root target comment.'),
  });
  const paragraphThread = createThread(locationId, 'chapter-paragraph-root', {
    'chapter-paragraph-root': createComment('Paragraph-like root target comment.'),
  });
  const deepThread = createThread(locationId, 'deep-root', {
    'deep-root': createComment('Deep root target comment with enough text to sit far from its nested reply.'.repeat(6), ['deep-1']),
    'deep-1': createComment('Intermediate reply with lots of spacing.'.repeat(12), ['deep-2'], 1),
    'deep-2': createComment('Second intermediate reply with lots of spacing.'.repeat(12), ['deep-3'], 2),
    'deep-3': createComment('Deep nested reply target comment.', [], 3),
  });

  return createNotificationState(
    [
      createThreadStartNotification('root-target-notification', locationId, 'chapter-root', 0),
      createThreadStartNotification('paragraph-root-target-notification', locationId, 'chapter-paragraph-root', 1),
      createReplyNotification('deep-reply-target-notification', locationId, 'deep-2', 'deep-3', 2),
    ],
    [rootThread, paragraphThread, deepThread]
  );
};

const createParagraphTargetState = async () => {
  const paragraphLocation = await createParagraphLocationForIndex(pssjFirstChapter, 5);
  const locationId: ThreadLocationId = {
    bookId: pssjFirstChapter.book,
    chapterId: pssjFirstChapter.chapterId,
    paragraphLocation,
  };
  const thread = createThread(locationId, 'paragraph-root', {
    'paragraph-root': createComment('Paragraph root comment.', ['paragraph-reply']),
    'paragraph-reply': createComment('Paragraph reply target comment.', [], 1),
  });

  return createNotificationState(
    [createReplyNotification('paragraph-target-notification', locationId, 'paragraph-root', 'paragraph-reply', 0)],
    [thread]
  );
};

const createImageState = () => {
  const locationId: PageLocationId = { bookId: pssjFirstChapter.book, chapterId: pssjFirstChapter.chapterId };
  const mainThread = createThread(locationId, 'image-main-root', {
    'image-main-root': createComment('Main image parent.', ['image-main-reply'], 0),
    'image-main-reply': createComment('Main image reply target.', [], 1, 'Image Poster', MAIN_IMAGE_URL),
  });
  const parentThread = createThread(locationId, 'image-parent-root', {
    'image-parent-root': createComment('Parent image preview target.', ['image-parent-reply'], 2, 'Parent Poster', PARENT_IMAGE_URL),
    'image-parent-reply': createComment('Reply whose parent has an image.', [], 3),
  });

  return createNotificationState(
    [
      createReplyNotification('main-image-notification', locationId, 'image-main-root', 'image-main-reply', 0),
      createReplyNotification('parent-image-notification', locationId, 'image-parent-root', 'image-parent-reply', 1),
    ],
    [mainThread, parentThread]
  );
};

const createCrossPageState = () => {
  const firstLocationId: PageLocationId = { bookId: pssjFirstChapter.book, chapterId: pssjFirstChapter.chapterId };
  const secondLocationId: PageLocationId = { bookId: pssjSecondChapter.book, chapterId: pssjSecondChapter.chapterId };
  const sourceThread = createThread(firstLocationId, 'source-root', {
    'source-root': createComment('Source page comment.'),
  });
  const targetThread = createThread(secondLocationId, 'other-page-root', {
    'other-page-root': createComment('Other page target comment.'),
  });

  return createNotificationState(
    [createThreadStartNotification('other-page-notification', secondLocationId, 'other-page-root', 0)],
    [sourceThread, targetThread]
  );
};

const createMixedJumpState = async () => {
  const chapterLocationId: PageLocationId = { bookId: pssjFirstChapter.book, chapterId: pssjFirstChapter.chapterId };
  const firstParagraphLocation = await createParagraphLocationForIndex(pssjFirstChapter, 3);
  const secondParagraphLocation = await createParagraphLocationForIndex(pssjFirstChapter, 12);
  const firstParagraphLocationId: ThreadLocationId = {
    ...chapterLocationId,
    paragraphLocation: firstParagraphLocation,
  };
  const secondParagraphLocationId: ThreadLocationId = {
    ...chapterLocationId,
    paragraphLocation: secondParagraphLocation,
  };

  return createNotificationState(
    [
      createThreadStartNotification('chapter-first-notification', chapterLocationId, 'mixed-chapter-root', 0),
      createReplyNotification('mixed-second-paragraph-notification', secondParagraphLocationId, 'mixed-second-root', 'mixed-second-reply', 1),
    ],
    [
      createThread(chapterLocationId, 'mixed-chapter-root', {
        'mixed-chapter-root': createComment('Chapter comment first target.'),
      }),
      createThread(firstParagraphLocationId, 'mixed-first-root', {
        'mixed-first-root': createComment('First paragraph comment thread.'),
      }),
      createThread(secondParagraphLocationId, 'mixed-second-root', {
        'mixed-second-root': createComment('Second paragraph parent.', ['mixed-second-reply']),
        'mixed-second-reply': createComment('Second paragraph reply target.', [], 1),
      }),
    ]
  );
};

const getReaderHash = (chapter: StoryChapter) => `#/reader/${chapter.book}/${chapter.chapterId}`;

const getNotificationArticle = async (notificationId: string) => {
  return waitFor(() => {
    const article = document.querySelector(`[data-notification-id="${notificationId}"]`);
    if (!(article instanceof HTMLElement)) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    return article;
  }, { timeout: 5000 });
};

const getCommentCard = async (commentId: CommentId, root: ParentNode = document) => {
  return waitFor(() => {
    const card = root.querySelector(`[data-comment-id="${CSS.escape(commentId)}"]`);
    if (!(card instanceof HTMLElement)) {
      throw new Error(`Comment card not found: ${commentId}`);
    }

    return card;
  }, { timeout: 5000 });
};

const openNotifications = async (canvas: ReturnType<typeof within>, userEvent: StoryContextUserEvent) => {
  const visibleBell = await canvas.findByRole('button', { name: 'Open reply notifications' }).catch(() => null);
  if (visibleBell) {
    await userEvent.click(visibleBell);
  } else {
    const bell = document.getElementById('notification-bell');
    if (!(bell instanceof HTMLButtonElement)) {
      throw new Error('Notification bell was not rendered.');
    }
    bell.click();
  }
  const bodyScope = within(document.body);
  await waitFor(async () => {
    await expect(await bodyScope.findByText('Comment Notifications')).toBeVisible();
    await expect(await bodyScope.findByLabelText('Notifications list')).toBeVisible();
  });
};

type StoryContextUserEvent = Parameters<NonNullable<Story['play']>>[0]['userEvent'];

const clickNotificationGoToThread = async (notificationId: string, commentId: CommentId, userEvent: StoryContextUserEvent) => {
  const article = await getNotificationArticle(notificationId);
  const commentCard = await getCommentCard(commentId, article);
  await userEvent.click(within(commentCard).getByRole('button', { name: 'Go to thread' }));
};

const expectCommentHighlighted = async (commentId: CommentId) => {
  const card = await getCommentCard(commentId);
  await waitFor(() => expect(card.className).toMatch(/ring-2|border-cyan/), { timeout: 5000 });
};

const expectParagraphModalOpen = async () => {
  await waitFor(async () => {
    await expect(await within(document.body).findByRole('dialog', { name: 'Paragraph comments' })).toBeVisible();
  }, { timeout: 5000 });
};

const scrollNotificationsToEnd = async (userEvent: StoryContextUserEvent) => {
  const bodyScope = within(document.body);
  const list = await bodyScope.findByLabelText('Notifications list');

  for (let index = 0; index < 10; index += 1) {
    const loadMore = bodyScope.queryByRole('button', { name: /Load more|Loading\.\.\./ });
    if (!loadMore) {
      return;
    }

    const previousNotificationCount = document.querySelectorAll('[data-notification-id]').length;
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event('scroll', { bubbles: true }));
    if (bodyScope.queryByRole('button', { name: 'Load more' })) {
      await userEvent.click(bodyScope.getByRole('button', { name: 'Load more' }));
    }
    await waitFor(() => {
      const currentNotificationCount = document.querySelectorAll('[data-notification-id]').length;
      const hasMore = bodyScope.queryByRole('button', { name: /Load more|Loading\.\.\./ });
      if (currentNotificationCount <= previousNotificationCount && hasMore) {
        throw new Error('Waiting for notification page to load.');
      }
    }, { timeout: 5000 });

    if (!bodyScope.queryByRole('button', { name: /Load more|Loading\.\.\./ })) {
      return;
    }
  }

  throw new Error('Notifications still had more pages after repeated scrolling.');
};

const clickCommentAttachmentAndExpectLightbox = async (commentId: CommentId, userEvent: StoryContextUserEvent) => {
  const card = await getCommentCard(commentId);
  const image = within(card).getByAltText(`Attachment for comment ${commentId}`);
  await userEvent.click(image);
  await waitFor(() => {
    const lightbox = document.querySelector(`[role="dialog"][aria-label="Attachment for comment ${CSS.escape(commentId)}"]`);
    if (!(lightbox instanceof HTMLElement)) {
      throw new Error(`Lightbox not found for ${commentId}`);
    }

    expect(lightbox).toBeVisible();
  });
  await userEvent.click(within(document.body).getByRole('button', { name: 'Close image viewer' }));
  await waitFor(() => expect(document.querySelector(`[role="dialog"][aria-label="Attachment for comment ${CSS.escape(commentId)}"]`)).toBeNull());
};

const waitForReaderHash = async (hash: string) => {
  await waitFor(() => expect(window.location.hash.split('?')[0]).toBe(hash));
};

const meta = {
  title: 'App/Notifications',
  component: FullAppHarness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    initialHash: getReaderHash(pssjFirstChapter),
    isLoggedIn: true,
    isSupporter: true,
    userName: 'Storybook Supporter',
    selectedBook: 'PSSJ',
    selectedChapter: pssjFirstChapter.chapterId,
  },
  argTypes: {
    commentsApiMockState: { control: false },
    storageState: { control: false },
    selectedBook: { control: false },
    selectedChapter: { control: false },
  },
} satisfies Meta<typeof FullAppHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InfiniteScrollLoadsEveryNotification: Story = {
  name: '1. Infinite scroll loads every notification',
  args: {
    commentsApiMockState: createPagedNotificationState(),
  },
  play: async ({ canvas, step, userEvent, args }) => {
    await step('Open notifications and scroll until pagination ends', async () => {
      await openNotifications(canvas, userEvent);
      await scrollNotificationsToEnd(userEvent);
    });

    await step('Every notification has rendered and pagination used cursors', async () => {
      for (let index = 0; index < 13; index += 1) {
        await expect(await getNotificationArticle(`paged-notification-${index}`)).toBeVisible();
      }

      const listCalls = args.commentsApiMockState?.requestLog?.filter((entry) => entry.type === 'notifications-list') ?? [];
      expect(listCalls.length).toBeGreaterThanOrEqual(3);
      expect(listCalls[0]).toMatchObject({ limit: 5, before: null });
      expect(listCalls[1]).toMatchObject({ limit: 5 });
      expect(listCalls[2]).toMatchObject({ limit: 5 });
    });
  },
};

export const GoToThreadHighlightsChapterCommentTargets: Story = {
  name: '2. Go to thread highlights chapter comments',
  args: {
    commentsApiMockState: createChapterTargetState(),
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('Root comment target navigates and highlights', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('root-target-notification', 'chapter-root', userEvent);
      await waitForReaderHash(getReaderHash(pssjFirstChapter));
      await expectCommentHighlighted('chapter-root');
    });

    await step('Paragraph-like root comment target highlights', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('paragraph-root-target-notification', 'chapter-paragraph-root', userEvent);
      await expectCommentHighlighted('chapter-paragraph-root');
    });

    await step('Deep nested reply target scrolls into view and highlights', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('deep-reply-target-notification', 'deep-3', userEvent);
      await expectCommentHighlighted('deep-3');
    });
  },
};

export const ParagraphGoToThreadOpensParagraphModal: Story = {
  name: '3. Paragraph Go to thread opens paragraph modal',
  loaders: [async () => ({ commentsApiMockState: await createParagraphTargetState() })],
  render: (args, { loaded }) => <FullAppHarness {...args} commentsApiMockState={loaded.commentsApiMockState as MockCommentsApiState} />,
  play: async ({ canvas, step, userEvent }) => {
    await step('Paragraph notification navigates, opens modal, and highlights target', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('paragraph-target-notification', 'paragraph-reply', userEvent);
      await waitForReaderHash(getReaderHash(pssjFirstChapter));
      await expectParagraphModalOpen();
      await expectCommentHighlighted('paragraph-reply');
    });
  },
};

export const NotificationImagesAndLightbox: Story = {
  name: '4-5. Notification images and lightbox',
  args: {
    commentsApiMockState: createImageState(),
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('Main comment image is immediately visible and opens the lightbox', async () => {
      await openNotifications(canvas, userEvent);
      const mainCard = await getCommentCard('image-main-reply', await getNotificationArticle('main-image-notification'));
      await expect(within(mainCard).getByAltText('Attachment for comment image-main-reply')).toBeVisible();
      await clickCommentAttachmentAndExpectLightbox('image-main-reply', userEvent);
    });

    await step('Parent comment image is hidden until expanding parent and then opens the lightbox', async () => {
      const parentArticle = await getNotificationArticle('parent-image-notification');
      expect(within(parentArticle).queryByAltText('Attachment for comment image-parent-root')).toBeNull();
      await userEvent.click(within(parentArticle).getByText('Parent image preview target.'));
      const parentCard = await getCommentCard('image-parent-root', parentArticle);
      await expect(within(parentCard).getByAltText('Attachment for comment image-parent-root')).toBeVisible();
      await clickCommentAttachmentAndExpectLightbox('image-parent-root', userEvent);
    });
  },
};

export const GoToThreadLoadsAnotherPage: Story = {
  name: '6. Go to thread loads another page',
  args: {
    commentsApiMockState: createCrossPageState(),
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('Cross-page notification changes chapter and highlights target', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('other-page-notification', 'other-page-root', userEvent);
      await waitForReaderHash(getReaderHash(pssjSecondChapter));
      await expectCommentHighlighted('other-page-root');
    });
  },
};

export const GoToThreadAfterWritingParagraphComment: Story = {
  name: '7. Go to thread works after writing a paragraph comment',
  loaders: [async () => ({ commentsApiMockState: await createMixedJumpState() })],
  render: (args, { loaded }) => <FullAppHarness {...args} commentsApiMockState={loaded.commentsApiMockState as MockCommentsApiState} />,
  play: async ({ canvas, step, userEvent }) => {
    await step('Start from a chapter notification', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('chapter-first-notification', 'mixed-chapter-root', userEvent);
      await waitForReaderHash(getReaderHash(pssjFirstChapter));
    });

    await step('Scroll up and write a paragraph comment', async () => {
      const scroller = document.querySelector('.app-scroll-container') as HTMLElement | null;
      scroller?.scrollTo({ top: 0, behavior: 'auto' });

      const iframe = await waitFor(() => {
        const candidate = document.querySelector('iframe[title="Embedded Content"]') as HTMLIFrameElement | null;
        if (!candidate?.contentDocument) {
          throw new Error('Reader iframe is not ready.');
        }
        return candidate;
      });
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'paragraph-comment-requested', paragraphIndex: 3 },
          origin: window.location.origin,
          source: iframe.contentWindow,
        })
      );

      await expectParagraphModalOpen();
      const paragraphDialog = await within(document.body).findByRole('dialog', { name: 'Paragraph comments' });
      const paragraphDialogScope = within(paragraphDialog);
      await userEvent.type(await paragraphDialogScope.findByPlaceholderText('Add a comment...'), 'New paragraph comment from Storybook');
      await userEvent.click(paragraphDialogScope.getByRole('button', { name: 'Comment' }));
      await expect(await paragraphDialogScope.findByText('New paragraph comment from Storybook')).toBeVisible();
      await userEvent.click(paragraphDialogScope.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(within(document.body).queryByRole('dialog', { name: 'Paragraph comments' })).toBeNull());
    });

    await step('Jump to another paragraph notification outside the current view', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('mixed-second-paragraph-notification', 'mixed-second-reply', userEvent);
      await expectParagraphModalOpen();
      await expectCommentHighlighted('mixed-second-reply');
    });
  },
};

export const NotificationsCanTargetADifferentBook: Story = {
  name: 'Additional. Go to thread can target another book',
  args: {
    commentsApiMockState: createNotificationState(
      [
        createThreadStartNotification(
          'other-book-notification',
          { bookId: sowbFirstChapter.book, chapterId: sowbFirstChapter.chapterId },
          'other-book-root',
          0
        ),
      ],
      [
        createThread({ bookId: sowbFirstChapter.book, chapterId: sowbFirstChapter.chapterId }, 'other-book-root', {
          'other-book-root': createComment('Other book target comment.'),
        }),
      ]
    ),
  },
  play: async ({ canvas, step, userEvent }) => {
    await step('Other-book notification changes book, chapter, and highlights target', async () => {
      await openNotifications(canvas, userEvent);
      await clickNotificationGoToThread('other-book-notification', 'other-book-root', userEvent);
      await waitForReaderHash(getReaderHash(sowbFirstChapter));
      await expectCommentHighlighted('other-book-root');
    });
  },
};
