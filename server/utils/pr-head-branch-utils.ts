import type { Octokit } from '@octokit/core';

import type {
  PullRequestHeadBranchState,
  PullRequestHeadBranchUnavailableReason,
  PullRequestRepositorySummary,
  PullRequestUserSummary,
} from '#shared/types/pulls';

import { parseLinkHeader } from './github-pagination';

type GitHubClient = Octokit;
type HeadBranchAction = 'delete' | 'restore';

interface RepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

interface GitHubRepositorySummary {
  id?: number;
  name?: string | null;
  full_name?: string | null;
  url?: string | null;
  html_url?: string | null;
  default_branch?: string | null;
  permissions?: RepositoryPermissions | null;
  owner?: PullRequestUserSummary | null;
}

interface GitHubPullRequestBranch {
  ref?: string | null;
  sha?: string | null;
  label?: string | null;
  repo?: GitHubRepositorySummary | null;
}

export interface GitHubPullRequestForHeadBranch {
  number?: number | null;
  state?: string | null;
  merged?: boolean | null;
  merged_at?: string | null;
  head?: GitHubPullRequestBranch | null;
  base?: {
    repo?: GitHubRepositorySummary | null;
  } | null;
}

interface HeadBranchTarget {
  owner: string;
  repo: string;
  ref: string;
  sha: string;
  label: string | null;
  repoSummary: PullRequestRepositorySummary;
}

interface BuildPullHeadBranchStateOptions {
  pullRequest: GitHubPullRequestForHeadBranch;
  referenceExists: boolean | null;
  isProtected?: boolean | null;
  openPullRequestsReferencingBranch?: number | null;
  repository?: GitHubRepositorySummary | null;
}

interface GitHubPullRequestListItem {
  number?: number | null;
}

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getGitHubErrorStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  if ('status' in error && typeof error.status === 'number') return error.status;
  if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode;
  return undefined;
};

const hasWritePermission = (permissions?: RepositoryPermissions | null) =>
  Boolean(permissions?.admin || permissions?.maintain || permissions?.push);

const splitRepositoryFullName = (fullName: string) => {
  const [owner, repo] = fullName.split('/');
  return owner && repo ? { owner, repo } : null;
};

const getRepositoryIdentity = (repository?: GitHubRepositorySummary | null) => {
  const fullName = trimString(repository?.full_name);
  const parsedFullName = splitRepositoryFullName(fullName);
  const owner = trimString(repository?.owner?.login) || parsedFullName?.owner || '';
  const repo = trimString(repository?.name) || parsedFullName?.repo || '';

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo, fullName: `${owner}/${repo}` };
};

const normalizeRepositorySummary = (
  fallback: GitHubRepositorySummary | null | undefined,
  repository: GitHubRepositorySummary | null | undefined
): PullRequestRepositorySummary | null => {
  const source = repository ?? fallback;
  const identity = getRepositoryIdentity(source);

  if (!source || !identity) {
    return null;
  }

  return {
    id: typeof source.id === 'number' ? source.id : undefined,
    name: identity.repo,
    full_name: identity.fullName,
    url: trimString(source.url) || trimString(source.html_url) || undefined,
    default_branch: trimString(source.default_branch) || null,
    permissions: source.permissions ?? null,
    owner: source.owner ?? { login: identity.owner },
  };
};

export function getPullHeadBranchTarget(
  pullRequest: GitHubPullRequestForHeadBranch,
  repository?: GitHubRepositorySummary | null
): HeadBranchTarget | null {
  const head = pullRequest.head;
  const ref = trimString(head?.ref);
  const sha = trimString(head?.sha);
  const repoSummary = normalizeRepositorySummary(head?.repo, repository);

  if (!head || !ref || !sha || ref.startsWith('refs/') || !repoSummary?.name) {
    return null;
  }

  const identity = getRepositoryIdentity(repoSummary);
  if (!identity) {
    return null;
  }

  return {
    owner: identity.owner,
    repo: identity.repo,
    ref,
    sha,
    label: trimString(head.label) || null,
    repoSummary,
  };
}

const buildMissingHeadState = (
  reason: PullRequestHeadBranchUnavailableReason
): PullRequestHeadBranchState => ({
  ref: null,
  sha: null,
  label: null,
  repo: null,
  exists: null,
  protected: null,
  default_branch: null,
  open_pull_requests_count: null,
  can_delete: false,
  can_restore: false,
  unavailable_reason: reason,
});

const isPullRequestClosedOrMerged = (pullRequest: GitHubPullRequestForHeadBranch) =>
  Boolean(pullRequest.merged || pullRequest.merged_at || pullRequest.state === 'closed');

