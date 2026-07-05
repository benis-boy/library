import { CommentId, Thread } from './dataModel';

export type ThreadGraphIssue =
  | {
      type: 'missing-root-comment';
      rootCommentId: CommentId;
    }
  | {
      type: 'missing-reply-target';
      commentId: CommentId;
      replyId: CommentId;
    }
  | {
      type: 'self-reply';
      commentId: CommentId;
    }
  | {
      type: 'multi-parent-comment';
      commentId: CommentId;
      parentIds: CommentId[];
    }
  | {
      type: 'cycle-edge';
      fromCommentId: CommentId;
      toCommentId: CommentId;
    }
  | {
      type: 'orphan-comment';
      commentId: CommentId;
    };

export type ThreadGraph = {
  rootCommentId: CommentId;
  commentIds: CommentId[];
  childIdsById: Map<CommentId, CommentId[]>;
  treeChildIdsById: Map<CommentId, CommentId[]>;
  parentIdsById: Map<CommentId, CommentId[]>;
  parentById: Map<CommentId, CommentId | null>;
  depthById: Map<CommentId, number>;
  traversalOrder: CommentId[];
  orphanCommentIds: CommentId[];
  issues: ThreadGraphIssue[];
};

const addIssue = (
  issues: ThreadGraphIssue[],
  seenIssueKeys: Set<string>,
  issueKey: string,
  issue: ThreadGraphIssue
) => {
  if (seenIssueKeys.has(issueKey)) {
    return;
  }

  seenIssueKeys.add(issueKey);
  issues.push(issue);
};

export const buildThreadGraph = (thread: Thread): ThreadGraph => {
  const commentIds = Object.keys(thread.commentsById) as CommentId[];
  const childIdsById = new Map<CommentId, CommentId[]>();
  const treeChildIdsById = new Map<CommentId, CommentId[]>();
  const parentIdsById = new Map<CommentId, CommentId[]>();
  const parentById = new Map<CommentId, CommentId | null>();
  const depthById = new Map<CommentId, number>();
  const traversalOrder: CommentId[] = [];
  const orphanCommentIds: CommentId[] = [];
  const issues: ThreadGraphIssue[] = [];
  const seenIssueKeys = new Set<string>();
  const commentsById = thread.commentsById;

  for (const commentId of commentIds) {
    childIdsById.set(commentId, []);
    treeChildIdsById.set(commentId, []);
    parentIdsById.set(commentId, []);
  }

  if (!commentsById[thread.rootCommentId]) {
    addIssue(issues, seenIssueKeys, `missing-root:${thread.rootCommentId}`, {
      type: 'missing-root-comment',
      rootCommentId: thread.rootCommentId,
    });
  } else {
    parentById.set(thread.rootCommentId, null);
  }

  for (const commentId of commentIds) {
    const comment = commentsById[commentId];
    const childIds = childIdsById.get(commentId);
    if (!childIds) {
      continue;
    }

    const seenReplyIds = new Set<CommentId>();

    for (const replyId of comment.replyIds) {
      if (seenReplyIds.has(replyId)) {
        continue;
      }

      seenReplyIds.add(replyId);

      if (replyId === commentId) {
        addIssue(issues, seenIssueKeys, `self-reply:${commentId}`, {
          type: 'self-reply',
          commentId,
        });
        continue;
      }

      if (!commentsById[replyId]) {
        addIssue(issues, seenIssueKeys, `missing-reply:${commentId}:${replyId}`, {
          type: 'missing-reply-target',
          commentId,
          replyId,
        });
        continue;
      }

      childIds.push(replyId);

      const parentIds = parentIdsById.get(replyId);
      if (!parentIds || parentIds.includes(commentId)) {
        continue;
      }

      parentIds.push(commentId);
    }
  }

  for (const commentId of commentIds) {
    if (commentId === thread.rootCommentId && parentById.has(commentId)) {
      continue;
    }

    const parentIds = parentIdsById.get(commentId);
    if (!parentIds || parentIds.length === 0 || parentById.has(commentId)) {
      continue;
    }

    parentById.set(commentId, parentIds[0]);
  }

  for (const [commentId, parentId] of parentById.entries()) {
    if (parentId === null) {
      continue;
    }

    const treeChildIds = treeChildIdsById.get(parentId);
    if (!treeChildIds || treeChildIds.includes(commentId)) {
      continue;
    }

    treeChildIds.push(commentId);
  }

  for (const commentId of commentIds) {
    const parentIds = parentIdsById.get(commentId);
    if (!parentIds || parentIds.length <= 1) {
      continue;
    }

    addIssue(issues, seenIssueKeys, `multi-parent:${commentId}:${parentIds.join(',')}`, {
      type: 'multi-parent-comment',
      commentId,
      parentIds: [...parentIds],
    });
  }

  const cycleVisited = new Set<CommentId>();
  const cycleVisiting = new Set<CommentId>();

  const detectCycles = (commentId: CommentId) => {
    cycleVisited.add(commentId);
    cycleVisiting.add(commentId);

    const childIds = childIdsById.get(commentId);
    if (childIds) {
      for (const childId of childIds) {
        if (!cycleVisited.has(childId)) {
          detectCycles(childId);
          continue;
        }

        if (cycleVisiting.has(childId)) {
          addIssue(issues, seenIssueKeys, `cycle:${commentId}->${childId}`, {
            type: 'cycle-edge',
            fromCommentId: commentId,
            toCommentId: childId,
          });
        }
      }
    }

    cycleVisiting.delete(commentId);
  };

  for (const commentId of commentIds) {
    if (cycleVisited.has(commentId)) {
      continue;
    }

    detectCycles(commentId);
  }

  const reachableFromRoot = new Set<CommentId>();

  const walkReachable = (commentId: CommentId, depth: number) => {
    const knownDepth = depthById.get(commentId);
    if (knownDepth === undefined || depth < knownDepth) {
      depthById.set(commentId, depth);
    }

    if (reachableFromRoot.has(commentId)) {
      return;
    }

    reachableFromRoot.add(commentId);
    traversalOrder.push(commentId);

    const childIds = childIdsById.get(commentId);
    if (!childIds) {
      return;
    }

    for (const childId of childIds) {
      walkReachable(childId, depth + 1);
    }
  };

  if (commentsById[thread.rootCommentId]) {
    walkReachable(thread.rootCommentId, 0);
  }

  for (const commentId of commentIds) {
    if (reachableFromRoot.has(commentId)) {
      continue;
    }

    orphanCommentIds.push(commentId);
    addIssue(issues, seenIssueKeys, `orphan:${commentId}`, {
      type: 'orphan-comment',
      commentId,
    });
  }

  return {
    rootCommentId: thread.rootCommentId,
    commentIds,
    childIdsById,
    treeChildIdsById,
    parentIdsById,
    parentById,
    depthById,
    traversalOrder,
    orphanCommentIds,
    issues,
  };
};

