import type { Octokit } from '@octokit/core';

import { parseLinkHeader } from '#server/utils/github-pagination';
import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { normalizeRequestBody } from '#server/utils/repo-route-utils';

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

interface GitHubCheckRunResponse {
  name?: string;
  status?: string | null;
  conclusion?: string | null;
  html_url?: string | null;
  app?: {
    name?: string | null;
  } | null;
}

interface GitHubCheckRunsResponse {
  check_runs?: GitHubCheckRunResponse[];
}

interface GitHubPullRequestResponse {
  state?: string | null;
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

interface MergePullRequestBody {
  method?: unknown;
  commitTitle?: unknown;
  commitMessage?: unknown;
}

export interface PRMergedBy {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface PRCheckRunSummary {
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  appName: string | null;
}

export interface PRChecksSummary {
  total: number;
  success: number;
  failure: number;
  pending: number;
  neutral: number;
  runs: PRCheckRunSummary[];
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
  checks: PRChecksSummary;
  headSha: string | null;
  viewerCanMerge: boolean;
}

export interface NormalizedMergePullRequestBody {
  method: PRMergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

const mergeMethods = new Set<PRMergeMethod>(['merge', 'squash', 'rebase']);

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

function getCheckRunBucket(
  run: GitHubCheckRunResponse
): 'success' | 'failure' | 'pending' | 'neutral' {
  if (run.status !== 'completed') return 'pending';

  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'neutral':
    case 'skipped':
      return 'neutral';
    default:
      return 'failure';
  }
}

function buildChecksSummary(runs: GitHubCheckRunResponse[]): PRChecksSummary {
  const checks: PRChecksSummary = {
    total: runs.length,
    success: 0,
    failure: 0,
    pending: 0,
    neutral: 0,
    runs: [],
  };

  for (const run of runs) {
    checks[getCheckRunBucket(run)] += 1;
    checks.runs.push({
      name: run.name ?? 'Unnamed check',
      status: run.status ?? 'unknown',
      conclusion: run.conclusion ?? null,
      htmlUrl: run.html_url ?? null,
      appName: run.app?.name ?? null,
    });
  }

  return checks;
}

async function fetchCheckRuns(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  headSha: string | null
): Promise<GitHubCheckRunResponse[]> {
  if (!headSha) {
    return [];
  }

  const runs: GitHubCheckRunResponse[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      owner,
      repo,
      ref: headSha,
      per_page: 100,
      page,
    });
    const payload = response.data as GitHubCheckRunsResponse;
    runs.push(...(payload.check_runs ?? []));

    const links = parseLinkHeader(
      typeof response.headers.link === 'string' ? response.headers.link : undefined
    );
    if (!links.next) {
      return runs;
    }

    page += 1;
  }
}

export function normalizeMergePullRequestBody(body: unknown): NormalizedMergePullRequestBody {
  const requestBody = normalizeRequestBody<MergePullRequestBody>(body, ['method']);
  const method = requestBody?.method;

  if (typeof method !== 'string' || !mergeMethods.has(method as PRMergeMethod)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'method must be one of merge, squash, or rebase',
    });
  }

  const normalizedBody: NormalizedMergePullRequestBody = {
    method: method as PRMergeMethod,
  };

  const commitTitle = trimString(requestBody.commitTitle);
  if (commitTitle) {
    normalizedBody.commitTitle = commitTitle;
  }

  const commitMessage = trimString(requestBody.commitMessage);
  if (commitMessage) {
    normalizedBody.commitMessage = commitMessage;
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

  const [reviews, requestedReviewers, checkRuns, repoPermissions] = await Promise.all([
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
    fetchCheckRuns(octokit, owner, repo, headSha),
    fetchRepositoryPermissions(octokit, owner, repo),
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
    checks: buildChecksSummary(checkRuns),
    headSha,
    viewerCanMerge: getViewerCanMerge(
      repoPermissions ?? normalizedPullRequest.base?.repo?.permissions
    ),
  };
}
