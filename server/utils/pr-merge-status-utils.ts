import type { Octokit } from '@octokit/core';
import * as z from 'zod';

import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { fetchPullRequestCheckRollup } from '#server/utils/pr-check-rollup-graphql-utils';
import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
import type { PullRequestHeadBranchState } from '#shared/types/pulls';

import { fetchPullHeadBranchState } from './pr-head-branch-utils';
import type { PRMergeMethod, RepositoryMergeSettings } from './pr-merge-settings-utils';
import { mapRepositoryMergeSettings, resolveAllowedMergeMethods } from './pr-merge-settings-utils';

type GitHubClient = Octokit;

export type PRState = 'open' | 'closed' | 'merged';
export type PRReviewDecision = 'approved' | 'changes_requested' | 'review_required' | 'none';

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
    repo?: {
      name?: string | null;
      owner?: { login?: string | null } | null;
      permissions?: RepositoryPermissions | null;
    } | null;
  } | null;
  base?: {
    ref?: string | null;
    sha?: string | null;
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
  /**
   * Commits on the base ref that are absent from the head.
   * Null when that comparison could not be read. Zero is current, including a head that is only ahead.
   */
  behindBy: number | null;
  /** The pull request's base ref, the ref currency is measured against. */
  baseRef: string;
  /** The pull request's base tip, not the merge base. */
  baseSha: string | null;
  /** The viewer can write the head repository, or can edit files on this pull request. */
  viewerCanWriteHead: boolean;
  /** The merge methods the repository allows, in the order the box offers them. */
  allowedMergeMethods: PRMergeMethod[];
}

export type PRBranchUpdateMethod = 'merge' | 'rebase';

export interface NormalizedUpdatePullRequestBranchBody {
  method: PRBranchUpdateMethod;
  expectedHeadOid: string;
}

export interface NormalizedMergePullRequestBody {
  method: PRMergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

const mergeMethodSchema = z.enum(['merge', 'squash', 'rebase']);
const branchUpdateMethodSchema = z.enum(['merge', 'rebase']);
const optionalTrimmedStringSchema = z.string().trim().min(1).optional();
const mergePullRequestBodySchema = z.strictObject({
  method: mergeMethodSchema,
  commitTitle: optionalTrimmedStringSchema,
  commitMessage: optionalTrimmedStringSchema,
});
const updatePullRequestBranchBodySchema = z.strictObject({
  method: branchUpdateMethodSchema.optional(),
  expectedHeadOid: z.string().trim().min(1),
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

/** Write or admin on a repository. GitHub reports write as `push`. */
function hasWriteOrAdmin(permissions?: RepositoryPermissions | null) {
  return Boolean(permissions?.admin || permissions?.push);
}

const VIEWER_CAN_EDIT_FILES_QUERY = `query PullRequestViewerCanEditFiles($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      viewerCanEditFiles
    }
  }
}`;

const UPDATE_PULL_REQUEST_BRANCH_MUTATION = `mutation UpdatePullRequestBranch($input: UpdatePullRequestBranchInput!) {
  updatePullRequestBranch(input: $input) {
    pullRequest {
      number
    }
  }
}`;

/**
 * `viewerCanUpdateBranch` tracks whether GitHub's own page shows Update branch.
 * It stays false when the repository does not suggest updates, even for an admin
 * whose update mutation would succeed. Currency uses write access instead.
 */
async function fetchViewerCanEditFiles(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
) {
  try {
    const response = await octokit.graphql<{
      repository?: {
        pullRequest?: { viewerCanEditFiles?: boolean | null } | null;
      } | null;
    }>(VIEWER_CAN_EDIT_FILES_QUERY, { owner, repo, number: pullNumber });
    return Boolean(response.repository?.pullRequest?.viewerCanEditFiles);
  } catch (error) {
    console.warn('Failed to read whether the viewer can edit pull request files:', error);
    return false;
  }
}

async function fetchRepositoryPermissions(octokit: GitHubClient, owner: string, repo: string) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
    return (data.permissions as RepositoryPermissions | undefined) ?? null;
  } catch (error) {
    console.warn('Failed to fetch head repository permissions for branch currency:', error);
    return null;
  }
}

/**
 * Counts commits on `baseRef` that are absent from `headOid`.
 * Compare's `behind_by` is that count when the base ref is the left side.
 */
async function fetchBaseBehindCount(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  baseRef: string,
  headOid: string
) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo,
      basehead: `${baseRef}...${headOid}`,
      per_page: 1,
    });
    return typeof data.behind_by === 'number' ? data.behind_by : null;
  } catch (error) {
    console.warn('Failed to compare pull request head with its base ref:', error);
    return null;
  }
}

