import type { Octokit } from '@octokit/core';
import * as z from 'zod';

import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { fetchPullRequestCheckRollup } from '#server/utils/pr-check-rollup-graphql-utils';
import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
import type { PullRequestHeadBranchState } from '#shared/types/pulls';

import { fetchPullHeadBranchState } from './pr-head-branch-utils';

type GitHubClient = Octokit;

export type PRState = 'open' | 'closed' | 'merged';
export type PRReviewDecision = 'approved' | 'changes_requested' | 'review_required' | 'none';
export type PRMergeMethod = 'merge' | 'squash' | 'rebase';

interface GitHubUserSummary {
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
}

interface GitHubPullReviewResponse {
  id?: number | string;
  state?: string | null;
  submitted_at?: string | null;
  user?: GitHubUserSummary | null;
}

interface GitHubRequestedReviewersResponse {
  users?: GitHubUserSummary[];
  teams?: unknown[];
}

interface GitHubPullRequestResponse {
  state?: string | null;
  node_id?: string | null;
  merged?: boolean | null;
  merged_at?: string | null;
  merged_by?: GitHubUserSummary | null;
  merge_commit_sha?: string | null;
  mergeable_state?: string | null;
  mergeable?: boolean | null;
  auto_merge?: unknown;
  draft?: boolean | null;
  requested_reviewers?: GitHubUserSummary[];
  requested_teams?: unknown[];
  head?: {
    sha?: string | null;
  } | null;
  base?: {
    repo?: {
      permissions?: RepositoryPermissions | null;
    } | null;
  } | null;
}

interface RepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

export interface PRMergedBy {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface PRReviewSummary {
  approved: number;
  changesRequested: number;
}

export interface PRMergeStatus {
  state: PRState;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: PRMergedBy | null;
  mergeCommitSha: string | null;
  mergeableState: string | null;
  mergeable: boolean | null;
  autoMerge: boolean;
  draft: boolean;
  reviewDecision: PRReviewDecision;
  reviewSummary: PRReviewSummary;
  /**
   * GitHub's own Check Rollup for the head commit. Null when GitHub reports
   * none or the rollup could not be read; every surface then hides its checks.
   */
  checkRollup: PullRequestCheckRollup | null;
  headSha: string | null;
  headBranch: PullRequestHeadBranchState | null;
  viewerCanMerge: boolean;
}

export interface NormalizedMergePullRequestBody {
  method: PRMergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

const mergeMethodSchema = z.enum(['merge', 'squash', 'rebase']);
const optionalTrimmedStringSchema = z.string().trim().min(1).optional();
const mergePullRequestBodySchema = z.strictObject({
  method: mergeMethodSchema,
  commitTitle: optionalTrimmedStringSchema,
  commitMessage: optionalTrimmedStringSchema,
});

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getReviewTimestamp = (review: GitHubPullReviewResponse) => review.submitted_at ?? null;

const isAfter = (first?: string | null, second?: string | null) => {
  if (!first) return false;
  if (!second) return true;
  return (Date.parse(first) || 0) >= (Date.parse(second) || 0);
};

function mapMergedBy(user: GitHubUserSummary | null | undefined): PRMergedBy | null {
  const login = trimString(user?.login);
  if (!login) return null;

  return {
    login,
    avatarUrl: user?.avatar_url ?? '',
    htmlUrl: user?.html_url ?? '',
  };
}

function normalizePullState(pullRequest: GitHubPullRequestResponse): PRState {
  if (pullRequest.merged) return 'merged';
  return pullRequest.state === 'closed' ? 'closed' : 'open';
}

function getViewerCanMerge(permissions?: RepositoryPermissions | null) {
  return Boolean(permissions?.admin || permissions?.maintain || permissions?.push);
}

async function fetchRepositoryPermissions(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<RepositoryPermissions | null> {
  try {
    const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });
    return repository.permissions ?? null;
  } catch (error) {
    console.error('Failed to fetch repository permissions for merge status', error);
    return null;
  }
}

function buildRequestedReviewerCount(
  pullRequest: GitHubPullRequestResponse,
  requestedReviewers?: GitHubRequestedReviewersResponse
) {
  return (
    (requestedReviewers?.users?.length ?? pullRequest.requested_reviewers?.length ?? 0) +
    (requestedReviewers?.teams?.length ?? pullRequest.requested_teams?.length ?? 0)
  );
}

function computeReviewState(reviews: GitHubPullReviewResponse[]) {
  const latestReviews = new Map<string, GitHubPullReviewResponse>();

  for (const review of reviews) {
    const login = trimString(review.user?.login).toLowerCase();
    if (!login) continue;

    const state = trimString(review.state).toUpperCase();
    if (!state || state === 'DISMISSED') continue;

    const current = latestReviews.get(login);
    if (!current || isAfter(getReviewTimestamp(review), getReviewTimestamp(current))) {
      latestReviews.set(login, review);
    }
  }

  let approved = 0;
  let changesRequested = 0;

  for (const review of latestReviews.values()) {
    const state = trimString(review.state).toUpperCase();
    if (state === 'APPROVED') approved += 1;
    if (state === 'CHANGES_REQUESTED') changesRequested += 1;
  }

  return { approved, changesRequested };
}

function computeReviewDecision(params: {
  reviews: GitHubPullReviewResponse[];
  requestedReviewerCount: number;
}): { decision: PRReviewDecision; summary: PRReviewSummary } {
  const summary = computeReviewState(params.reviews);

  if (summary.changesRequested > 0) {
    return { decision: 'changes_requested', summary };
  }

  if (summary.approved > 0) {
    return { decision: 'approved', summary };
  }

  if (params.requestedReviewerCount > 0) {
    return { decision: 'review_required', summary };
  }

  return { decision: 'none', summary };
}

export function normalizeMergePullRequestBody(body: unknown): NormalizedMergePullRequestBody {
  const requestBody = parseZodRequestBody(
    mergePullRequestBodySchema,
    body,
    'Invalid pull request merge request body'
  );

  const normalizedBody: NormalizedMergePullRequestBody = {
    method: requestBody.method,
  };

  if (requestBody.commitTitle) {
    normalizedBody.commitTitle = requestBody.commitTitle;
  }

  if (requestBody.commitMessage) {
    normalizedBody.commitMessage = requestBody.commitMessage;
  }

  return normalizedBody;
}

export async function fetchPRMergeStatus(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRMergeStatus> {
  const { data: pullRequest } = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}',
    {
      owner,
      repo,
      pull_number: pullNumber,
    }
  );
  const normalizedPullRequest = pullRequest as GitHubPullRequestResponse;
  const headSha = normalizedPullRequest.head?.sha ?? null;

