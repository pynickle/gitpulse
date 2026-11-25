import { ref, shallowRef } from 'vue';

import type { PullRequestArchiveAction } from '#shared/types/pulls';

import { getFetchErrorMessage } from '../utils/getFetchErrorMessage';

export interface UsePullRequestArchiveOptions {
  owner: () => string;
  repo: () => string;
  pullNumber: () => number;
}

/**
 * Whether one pull request is archived, and the action that flips it.
 *
 * GitHub carries no archived flag on a pull request node, so the state is read
 * from the repository-scoped `is:archived` search instead. That index lags the
 * mutation by a few seconds, so the action result — not a follow-up read —
 * decides what the reader sees until the next full load.
 */
export function usePullRequestArchive({ owner, repo, pullNumber }: UsePullRequestArchiveOptions) {
  const apiFetch = useGitPulseApiFetch();

  const isArchived = ref(false);
  const submitting = ref(false);
  const error = shallowRef('');

  const load = async () => {
    const repoOwner = owner();
    const repoName = repo();
    const number = pullNumber();

    if (!repoOwner || !repoName || !number) {
      isArchived.value = false;
      return;
    }

    try {
      const archivedNumbers = await apiFetch<number[]>(
        `/api/repos/${repoOwner}/${repoName}/archived-pulls`
      );
      isArchived.value = archivedNumbers.includes(number);
    } catch (err: unknown) {
      // A failed read must not claim the pull request is public: archiving then
      // fails on GitHub, which is a worse answer than showing the reader nothing.
      console.error('Failed to read the pull request archive state:', err);
    }
  };

  const setArchived = async (action: PullRequestArchiveAction, fallbackMessage: string) => {
    const repoOwner = owner();
    const repoName = repo();
    const number = pullNumber();

    if (!repoOwner || !repoName || !number || submitting.value) {
      return false;
    }

    submitting.value = true;
    error.value = '';

    try {
      const result = await apiFetch<{ archived: boolean }>(
        `/api/pulls/${repoOwner}/${repoName}/${number}/archive`,
        { method: 'POST', body: { action } }
      );
      isArchived.value = Boolean(result?.archived);
      return true;
    } catch (err: unknown) {
      console.error('Failed to change the pull request archive state:', err);
      error.value = getFetchErrorMessage(err, fallbackMessage);
      return false;
    } finally {
      submitting.value = false;
    }
  };

  return {
    isArchived,
    submitting,
    error,
    load,
    setArchived,
  };
}