function graphQLMessages(error: unknown) {
  if (!error || typeof error !== 'object') return [];

  const messages: string[] = [];
  if ('message' in error && typeof error.message === 'string' && error.message) {
    messages.push(error.message);
  }
  if ('errors' in error && Array.isArray(error.errors)) {
    for (const entry of error.errors) {
      if (
        entry &&
        typeof entry === 'object' &&
        'message' in entry &&
        typeof entry.message === 'string' &&
        entry.message
      ) {
        messages.push(entry.message);
      }
    }
  }
  return messages;
}

function isHeadOidMismatchMessage(message: string) {
  const normalized = message.replace(/[’‘]/g, "'").toLowerCase();
  return (
    normalized.includes('expected head') &&
    (normalized.includes('did not match') ||
      normalized.includes("didn't match") ||
      normalized.includes('does not match'))
  );
}

interface RepositoryAccess {
  permissions: RepositoryPermissions | null;
  mergeSettings: RepositoryMergeSettings | null;
}

async function fetchRepositoryAccess(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<RepositoryAccess> {
  try {
    const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });
    return {
      permissions: repository.permissions ?? null,
      mergeSettings: mapRepositoryMergeSettings(repository),
    };
  } catch (error) {
    console.error('Failed to fetch repository access for merge status', error);
    return { permissions: null, mergeSettings: null };
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

export function normalizeUpdatePullRequestBranchBody(
  body: unknown
): NormalizedUpdatePullRequestBranchBody {
  const requestBody = parseZodRequestBody(
    updatePullRequestBranchBodySchema,
    body,
    'Invalid pull request branch update'
  );

  return {
    method: requestBody.method ?? 'merge',
    expectedHeadOid: requestBody.expectedHeadOid,
  };
}

function headOidMismatchFrom(error: unknown) {
  const messages = graphQLMessages(error);
  const message = messages.find((entry) => isHeadOidMismatchMessage(entry));
  if (!message) return null;

  return createError({
    statusCode: 409,
    statusMessage: message,
    data: { code: 'head_oid_mismatch' },
  });
}

export async function updatePullRequestBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  body: NormalizedUpdatePullRequestBranchBody
) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const pullRequestId = trimString((data as { node_id?: string | null }).node_id);
  if (!pullRequestId) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Pull request is missing a node id',
    });
  }

  try {
    await octokit.graphql(UPDATE_PULL_REQUEST_BRANCH_MUTATION, {
      input: {
        pullRequestId,
        expectedHeadOid: body.expectedHeadOid,
        updateMethod: body.method === 'rebase' ? 'REBASE' : 'MERGE',
      },
    });
  } catch (error) {
    const mismatch = headOidMismatchFrom(error);
    if (mismatch) throw mismatch;
    throw error;
  }

  return { updated: true };
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
  const baseRef = trimString(normalizedPullRequest.base?.ref);
  const baseSha = trimString(normalizedPullRequest.base?.sha) || null;
  const headOid = trimString(headSha);
  const headOwner = trimString(normalizedPullRequest.head?.repo?.owner?.login);
  const headRepoName = trimString(normalizedPullRequest.head?.repo?.name);
  const reportedHeadPermissions = normalizedPullRequest.head?.repo?.permissions ?? null;
  const headMatchesBase =
    headOwner.toLowerCase() === owner.toLowerCase() &&
    headRepoName.toLowerCase() === repo.toLowerCase();

  const [
    reviews,
    requestedReviewers,
    repositoryAccess,
    headBranch,
    checkRollup,
    viewerCanEditFiles,
    fetchedHeadPermissions,
    behindBy,
  ] = await Promise.all([
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
    fetchRepositoryAccess(octokit, owner, repo),
    fetchPullHeadBranchState(octokit, normalizedPullRequest).catch((error: unknown) => {
      console.warn('Failed to fetch pull request head branch action state:', error);
      return null;
    }),
    fetchPullRequestCheckRollup(octokit, normalizedPullRequest.node_id ?? null),
    fetchViewerCanEditFiles(octokit, owner, repo, pullNumber),
    reportedHeadPermissions || !headOwner || !headRepoName || headMatchesBase
      ? Promise.resolve(null)
      : fetchRepositoryPermissions(octokit, headOwner, headRepoName),
    baseRef && headOid
      ? fetchBaseBehindCount(octokit, owner, repo, baseRef, headOid)
      : Promise.resolve(null),
  ]);

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
      repositoryAccess.permissions ?? normalizedPullRequest.base?.repo?.permissions
    ),
    behindBy,
    baseRef,
    baseSha,
    viewerCanWriteHead:
      hasWriteOrAdmin(
        reportedHeadPermissions ??
          (headMatchesBase ? repositoryAccess.permissions : fetchedHeadPermissions)
      ) || viewerCanEditFiles,
    allowedMergeMethods: resolveAllowedMergeMethods(repositoryAccess.mergeSettings),
  };
}
