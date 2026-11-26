import type { Octokit } from '@octokit/core';
import * as z from 'zod';

import type {
  GitHubReaction,
  ReactionContent,
  ReactionSummaryPayload,
  ReactionTargetKind,
} from '#shared/types/reactions';
import {
  getReactionContentsForTarget,
  isReactionForbiddenError,
  normalizeReactionSummary,
  normalizeViewerCanReact,
  REACTION_FORBIDDEN_ERROR_CODE,
} from '#shared/utils/reactions';

import { hasGitHubErrorStatus } from './github-auth-utils';
import { parseLinkHeader } from './github-pagination';
import { parseZodRequestBody } from './zod-validation-utils';

type GitHubClient = Octokit;

const REACTIONS_PAGE_SIZE = 100;

const ISSUE_VIEWER_CAN_REACT_QUERY = `
query IssueViewerCanReact($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issueOrPullRequest(number: $number) {
      ... on Issue { viewerCanReact }
      ... on PullRequest { viewerCanReact }
    }
  }
}
`;

const NODE_VIEWER_CAN_REACT_QUERY = `
query NodeViewerCanReact($id: ID!) {
  node(id: $id) {
    ... on IssueComment { viewerCanReact }
    ... on PullRequestReviewComment { viewerCanReact }
    ... on CommitComment { viewerCanReact }
    ... on Release { viewerCanReact }
  }
}
`;

const TARGET_NODE_REST_LOOKUP: Record<
  Exclude<ReactionTargetKind, 'issue'>,
  { route: string; idParam: string }
> = {
  'issue-comment': {
    route: 'GET /repos/{owner}/{repo}/issues/comments/{comment_id}',
    idParam: 'comment_id',
  },
  'pull-review-comment': {
    route: 'GET /repos/{owner}/{repo}/pulls/comments/{comment_id}',
    idParam: 'comment_id',
  },
  release: {
    route: 'GET /repos/{owner}/{repo}/releases/{release_id}',
    idParam: 'release_id',
  },
};

interface ReactionMutationBody {
  content: ReactionContent;
}

export interface ReactionRequestOptions {
  owner: string;
  repo: string;
  targetId: number;
}

const createReactionMutationBodySchema = (target: ReactionTargetKind) =>
  z.strictObject({
    content: z
      .string()
      .trim()
      .refine(
        (content): content is ReactionContent =>
          getReactionContentsForTarget(target).includes(content as ReactionContent),
        { message: 'Unsupported reaction content' }
      ),
  });

export function parseReactionTargetId(value: unknown, fieldName: string) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!/^\d+$/.test(normalizedValue)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a positive integer`,
    });
  }

  const targetId = Number.parseInt(normalizedValue, 10);

  if (!Number.isSafeInteger(targetId) || targetId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a positive integer`,
    });
  }

  return targetId;
}

export function normalizeReactionMutationBody(
  body: unknown,
  target: ReactionTargetKind
): ReactionMutationBody {
  return parseZodRequestBody(
    createReactionMutationBodySchema(target),
    body,
    'Invalid reaction request body'
  );
}

export async function fetchNodeViewerCanReact(
  octokit: GitHubClient,
  nodeId: string | undefined | null
): Promise<boolean | undefined> {
  const normalizedId = typeof nodeId === 'string' ? nodeId.trim() : '';
  if (!normalizedId) {
    return undefined;
  }

  try {
    const response = await octokit.graphql<{
      node?: { viewerCanReact?: boolean | null } | null;
    }>(NODE_VIEWER_CAN_REACT_QUERY, { id: normalizedId });

    return normalizeViewerCanReact(response.node?.viewerCanReact);
  } catch {
    return undefined;
  }
}

async function resolveTargetNodeId(
  octokit: GitHubClient,
  targetKind: Exclude<ReactionTargetKind, 'issue'>,
  options: ReactionRequestOptions
): Promise<string | undefined> {
  const { route, idParam } = TARGET_NODE_REST_LOOKUP[targetKind];

  try {
    const { data } = await octokit.request(route, {
      owner: options.owner,
      repo: options.repo,
      [idParam]: options.targetId,
    });
    return typeof (data as { node_id?: unknown })?.node_id === 'string'
      ? (data as { node_id: string }).node_id
      : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchTargetViewerCanReact(
  octokit: GitHubClient,
  targetKind: ReactionTargetKind,
  options: ReactionRequestOptions
): Promise<boolean | undefined> {
  if (targetKind === 'issue') {
    try {
      const response = await octokit.graphql<{
        repository?: {
          issueOrPullRequest?: { viewerCanReact?: boolean | null } | null;
        } | null;
      }>(ISSUE_VIEWER_CAN_REACT_QUERY, {
        owner: options.owner,
        repo: options.repo,
        number: options.targetId,
      });

      return normalizeViewerCanReact(response.repository?.issueOrPullRequest?.viewerCanReact);
    } catch {
      return undefined;
    }
  }

  const nodeId = await resolveTargetNodeId(octokit, targetKind, options);
  return await fetchNodeViewerCanReact(octokit, nodeId);
}

export function createReactionForbiddenError() {
  return createError({
    statusCode: 403,
    statusMessage: 'Cannot react to this target',
    data: {
      code: REACTION_FORBIDDEN_ERROR_CODE,
      canReact: false,
    },
  });
}

export async function runReactionMutation<T>(
  octokit: GitHubClient,
  targetKind: ReactionTargetKind,
  options: ReactionRequestOptions,
  mutate: () => Promise<T>
): Promise<T> {
  try {
    return await mutate();
  } catch (error: unknown) {
    if (isReactionForbiddenError(error)) {
      throw error;
    }

    if (hasGitHubErrorStatus(error, 403)) {
      // GitHub's REST reaction endpoints return 403 with a misleading
      // "Must have admin rights to Repository." message when viewerCanReact is
      // false (e.g. blocked author, locked conversation, archived repository).
      // Never infer eligibility from the REST message; verify via GraphQL.
      const canReact = await fetchTargetViewerCanReact(octokit, targetKind, options);
      if (canReact === false) {
        throw createReactionForbiddenError();
      }
    }

    throw error;
  }
}

export async function fetchIssueCommentReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const [reactions, canReact] = await Promise.all([
    fetchAllReactions((page) =>
      octokit.request('GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
        owner: options.owner,
        repo: options.repo,
        comment_id: options.targetId,
        per_page: REACTIONS_PAGE_SIZE,
        page,
      })
    ),
    fetchTargetViewerCanReact(octokit, 'issue-comment', options),
  ]);

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'issue-comment'),
    ...(canReact !== undefined ? { canReact } : {}),
  };
}

