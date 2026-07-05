import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import '../index.css';
import { Thread } from './comments';
import type { Comment as CommentModel, CommentId, Thread as ThreadModel, TimestampMs } from './dataModel';

const BASE_TIMESTAMP = Date.UTC(2026, 6, 5, 12, 0, 0);

const minutesAfter = (minutes: number): TimestampMs => BASE_TIMESTAMP + minutes * 60_000;

const createComment = (
  userName: string | null,
  text: string,
  replyIds: CommentId[],
  likeCount: number,
  timestampOffsetMinutes: number,
  imageUrl: string | null = null
): CommentModel => {
  return {
    timestamp: minutesAfter(timestampOffsetMinutes),
    userName,
    text,
    imageUrl,
    replyIds,
    likeCount,
  };
};

const cloneThread = (thread: ThreadModel): ThreadModel => {
  const commentsById: Record<CommentId, CommentModel> = {};

  for (const commentId of Object.keys(thread.commentsById) as CommentId[]) {
    const comment = thread.commentsById[commentId];
    commentsById[commentId] = {
      ...comment,
      replyIds: [...comment.replyIds],
    };
  }

  return {
    ...thread,
    locationId: { ...thread.locationId },
    commentsById,
  };
};

const buildExampleThread = (): ThreadModel => {
  return {
    locationId: {
      bookId: 'PSSJ',
      chapterId: '41b0db3f',
      lineNumber: 84,
    },
    rootCommentId: 'root',
    commentsById: {
      root: createComment(
        'LoreKeeper',
        'The opening here still hits after every reread. The pacing is wild in a good way.',
        ['reply-1', 'reply-2'],
        12,
        0
      ),
      'reply-1': createComment(
        null,
        'Anonymous vote for the chapter-level comment style. It keeps the discussion easy to follow.',
        ['reply-1-1', 'reply-1-2'],
        2,
        2
      ),
      'reply-1-1': createComment('PikaFan', 'Agreed. The branch depth still feels readable.', [], 1, 5),
      'reply-1-2': createComment('EditorBee', 'Line comments help a lot when I want to quote exact moments.', [], 0, 7),
      'reply-2': createComment('ArcReader', 'I laughed at the ending callback.', ['reply-2-1', 'reply-2-2'], 4, 4),
      'reply-2-1': createComment('Navi', 'Same. I had to pause there.', [], 3, 8),
      'reply-2-2': createComment(
        'GifDropper',
        'Reaction gif for that twist.',
        ['reply-2-2-1'],
        5,
        9,
        'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif'
      ),
      'reply-2-2-1': createComment('ViewerTwo', 'Perfect gif choice.', [], 1, 12),
    },
  };
};

const buildMalformedThread = (): ThreadModel => {
  return {
    locationId: {
      bookId: 'WtDR',
      chapterId: '3ac9b1a8',
    },
    rootCommentId: 'root',
    commentsById: {
      root: createComment(
        'Moderator',
        'Root is valid but one reply target is missing on purpose.',
        ['child-1', 'missing-1'],
        5,
        0
      ),
      'child-1': createComment('ReaderOne', 'Connected child comment.', [], 1, 1),
      'orphan-a': createComment('LoopA', 'I point to orphan-b.', ['orphan-b'], 0, 4),
      'orphan-b': createComment('LoopB', 'I point back to orphan-a.', ['orphan-a'], 0, 5),
      'orphan-root': createComment(null, 'This disconnected branch should still render.', ['orphan-leaf'], 0, 6),
      'orphan-leaf': createComment('ReaderTwo', 'Leaf on disconnected branch.', [], 0, 7),
    },
  };
};

type CommentsStoryHarnessProps = {
  initialThread: ThreadModel;
  showDiagnostics?: boolean;
  signedInUserName?: string | null;
};

