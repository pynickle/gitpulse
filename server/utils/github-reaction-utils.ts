import type { Octokit } from '@octokit/core';
import * as z from 'zod';

import type {
  GitHubReaction,
  ReactionContent,
  ReactionSummaryPayload,
  ReactionTargetKind,
} from '#shared/types/reactions';
import { getReactionContentsForTarget, normalizeReactionSummary } from '#shared/utils/reactions';

import { parseLinkHeader } from './github-pagination';
import { parseZodRequestBody } from './zod-validation-utils';

type GitHubClient = Octokit;

const REACTIONS_PAGE_SIZE = 100;

interface ReactionMutationBody {
  content: ReactionContent;
}

interface ReactionRequestOptions {
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

export async function fetchIssueCommentReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const reactions = await fetchAllReactions((page) =>
    octokit.request('GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
      owner: options.owner,
      repo: options.repo,
      comment_id: options.targetId,
      per_page: REACTIONS_PAGE_SIZE,
      page,
    })
  );

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'issue-comment'),
  };
}

export async function fetchPullReviewCommentReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const reactions = await fetchAllReactions((page) =>
    octokit.request('GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions', {
      owner: options.owner,
      repo: options.repo,
      comment_id: options.targetId,
      per_page: REACTIONS_PAGE_SIZE,
      page,
    })
  );

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'pull-review-comment'),
  };
}

export async function fetchIssueReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const reactions = await fetchAllReactions((page) =>
    octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/reactions', {
      owner: options.owner,
      repo: options.repo,
      issue_number: options.targetId,
      per_page: REACTIONS_PAGE_SIZE,
      page,
    })
  );

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'issue'),
  };
}

export async function fetchReleaseReactionSummary(
  octokit: GitHubClient,
  options: ReactionRequestOptions,
  viewerLogin: string
): Promise<ReactionSummaryPayload> {
  const reactions = await fetchAllReactions((page) =>
    octokit.request('GET /repos/{owner}/{repo}/releases/{release_id}/reactions', {
      owner: options.owner,
      repo: options.repo,
      release_id: options.targetId,
      per_page: REACTIONS_PAGE_SIZE,
      page,
    })
  );

  return {
    items: normalizeReactionSummary(reactions, viewerLogin, 'release'),
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
  const reactionId =
    (await fetchSummary()).items.find((item) => item.content === content)?.viewerReactionId ?? null;

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