  const [reviews, requestedReviewers, repoPermissions, headBranch, checkRollup] = await Promise.all(
    [
      fetchPaginatedArray<GitHubPullReviewResponse>(
        octokit,
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
          owner,
          repo,
          pull_number: pullNumber,
        }
      ),
      octokit
        .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
          owner,
          repo,
          pull_number: pullNumber,
        })
        .then(({ data }) => data as GitHubRequestedReviewersResponse),
      fetchRepositoryPermissions(octokit, owner, repo),
      fetchPullHeadBranchState(octokit, normalizedPullRequest).catch((error: unknown) => {
        console.warn('Failed to fetch pull request head branch action state:', error);
        return null;
      }),
      fetchPullRequestCheckRollup(octokit, normalizedPullRequest.node_id ?? null),
    ]
  );

  const review = computeReviewDecision({
    reviews,
    requestedReviewerCount: buildRequestedReviewerCount(normalizedPullRequest, requestedReviewers),
  });

  return {
    state: normalizePullState(normalizedPullRequest),
    merged: Boolean(normalizedPullRequest.merged),
    mergedAt: normalizedPullRequest.merged_at ?? null,
    mergedBy: mapMergedBy(normalizedPullRequest.merged_by),
    mergeCommitSha: normalizedPullRequest.merge_commit_sha ?? null,
    mergeableState: normalizedPullRequest.mergeable_state ?? null,
    mergeable: normalizedPullRequest.mergeable ?? null,
    autoMerge: Boolean(normalizedPullRequest.auto_merge),
    draft: Boolean(normalizedPullRequest.draft),
    reviewDecision: review.decision,
    reviewSummary: review.summary,
    checkRollup,
    headSha,
    headBranch,
    viewerCanMerge: getViewerCanMerge(
      repoPermissions ?? normalizedPullRequest.base?.repo?.permissions
    ),
  };
}