const CommentsStoryHarness = ({
  initialThread,
  showDiagnostics = false,
  signedInUserName = null,
}: CommentsStoryHarnessProps) => {
  const [thread, setThread] = useState<ThreadModel>(() => cloneThread(initialThread));
  const [likedCommentIds, setLikedCommentIds] = useState<Set<CommentId>>(() => new Set<CommentId>());
  const [eventLog, setEventLog] = useState<string[]>([]);
  const replyCounterRef = useRef(1);

  useEffect(() => {
    setThread(cloneThread(initialThread));
    setLikedCommentIds(new Set<CommentId>());
    setEventLog([]);
    replyCounterRef.current = 1;
  }, [initialThread]);

  const appendEvent = (eventLabel: string) => {
    setEventLog((previousEvents) => [eventLabel, ...previousEvents].slice(0, 10));
  };

  const handleReply = ({ replyToCommentId }: { replyToCommentId: CommentId }) => {
    setThread((previousThread) => {
      const parentComment = previousThread.commentsById[replyToCommentId];
      if (!parentComment) {
        appendEvent(`Reply skipped: ${replyToCommentId} not found`);
        return previousThread;
      }

      const replyNumber = replyCounterRef.current;
      const nextCommentId = `auto-reply-${replyNumber}`;
      replyCounterRef.current += 1;

      const nextComment = createComment(
        'Storybook Tester',
        `Auto reply ${replyNumber} to ${replyToCommentId}`,
        [],
        0,
        20 + replyNumber
      );

      appendEvent(`Reply created: ${nextCommentId} -> ${replyToCommentId}`);

      return {
        ...previousThread,
        commentsById: {
          ...previousThread.commentsById,
          [replyToCommentId]: {
            ...parentComment,
            replyIds: [...parentComment.replyIds, nextCommentId],
          },
          [nextCommentId]: nextComment,
        },
      };
    });
  };

  const handleToggleLike = ({ commentId, shouldLike }: { commentId: CommentId; shouldLike: boolean }) => {
    if (!thread.commentsById[commentId]) {
      appendEvent(`Like skipped: ${commentId} not found`);
      return;
    }

    setThread((previousThread) => {
      const existingComment = previousThread.commentsById[commentId];
      if (!existingComment) {
        return previousThread;
      }

      const delta = shouldLike ? 1 : -1;
      const nextLikeCount = Math.max(0, existingComment.likeCount + delta);

      appendEvent(`${shouldLike ? 'Liked' : 'Unliked'} ${commentId}`);

      return {
        ...previousThread,
        commentsById: {
          ...previousThread.commentsById,
          [commentId]: {
            ...existingComment,
            likeCount: nextLikeCount,
          },
        },
      };
    });

    setLikedCommentIds((previousSet) => {
      const nextSet = new Set(previousSet);
      if (shouldLike) {
        nextSet.add(commentId);
      } else {
        nextSet.delete(commentId);
      }

      return nextSet;
    });
  };

  const commentCount = Object.keys(thread.commentsById).length;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Comment Thread Preview</h2>
          <p data-testid="thread-stats" className="text-sm text-slate-600">
            Comments: {commentCount}
          </p>
        </header>

        <Thread
          thread={thread}
          signedInUserName={signedInUserName}
          likedCommentIds={likedCommentIds}
          showDiagnostics={showDiagnostics}
          onReply={handleReply}
          onToggleLike={handleToggleLike}
        />

        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Interaction log</h3>
          <ul aria-label="Interaction log" className="mt-2 space-y-1 text-xs text-slate-700">
            {eventLog.length === 0 ? (
              <li>No interactions yet.</li>
            ) : (
              eventLog.map((eventLabel, index) => <li key={`${index}-${eventLabel}`}>{eventLabel}</li>)
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};

const meta = {
  title: 'Comments/Thread',
  component: CommentsStoryHarness,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    initialThread: buildExampleThread(),
    showDiagnostics: false,
    signedInUserName: 'GifDropper',
  },
  argTypes: {
    initialThread: { control: false },
    showDiagnostics: { control: 'boolean' },
    signedInUserName: { control: 'text' },
  },
} satisfies Meta<typeof CommentsStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReplyAndLikeActionsUpdateThread: Story = {
  name: '1. Reply and like actions update thread',
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Like and unlike the root comment', async () => {
      const rootCard = canvasElement.querySelector('[data-comment-id="root"]');
      if (!(rootCard instanceof HTMLElement)) {
        throw new Error('Root comment card was not rendered.');
      }

      const rootComment = within(rootCard);
      await userEvent.click(rootComment.getByRole('button', { name: 'Like comment' }));
      await waitFor(() => expect(rootComment.getByText('13 likes')).toBeVisible());

      await userEvent.click(rootComment.getByRole('button', { name: 'Unlike comment' }));
      await waitFor(() => expect(rootComment.getByText('12 likes')).toBeVisible());
    });

    await step('Replying adds a new child comment', async () => {
      const parentCard = canvasElement.querySelector('[data-comment-id="reply-1"]');
      if (!(parentCard instanceof HTMLElement)) {
        throw new Error('Reply target card was not rendered.');
      }

      const parentComment = within(parentCard);
      await userEvent.click(parentComment.getByRole('button', { name: 'Reply' }));

      await waitFor(() => expect(canvas.getByTestId('thread-stats')).toHaveTextContent('Comments: 9'));
      await expect(await canvas.findByText('Auto reply 1 to reply-1')).toBeVisible();
    });

    await step('Interaction log captures user actions', async () => {
      const log = await canvas.findByRole('list', { name: 'Interaction log' });
      const logScope = within(log);

      await expect(logScope.getByText('Liked root')).toBeVisible();
      await expect(logScope.getByText('Unliked root')).toBeVisible();
      await expect(logScope.getByText('Reply created: auto-reply-1 -> reply-1')).toBeVisible();
    });
  },
};

export const MalformedThreadShowsDiagnosticsAndDisconnectedBranches: Story = {
  name: '2. Malformed thread shows diagnostics and disconnected branches',
  args: {
    initialThread: buildMalformedThread(),
    showDiagnostics: true,
    signedInUserName: 'ReaderTwo',
  },
  play: async ({ canvas, canvasElement, step, userEvent }) => {
    await step('Disconnected branch still renders for inspection', async () => {
      await expect(await canvas.findByText('Disconnected comments')).toBeVisible();

      const orphanRootCard = canvasElement.querySelector('[data-comment-id="orphan-root"]');
      if (!(orphanRootCard instanceof HTMLElement)) {
        throw new Error('Disconnected branch root was not rendered.');
      }

      await expect(within(orphanRootCard).getByText('This disconnected branch should still render.')).toBeVisible();
    });

    await step('Diagnostics details expose malformed graph issues', async () => {
      const diagnosticsToggle = await canvas.findByText(/Graph diagnostics \(/i);
      await userEvent.click(diagnosticsToggle);

      await expect(await canvas.findByText('Missing reply target missing-1 from root')).toBeVisible();
      await expect(await canvas.findByText('Cycle edge detected: orphan-b -> orphan-a')).toBeVisible();
      await expect(await canvas.findByText('Orphan comment not reachable from root: orphan-root')).toBeVisible();
    });
  },
};