const getUnavailableReason = (params: {
  pullRequest: GitHubPullRequestForHeadBranch;
  target: HeadBranchTarget;
  referenceExists: boolean | null;
  isProtected: boolean | null;
  openPullRequestsReferencingBranch: number | null;
}): PullRequestHeadBranchUnavailableReason | null => {
  if (!isPullRequestClosedOrMerged(params.pullRequest)) return 'not_closed_or_merged';

  const defaultBranch = trimString(params.target.repoSummary.default_branch);
  if (defaultBranch && params.target.ref === defaultBranch) return 'default_branch';
  if (params.isProtected) return 'protected_branch';
  if (!hasWritePermission(params.target.repoSummary.permissions)) return 'missing_permission';
  if (params.referenceExists === null) return 'unknown';
  if (params.openPullRequestsReferencingBranch === null) return 'unknown';
  if (params.openPullRequestsReferencingBranch > 0) return 'open_pull_request';

  return null;
};

export function buildPullHeadBranchState({
  pullRequest,
  referenceExists,
  isProtected = null,
  openPullRequestsReferencingBranch = 0,
  repository = null,
}: BuildPullHeadBranchStateOptions): PullRequestHeadBranchState {
  const target = getPullHeadBranchTarget(pullRequest, repository);
  if (!target) {
    return buildMissingHeadState('missing_head');
  }

  const unavailableReason = getUnavailableReason({
    pullRequest,
    target,
    referenceExists,
    isProtected,
    openPullRequestsReferencingBranch,
  });

  return {
    ref: target.ref,
    sha: target.sha,
    label: target.label,
    repo: target.repoSummary,
    exists: referenceExists,
    protected: isProtected,
    default_branch: target.repoSummary.default_branch ?? null,
    open_pull_requests_count: openPullRequestsReferencingBranch,
    can_delete: unavailableReason === null && referenceExists === true,
    can_restore: unavailableReason === null && referenceExists === false,
    unavailable_reason: unavailableReason,
  };
}

async function fetchOpenPullRequestsReferencingHeadBranch(
  octokit: GitHubClient,
  baseRepository: Pick<HeadBranchTarget, 'owner' | 'repo'> | null,
  target: Pick<HeadBranchTarget, 'owner' | 'ref'>,
  currentPullNumber?: number | null
): Promise<number | null> {
  if (!baseRepository) {
    return null;
  }

  let page = 1;
  let matchingPullRequests = 0;

  while (true) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner: baseRepository.owner,
      repo: baseRepository.repo,
      state: 'open',
      head: `${target.owner}:${target.ref}`,
      per_page: 100,
      page,
    });

    const pullRequests = Array.isArray(response.data)
      ? (response.data as GitHubPullRequestListItem[])
      : [];

    matchingPullRequests += pullRequests.filter((pullRequest) => {
      if (typeof currentPullNumber !== 'number') {
        return true;
      }

      return pullRequest.number !== currentPullNumber;
    }).length;

    const links = parseLinkHeader(
      typeof response.headers.link === 'string' ? response.headers.link : undefined
    );
    if (!links.next) {
      return matchingPullRequests;
    }

    page += 1;
  }
}

async function fetchHeadRepository(
  octokit: GitHubClient,
  target: Pick<HeadBranchTarget, 'owner' | 'repo'>
): Promise<GitHubRepositorySummary | null> {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner: target.owner,
      repo: target.repo,
    });
    return data as GitHubRepositorySummary;
  } catch (error: unknown) {
    if (getGitHubErrorStatusCode(error) === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchHeadReferenceExists(
  octokit: GitHubClient,
  target: Pick<HeadBranchTarget, 'owner' | 'repo' | 'ref'>
): Promise<boolean> {
  try {
    await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner: target.owner,
      repo: target.repo,
      ref: `heads/${target.ref}`,
    });
    return true;
  } catch (error: unknown) {
    if (getGitHubErrorStatusCode(error) === 404) {
      return false;
    }
    throw error;
  }
}