export async function fetchPullReviewCommentReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const [reactions, canReact] = await Promise.all([
    fetchAllReactions((page) =>
      octokit.request('GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions', {
        owner: options.owner,
        repo: options.repo,
        comment_id: options.targetId,
        per_page: REACTIONS_PAGE_SIZE,
        page,
      })
    ),
    fetchTargetViewerCanReact(octokit, 'pull-review-comment', options),
  ]);

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'pull-review-comment'),
    ...(canReact !== undefined ? { canReact } : {}),
  };
}

export async function fetchIssueReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const [reactions, canReact] = await Promise.all([
    fetchAllReactions((page) =>
      octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/reactions', {
        owner: options.owner,
        repo: options.repo,
        issue_number: options.targetId,
        per_page: REACTIONS_PAGE_SIZE,
        page,
      })
    ),
    fetchTargetViewerCanReact(octokit, 'issue', options),
  ]);

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'issue'),
    ...(canReact !== undefined ? { canReact } : {}),
  };
}

export async function fetchReleaseReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string,
  fetchOptions: { includeEligibility?: boolean } = {}
): Promise<ReactionSummaryPayload> {
  const includeEligibility = fetchOptions.includeEligibility ?? true;
  const [reactions, canReact] = await Promise.all([
    fetchAllReactions((page) =>
      octokit.request('GET /repos/{owner}/{repo}/releases/{release_id}/reactions', {
        owner: options.owner,
        repo: options.repo,
        release_id: options.targetId,
        per_page: REACTIONS_PAGE_SIZE,
        page,
      })
    ),
    includeEligibility
      ? fetchTargetViewerCanReact(octokit, 'release', options)
      : Promise.resolve(undefined),
  ]);

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'release'),
    ...(canReact !== undefined ? { canReact } : {}),
  };
}

export async function createIssueReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  content: ReactionContent
) {
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/reactions', {
    owner: options.owner,
    repo: options.repo,
    issue_number: options.targetId,
    content,
  });
}

export async function createIssueCommentReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  content: ReactionContent
) {
  await octokit.request('POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
    owner: options.owner,
    repo: options.repo,
    comment_id: options.targetId,
    content,
  });
}

export async function createPullReviewCommentReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  content: ReactionContent
) {
  await octokit.request('POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions', {
    owner: options.owner,
    repo: options.repo,
    comment_id: options.targetId,
    content,
  });
}

export async function createReleaseReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  content: ReactionContent
) {
  await octokit.request('POST /repos/{owner}/{repo}/releases/{release_id}/reactions', {
    owner: options.owner,
    repo: options.repo,
    release_id: options.targetId,
    content: content as '+1' | 'laugh' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  });
}

export async function deleteIssueReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  reactionId: number
) {
  await octokit.request(
    'DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}',
    {
      owner: options.owner,
      repo: options.repo,
      issue_number: options.targetId,
      reaction_id: reactionId,
    }
  );
}

export async function deleteIssueCommentReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  reactionId: number
) {
  await octokit.request(
    'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}',
    {
      owner: options.owner,
      repo: options.repo,
      comment_id: options.targetId,
      reaction_id: reactionId,
    }
  );
}

export async function deletePullReviewCommentReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  reactionId: number
) {
  await octokit.request(
    'DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}',
    {
      owner: options.owner,
      repo: options.repo,
      comment_id: options.targetId,
      reaction_id: reactionId,
    }
  );
}

export async function deleteReleaseReaction(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  reactionId: number
) {
  await octokit.request(
    'DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}',
    {
      owner: options.owner,
      repo: options.repo,
      release_id: options.targetId,
      reaction_id: reactionId,
    }
  );
}

export async function deleteReactionByContent(
  fetchSummary: () => Promise<ReactionSummaryPayload>,
  deleteReaction: (reactionId: number) => Promise<void>,
  content: ReactionContent
) {
  const summary = await fetchSummary();
  if (summary.canReact === false) {
    throw createReactionForbiddenError();
  }

  const reactionId =
    summary.items.find((item) => item.content === content)?.viewerReactionId ?? null;

  if (reactionId) {
    await deleteReaction(reactionId);
  }
}

async function fetchAllReactions(
  requestPage: (page: number) => Promise<{
    data: unknown;
    headers: {
      link?: string;
    };
  }>
): Promise<GitHubReaction[]> {
  const reactions: GitHubReaction[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await requestPage(page);

    if (Array.isArray(response.data)) {
      reactions.push(...(response.data as GitHubReaction[]));
    }

    const links = parseLinkHeader(response.headers.link);
    hasNextPage = Boolean(links.next);
    page += 1;
  }

  return reactions;
}
