import type { Octokit } from '@octokit/core';

import type { CommentModeration, CommentResourceType } from '#shared/types/comment-moderation';
import { isDeletableCommentResource } from '#shared/types/comment-moderation';

export interface CommentModerationNode {
  __typename?: string;
  id?: string | null;
  databaseId?: number | null;
  isMinimized?: boolean | null;
  minimizedReason?: string | null;
  viewerCanDelete?: boolean | null;
  viewerCanMinimize?: boolean | null;
  viewerCanUnminimize?: boolean | null;
}

export interface CommentNode extends CommentModerationNode {
  body?: string | null;
  repository?: { name: string; owner: { login: string } };
  replies?: { totalCount: number };
  discussion?: { id: string };
  replyTo?: { id: string } | null;
}

export const COMMENT_MODERATION_FIELDS = `
  isMinimized minimizedReason viewerCanMinimize viewerCanUnminimize viewerCanDelete
`;

const RESOURCE_TYPES: CommentResourceType[] = [
  'IssueComment',
  'PullRequestReviewComment',
  'PullRequestReview',
  'CommitComment',
  'DiscussionComment',
];

export function normalizeCommentModeration(
  node: CommentModerationNode
): CommentModeration | undefined {
  if (!node.id || !RESOURCE_TYPES.includes(node.__typename as CommentResourceType)) return;
  const resourceType = node.__typename as CommentResourceType;
  return {
    nodeId: node.id,
    resourceType,
    ...(typeof node.databaseId === 'number' ? { databaseId: node.databaseId } : {}),
    isMinimized: node.isMinimized === true,
    minimizedReason: node.minimizedReason ?? null,
    viewerCanDelete: isDeletableCommentResource(resourceType) && node.viewerCanDelete === true,
    viewerCanMinimize: node.viewerCanMinimize === true,
    viewerCanUnminimize: node.viewerCanUnminimize === true,
  };
}

const COMMENT_NODES_QUERY = `query CommentModeration($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename id
    ${RESOURCE_TYPES.map((type) => `... on ${type} { databaseId body ${COMMENT_MODERATION_FIELDS} }`).join('\n')}
    ... on CommitComment { repository { name owner { login } } }
    ... on DiscussionComment { discussion { id } replyTo { id } replies { totalCount } }
  }
}`;

export async function fetchCommentNodes(octokit: Octokit, nodeIds: string[]) {
  const result = new Map<string, CommentNode>();
  const ids = [...new Set(nodeIds.filter(Boolean))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const response = await octokit.graphql<{ nodes?: (CommentNode | null)[] }>(
      COMMENT_NODES_QUERY,
      { ids: ids.slice(offset, offset + 100) }
    );
    for (const node of response.nodes ?? []) {
      if (node?.id) result.set(node.id, node);
    }
  }
  return result;
}

export async function fetchCommentModeration(octokit: Octokit, nodeIds: string[]) {
  const result = new Map<string, CommentModeration>();
  for (const node of (await fetchCommentNodes(octokit, nodeIds)).values()) {
    const moderation = normalizeCommentModeration(node);
    if (moderation) result.set(moderation.nodeId, moderation);
  }
  return result;
}

export function restCommentModeration(
  resourceType: CommentResourceType,
  raw: { node_id?: string; id?: number | string | bigint }
) {
  return normalizeCommentModeration({
    __typename: resourceType,
    id: raw.node_id,
    databaseId: typeof raw.id === 'number' ? raw.id : undefined,
  });
}

interface ModeratedItem {
  moderation?: CommentModeration;
  reviewComments?: ModeratedItem[];
}

export async function enrichCommentModeration(octokit: Octokit, items: ModeratedItem[]) {
  const targets = items
    .flatMap((item) => [item, ...(item.reviewComments ?? [])])
    .filter((item) => item.moderation);
  if (!targets.length) return;
  const states = await fetchCommentModeration(
    octokit,
    targets.map((item) => item.moderation!.nodeId)
  );
  for (const item of targets)
    item.moderation = states.get(item.moderation!.nodeId) ?? item.moderation;
}