export const getCommentDepth = (graph: ThreadGraph, commentId: CommentId): number | null => {
  return graph.depthById.get(commentId) ?? null;
};

export const getCommentAncestors = (graph: ThreadGraph, commentId: CommentId): CommentId[] => {
  const ancestors: CommentId[] = [];
  const seen = new Set<CommentId>([commentId]);
  let currentParent = graph.parentById.get(commentId);

  while (typeof currentParent === 'string' && !seen.has(currentParent)) {
    ancestors.push(currentParent);
    seen.add(currentParent);
    currentParent = graph.parentById.get(currentParent);
  }

  return ancestors;
};

export const getCommentDescendants = (
  graph: ThreadGraph,
  commentId: CommentId,
  mode: 'tree' | 'graph' = 'tree'
): CommentId[] => {
  const descendants: CommentId[] = [];
  const seen = new Set<CommentId>([commentId]);
  const childMap = mode === 'graph' ? graph.childIdsById : graph.treeChildIdsById;
  const stack = [...(childMap.get(commentId) ?? [])].reverse();

  while (stack.length > 0) {
    const nextId = stack.pop();
    if (!nextId || seen.has(nextId)) {
      continue;
    }

    seen.add(nextId);
    descendants.push(nextId);

    const childIds = childMap.get(nextId);
    if (!childIds || childIds.length === 0) {
      continue;
    }

    for (let index = childIds.length - 1; index >= 0; index -= 1) {
      stack.push(childIds[index]);
    }
  }

  return descendants;
};

export const getOrphanRootCommentIds = (graph: ThreadGraph): CommentId[] => {
  const orphanSet = new Set(graph.orphanCommentIds);
  const orphanRoots = graph.orphanCommentIds.filter((commentId) => {
    const parentId = graph.parentById.get(commentId);
    return typeof parentId !== 'string' || !orphanSet.has(parentId);
  });

  if (orphanRoots.length > 0) {
    return orphanRoots;
  }

  return graph.orphanCommentIds.slice(0, 1);
};

export const isCommentReachableFromRoot = (graph: ThreadGraph, commentId: CommentId): boolean => {
  return graph.depthById.has(commentId);
};

export const hasThreadGraphIssues = (graph: ThreadGraph): boolean => {
  return graph.issues.length > 0;
};

export const getThreadRenderOrder = (graph: ThreadGraph): CommentId[] => {
  const orderedIds: CommentId[] = [];
  const seen = new Set<CommentId>();

  for (const commentId of graph.traversalOrder) {
    if (seen.has(commentId)) {
      continue;
    }

    seen.add(commentId);
    orderedIds.push(commentId);
  }

  for (const commentId of graph.orphanCommentIds) {
    if (seen.has(commentId)) {
      continue;
    }

    seen.add(commentId);
    orderedIds.push(commentId);
  }

  return orderedIds;
};
