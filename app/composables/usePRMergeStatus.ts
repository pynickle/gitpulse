import { onScopeDispose, shallowRef } from 'vue';

import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
import type { PullRequestHeadBranchState, StackMergeOutcome } from '#shared/types/pulls';

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

/** `stalled` is client-only: the poll gave up while the merge may still be running. */
export type PRStackMergeOutcome = StackMergeOutcome | 'stalled';

export interface PRStackMergeResult {
  outcome: PRStackMergeOutcome;
  id?: string;
  message?: string;
}

const STACK_MERGE_POLL_DELAYS_MS = [2000, 2000, 2000, 3000, 3000, 4000];
const STACK_MERGE_MAX_POLLS = 25;
const STACK_MERGE_MAX_CONSECUTIVE_ERRORS = 2;

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
  // Bumped when the composable moves to another pull request or is disposed, so an
  // await that started before then cannot write over what replaced it.
  let mutationGeneration = 0;
  let stackMergeRequestId = 0;
  let stackMergePollTimer: ReturnType<typeof setTimeout> | null = null;
  let finishStackMergePoll: ((current: boolean) => void) | null = null;

  const stopStackMergePoll = () => {
    if (stackMergePollTimer !== null) {
      clearTimeout(stackMergePollTimer);
      stackMergePollTimer = null;
    }
    const finish = finishStackMergePoll;
    finishStackMergePoll = null;
    finish?.(false);
  };

  // Disposal retires this caller so a Stack Merge does not keep polling.
  onScopeDispose(() => {
    mutationGeneration += 1;
    stackMergeRequestId += 1;
    stopStackMergePoll();
  });

  /**
   * Adopts a status the caller already holds. Distinct from `resetMergeStatus`:
   * this one is an answer, not a request to forget the last one.
   */
  const setMergeStatus = (status: PRMergeStatus | null) => {
    statusRequestId += 1;
    mergeStatus.value = status;
    loading.value = false;
    error.value = null;
    branchUpdateError.value = null;
  };

  /**
   * Forgets the status before a reread. Only a different pull request needs this,
   * because the old box's data must not sit under the new one's heading.
   */
  const resetMergeStatus = () => {
    mutationGeneration += 1;
    stackMergeRequestId += 1;
    stopStackMergePoll();
    statusRequestId += 1;
    mergeStatus.value = null;
    loading.value = false;
    error.value = null;
    mergeError.value = null;
    branchActionError.value = null;
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
        // A reread that fails keeps the status already on screen: throwing it away
        // would blank the whole Merge Box for a request the reader did not make.
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

  const waitForStackMergePoll = (requestId: number, delayMs: number) =>
    new Promise<boolean>((resolve) => {
      finishStackMergePoll = resolve;
      stackMergePollTimer = setTimeout(() => {
        stackMergePollTimer = null;
        finishStackMergePoll = null;
        resolve(requestId === stackMergeRequestId);
      }, delayMs);
    });

  const failedStackMerge = (message?: string): PRStackMergeResult => ({
    outcome: 'failed',
    ...(message ? { message } : {}),
  });

  /**
   * Follows an in-progress Stack Merge until it settles. A poll that cannot settle
   * (too many reads, or repeated read failures) answers `stalled`, not `failed`:
   * the merge may still be running, so the caller can resume it.
   */
  const pollStackMergeStatus = async (
    owner: string,
    repo: string,
    pullNumber: number,
    initialResult: PRStackMergeResult,
    requestId: number,
    gen: number
  ): Promise<PRStackMergeResult | null> => {
    const isCurrentRequest = () => requestId === stackMergeRequestId && gen === mutationGeneration;
    let result = initialResult;
    let activeId = initialResult.id;
    let polls = 0;
    let consecutiveErrors = 0;

    while (isCurrentRequest() && result.outcome === 'in-progress') {
      if (result.id) activeId = result.id;
      if (!activeId) return failedStackMerge(result.message);
      if (polls >= STACK_MERGE_MAX_POLLS) {
        return { outcome: 'stalled', id: activeId, message: result.message };
      }

      const delayMs =
        STACK_MERGE_POLL_DELAYS_MS[Math.min(polls, STACK_MERGE_POLL_DELAYS_MS.length - 1)]!;
      polls += 1;
      const current = await waitForStackMergePoll(requestId, delayMs);
      if (!current || !isCurrentRequest()) return null;

      try {
        result = await apiFetch<PRStackMergeResult>(
          `/api/pulls/${owner}/${repo}/${pullNumber}/stack-merge/${encodeURIComponent(activeId)}`
        );
        consecutiveErrors = 0;
      } catch (fetchError: unknown) {
        if (!isCurrentRequest()) return null;
        consecutiveErrors += 1;
        if (
          consecutiveErrors <= STACK_MERGE_MAX_CONSECUTIVE_ERRORS &&
          polls < STACK_MERGE_MAX_POLLS
        ) {
          continue;
        }
        return { outcome: 'stalled', id: activeId, message: getFetchErrorMessage(fetchError, '') };
      }
    }

    if (!isCurrentRequest()) return null;

    if (result.outcome === 'landed') {
      await fetchMergeStatus(owner, repo, pullNumber);
    }

    return isCurrentRequest() ? result : null;
  };

  const mergeStack = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRMergePayload
  ): Promise<PRStackMergeResult | null> => {
    const requestId = stackMergeRequestId + 1;
    stackMergeRequestId = requestId;
    stopStackMergePoll();
    mergeError.value = null;
    const gen = mutationGeneration;
    const isCurrentRequest = () => requestId === stackMergeRequestId && gen === mutationGeneration;

    try {
      const initial = await apiFetch<PRStackMergeResult>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/stack-merge`,
        { method: 'POST', body: payload }
      );
      if (!isCurrentRequest()) return null;
      return await pollStackMergeStatus(owner, repo, pullNumber, initial, requestId, gen);
    } catch (fetchError: unknown) {
      if (!isCurrentRequest()) return null;
      mergeError.value = getFetchErrorMessage(fetchError, 'Failed to merge stack');
      return failedStackMerge();
    }
  };

  /** Picks a stalled Stack Merge back up by its id. */
  const resumeStackMergePoll = async (
    owner: string,
    repo: string,
    pullNumber: number,
    id: string
  ): Promise<PRStackMergeResult | null> => {
    const requestId = stackMergeRequestId + 1;
    stackMergeRequestId = requestId;
    stopStackMergePoll();
    mergeError.value = null;
    return pollStackMergeStatus(
      owner,
      repo,
      pullNumber,
      { outcome: 'in-progress', id },
      requestId,
      mutationGeneration
    );
  };

  const mergePullRequest = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRMergePayload
  ) => {
    const gen = mutationGeneration;
    mergeError.value = null;

    try {
      await apiFetch<PRMergeResponse>(`/api/pulls/${owner}/${repo}/${pullNumber}/merge`, {
        method: 'POST',
        body: payload,
      });
      if (gen !== mutationGeneration) return false;
      await fetchMergeStatus(owner, repo, pullNumber);
      return gen === mutationGeneration;
    } catch (fetchError: unknown) {
      if (gen !== mutationGeneration) return false;
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
    const gen = mutationGeneration;
    branchActionError.value = null;

    try {
      const response = await apiFetch<PRHeadBranchMutationResponse>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/head-branch`,
        { method }
      );
      if (gen !== mutationGeneration) return false;
      const nextStatus = await fetchMergeStatus(owner, repo, pullNumber);
      if (gen === mutationGeneration && !nextStatus && response?.head_branch && mergeStatus.value) {
        mergeStatus.value = {
          ...mergeStatus.value,
          headBranch: response.head_branch,
        };
      }
      return gen === mutationGeneration;
    } catch (fetchError: unknown) {
      if (gen !== mutationGeneration) return false;
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
    const gen = mutationGeneration;
    branchUpdateError.value = null;

    try {
      await apiFetch(`/api/pulls/${owner}/${repo}/${pullNumber}/update-branch`, {
        method: 'POST',
        body: payload,
      });
      if (gen !== mutationGeneration) return false;
      await fetchMergeStatus(owner, repo, pullNumber);
      return gen === mutationGeneration;
    } catch (fetchError: unknown) {
      if (gen !== mutationGeneration) return false;
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
    resetMergeStatus,
    fetchMergeStatus,
    fetchCommitDefaults,
    clearCommitDefaults,
    mergePullRequest,
    mergeStack,
    resumeStackMergePoll,
    updatePullRequestBranch,
    deleteHeadBranch,
    restoreHeadBranch,
  };
}
