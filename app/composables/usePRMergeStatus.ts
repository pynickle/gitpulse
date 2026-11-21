import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
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
  /** GitHub's own Check Rollup. Null when GitHub reports none. */
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
  allowedMergeMethods?: PRMergeMethod[];
}

export type PRBranchUpdateMethod = 'merge' | 'rebase';

export interface PRBranchUpdatePayload {
  method: PRBranchUpdateMethod;
  expectedHeadOid: string;
}

/** The commit title and message GitHub would record for each merge method. */
export interface PRMergeCommitDefaults {
  merge: { title: string; message: string };
  squash: { title: string; message: string };
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

export type PRStackMergeOutcome = 'in-progress' | 'landed' | 'queued' | 'failed';

export interface PRStackMergeResponse {
  outcome: PRStackMergeOutcome;
  id?: string;
  message?: string;
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

const isHeadOidMismatch = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return false;
  }

  const body = error.data;
  if (!body || typeof body !== 'object') {
    return false;
  }

  if ('code' in body && body.code === 'head_oid_mismatch') {
    return true;
  }

  return (
    'data' in body &&
    !!body.data &&
    typeof body.data === 'object' &&
    'code' in body.data &&
    body.data.code === 'head_oid_mismatch'
  );
};

export function usePRMergeStatus() {
  const apiFetch = useGitPulseApiFetch();
  const mergeStatus = shallowRef<PRMergeStatus | null>(null);
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const mergeError = shallowRef<string | null>(null);
  const branchActionError = shallowRef<string | null>(null);
  const branchUpdateError = shallowRef<string | null>(null);
  const commitDefaults = shallowRef<PRMergeCommitDefaults | null>(null);
  let statusRequestId = 0;
  let commitDefaultsRequestId = 0;

  const setMergeStatus = (status: PRMergeStatus | null) => {
    statusRequestId += 1;
    mergeStatus.value = status;
    loading.value = false;
    error.value = null;
    branchUpdateError.value = null;
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

  /**
   * The default commit title and message for both merge methods. A failed read
   * clears them: the form then starts empty, and an untouched empty field is
   * never sent, so GitHub still forms its own message.
   */
  const fetchCommitDefaults = async (owner: string, repo: string, pullNumber: number) => {
    const requestId = commitDefaultsRequestId + 1;
    commitDefaultsRequestId = requestId;

    try {
      const defaults = await apiFetch<PRMergeCommitDefaults>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/commit-defaults`,
        { method: 'GET' }
      );
      if (requestId === commitDefaultsRequestId) {
        commitDefaults.value = defaults;
      }
    } catch {
      if (requestId === commitDefaultsRequestId) {
        commitDefaults.value = null;
      }
    }
  };

  const clearCommitDefaults = () => {
    commitDefaultsRequestId += 1;
    commitDefaults.value = null;
  };

  const STACK_MERGE_POLL_ATTEMPTS = 15;
  const STACK_MERGE_POLL_DELAY_MS = 2000;
  let stackMergeRequestId = 0;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const mergeStack = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRMergePayload
  ) => {
    const requestId = stackMergeRequestId + 1;
    stackMergeRequestId = requestId;
    mergeError.value = null;

    try {
      let result = await apiFetch<PRStackMergeResponse>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/stack-merge`,
        { method: 'POST', body: payload }
      );

      for (
        let attempt = 0;
        requestId === stackMergeRequestId &&
        result.outcome === 'in-progress' &&
        result.id &&
        attempt < STACK_MERGE_POLL_ATTEMPTS;
        attempt += 1
      ) {
        await wait(STACK_MERGE_POLL_DELAY_MS);
        const id = result.id;
        if (requestId !== stackMergeRequestId || !id) return result;
        result = await apiFetch<PRStackMergeResponse>(
          `/api/pulls/${owner}/${repo}/${pullNumber}/stack-merge/${encodeURIComponent(id)}`
        );
      }

      if (result.outcome === 'landed' && requestId === stackMergeRequestId) {
        await fetchMergeStatus(owner, repo, pullNumber);
      }

      return requestId === stackMergeRequestId ? result : null;
    } catch (fetchError: unknown) {
      if (requestId === stackMergeRequestId) {
        mergeError.value = getFetchErrorMessage(fetchError, 'Failed to merge stack');
      }
      return null;
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

  const updatePullRequestBranch = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRBranchUpdatePayload
  ) => {
    branchUpdateError.value = null;

    try {
      await apiFetch(`/api/pulls/${owner}/${repo}/${pullNumber}/update-branch`, {
        method: 'POST',
        body: payload,
      });
      await fetchMergeStatus(owner, repo, pullNumber);
      return true;
    } catch (fetchError: unknown) {
      branchUpdateError.value = getFetchErrorMessage(
        fetchError,
        'Failed to update pull request branch'
      );
      if (isHeadOidMismatch(fetchError)) {
        await fetchMergeStatus(owner, repo, pullNumber);
      }
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
    branchUpdateError,
    commitDefaults,
    setMergeStatus,
    fetchMergeStatus,
    fetchCommitDefaults,
    clearCommitDefaults,
    mergePullRequest,
    mergeStack,
    updatePullRequestBranch,
    deleteHeadBranch,
    restoreHeadBranch,
  };
}