async function fetchHeadBranchProtected(
  octokit: GitHubClient,
  target: Pick<HeadBranchTarget, 'owner' | 'repo' | 'ref'>,
  referenceExists: boolean
): Promise<boolean | null> {
  if (!referenceExists) {
    return false;
  }

  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
      owner: target.owner,
      repo: target.repo,
      branch: target.ref,
    });
    return Boolean((data as { protected?: boolean | null }).protected);
  } catch (error: unknown) {
    if (getGitHubErrorStatusCode(error) === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchPullHeadBranchState(
  octokit: GitHubClient,
  pullRequest: GitHubPullRequestForHeadBranch
): Promise<PullRequestHeadBranchState> {
  const initialTarget = getPullHeadBranchTarget(pullRequest);
  if (!initialTarget) {
    return buildMissingHeadState('missing_head');
  }

  const repository = await fetchHeadRepository(octokit, initialTarget);
  if (!repository) {
    return {
      ...buildPullHeadBranchState({
        pullRequest,
        repository: initialTarget.repoSummary,
        referenceExists: null,
        isProtected: null,
      }),
      unavailable_reason: 'missing_repository',
    };
  }

  const target = getPullHeadBranchTarget(pullRequest, repository);
  if (!target) {
    return buildMissingHeadState('missing_head');
  }

  const baseRepository = getRepositoryIdentity(pullRequest.base?.repo);
  const [referenceExists, openPullRequestsReferencingBranch] = await Promise.all([
    fetchHeadReferenceExists(octokit, target),
    fetchOpenPullRequestsReferencingHeadBranch(octokit, baseRepository, target, pullRequest.number),
  ]);
  const isProtected = await fetchHeadBranchProtected(octokit, target, referenceExists);

  return buildPullHeadBranchState({
    pullRequest,
    repository,
    referenceExists,
    isProtected,
    openPullRequestsReferencingBranch,
  });
}

async function fetchPullRequestForBranchAction(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GitHubPullRequestForHeadBranch> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });

  return data as GitHubPullRequestForHeadBranch;
}

const getBranchActionUnavailableMessage = (
  action: HeadBranchAction,
  state: PullRequestHeadBranchState
) => {
  if (state.unavailable_reason === 'missing_permission') {
    return 'You do not have permission to modify this pull request head branch';
  }

  if (state.unavailable_reason === 'not_closed_or_merged') {
    return 'The pull request must be closed or merged before changing its head branch';
  }

  if (state.unavailable_reason === 'default_branch') {
    return 'The pull request head branch is the default branch and cannot be changed here';
  }

  if (state.unavailable_reason === 'protected_branch') {
    return 'The pull request head branch is protected and cannot be changed here';
  }

  if (state.unavailable_reason === 'missing_repository') {
    return 'The pull request head repository is unavailable';
  }

  if (state.unavailable_reason === 'open_pull_request') {
    return 'The pull request head branch is still used by another open pull request';
  }

  if (action === 'delete' && state.exists === false) {
    return 'The pull request head branch has already been deleted';
  }

  if (action === 'restore' && state.exists === true) {
    return 'The pull request head branch already exists';
  }

  return `The pull request head branch cannot be ${action === 'delete' ? 'deleted' : 'restored'}`;
};

const getBranchActionUnavailableStatus = (
  action: HeadBranchAction,
  state: PullRequestHeadBranchState
) => {
  if (state.unavailable_reason === 'missing_permission') return 403;
  if (action === 'delete' && state.exists === false) return 409;
  if (action === 'restore' && state.exists === true) return 409;
  return 422;
};

const assertHeadBranchActionAllowed = (
  action: HeadBranchAction,
  state: PullRequestHeadBranchState
) => {
  const allowed = action === 'delete' ? state.can_delete : state.can_restore;
  if (allowed) {
    return;
  }

  throw createError({
    statusCode: getBranchActionUnavailableStatus(action, state),
    statusMessage: getBranchActionUnavailableMessage(action, state),
  });
};

export async function deletePullHeadBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestHeadBranchState> {
  const pullRequest = await fetchPullRequestForBranchAction(octokit, owner, repo, pullNumber);
  const state = await fetchPullHeadBranchState(octokit, pullRequest);
  assertHeadBranchActionAllowed('delete', state);

  const target = getPullHeadBranchTarget(pullRequest, state.repo);
  if (!target) {
    throw createError({
      statusCode: 422,
      statusMessage: getBranchActionUnavailableMessage(
        'delete',
        buildMissingHeadState('missing_head')
      ),
    });
  }

  await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
    owner: target.owner,
    repo: target.repo,
    ref: `heads/${target.ref}`,
  });

  return fetchPullHeadBranchState(octokit, pullRequest);
}

export async function restorePullHeadBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestHeadBranchState> {
  const pullRequest = await fetchPullRequestForBranchAction(octokit, owner, repo, pullNumber);
  const state = await fetchPullHeadBranchState(octokit, pullRequest);
  assertHeadBranchActionAllowed('restore', state);

  const target = getPullHeadBranchTarget(pullRequest, state.repo);
  if (!target) {
    throw createError({
      statusCode: 422,
      statusMessage: getBranchActionUnavailableMessage(
        'restore',
        buildMissingHeadState('missing_head')
      ),
    });
  }

  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner: target.owner,
    repo: target.repo,
    ref: `refs/heads/${target.ref}`,
    sha: target.sha,
  });

  return fetchPullHeadBranchState(octokit, pullRequest);
}
