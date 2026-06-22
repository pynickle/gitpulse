import type { PullRequestHeadBranchState } from '#shared/types/pulls';

export type PRState = 'open' | 'closed' | 'merged';
export type PRReviewDecision = 'approved' | 'changes_requested' | 'review_required' | 'none';
export type PRMergeMethod = 'merge' | 'squash' | 'rebase';

export interface PRMergedBy {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface PRReviewSummary {
  approved: number;
  changesRequested: number;
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
  headBranch: PullRequestHeadBranchState | null;
  viewerCanMerge: boolean;
}

export interface PRMergePayload {
  method: PRMergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

export interface PRMergeResponse {
  merged: boolean;
  sha: string | null;
  message: string;
}

export interface PRHeadBranchMutationResponse {
  head_branch?: PullRequestHeadBranchState | null;
}

const getFetchErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if ('data' in error && error.data && typeof error.data === 'object') {
    const data = error.data as { statusMessage?: unknown; message?: unknown };
    if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage;
    if (typeof data.message === 'string' && data.message) return data.message;
  }

  if ('statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage) {
    return error.statusMessage;
  }

  if ('message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }

  return fallback;
};

export function usePRMergeStatus() {
  const apiFetch = useGitPulseApiFetch();
  const mergeStatus = shallowRef<PRMergeStatus | null>(null);
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const mergeError = shallowRef<string | null>(null);
  const branchActionError = shallowRef<string | null>(null);
  let statusRequestId = 0;

  const setMergeStatus = (status: PRMergeStatus | null) => {
    statusRequestId += 1;
    mergeStatus.value = status;
    loading.value = false;
    error.value = null;
  };

  const fetchMergeStatus = async (owner: string, repo: string, pullNumber: number) => {
    const requestId = statusRequestId + 1;
    statusRequestId = requestId;
    loading.value = true;
    error.value = null;

    try {
      const status = await apiFetch<PRMergeStatus>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/merge-status`,
        {
          method: 'GET',
        }
      );
      if (requestId === statusRequestId) {
        mergeStatus.value = status;
      }
      return status;
    } catch (fetchError: unknown) {
      if (requestId === statusRequestId) {
        error.value = getFetchErrorMessage(fetchError, 'Failed to fetch pull request merge status');
        mergeStatus.value = null;
      }
      return null;
    } finally {
      if (requestId === statusRequestId) {
        loading.value = false;
      }
    }
  };

  const mergePullRequest = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRMergePayload
  ) => {
    mergeError.value = null;

    try {
      await apiFetch<PRMergeResponse>(`/api/pulls/${owner}/${repo}/${pullNumber}/merge`, {
        method: 'POST',
        body: payload,
      });
      await fetchMergeStatus(owner, repo, pullNumber);
      return true;
    } catch (fetchError: unknown) {
      mergeError.value = getFetchErrorMessage(fetchError, 'Failed to merge pull request');
      return false;
    }
  };

  const mutateHeadBranch = async (
    owner: string,
    repo: string,
    pullNumber: number,
    method: 'DELETE' | 'POST',
    fallbackError: string
  ) => {
    branchActionError.value = null;

    try {
      const response = await apiFetch<PRHeadBranchMutationResponse>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/head-branch`,
        { method }
      );
      const nextStatus = await fetchMergeStatus(owner, repo, pullNumber);
      if (!nextStatus && response?.head_branch && mergeStatus.value) {
        mergeStatus.value = {
          ...mergeStatus.value,
          headBranch: response.head_branch,
        };
      }
      return true;
    } catch (fetchError: unknown) {
      branchActionError.value = getFetchErrorMessage(fetchError, fallbackError);
      return false;
    }
  };

  const deleteHeadBranch = (owner: string, repo: string, pullNumber: number) =>
    mutateHeadBranch(
      owner,
      repo,
      pullNumber,
      'DELETE',
      'Failed to delete pull request head branch'
    );

  const restoreHeadBranch = (owner: string, repo: string, pullNumber: number) =>
    mutateHeadBranch(owner, repo, pullNumber, 'POST', 'Failed to restore pull request head branch');

  return {
    mergeStatus,
    loading,
    error,
    mergeError,
    branchActionError,
    setMergeStatus,
    fetchMergeStatus,
    mergePullRequest,
    deleteHeadBranch,
    restoreHeadBranch,
  };
}
