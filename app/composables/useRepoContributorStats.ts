import type {
  RepoContributorStatsItem,
  RepoContributorStatsResponse,
  RepoContributorStatsStatus,
} from '#shared/types/repos';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 8;

/**
 * Fetch contributor commit-activity stats with client-side polling for
 * GitHub's asynchronous 202 ("computing") responses.
 */
export function useRepoContributorStats() {
  const apiFetch = useGitPulseApiFetch();

  const items = shallowRef<RepoContributorStatsItem[]>([]);
  const status = shallowRef<RepoContributorStatsStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPoll = () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const reset = () => {
    clearPoll();
    activeRequestId.value += 1;
    items.value = [];
    status.value = null;
    loading.value = false;
    error.value = null;
  };

  const fetchOnce = async (
    owner: string,
    repo: string,
    requestId: number
  ): Promise<RepoContributorStatsResponse | null> => {
    const data = await apiFetch<RepoContributorStatsResponse>(
      `/api/repos/${owner}/${repo}/stats/contributors`
    );
    if (requestId !== activeRequestId.value) return null;
    return data;
  };

  const applyResponse = (data: RepoContributorStatsResponse) => {
    status.value = data.status;
    items.value = data.items;
  };

  const fetchStats = async (owner: string, repo: string) => {
    if (!owner || !repo) return;

    clearPoll();
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    items.value = [];
    status.value = null;

    try {
      let attempt = 0;
      let data = await fetchOnce(owner, repo, requestId);
      if (!data || requestId !== activeRequestId.value) return;

      while (data.status === 'computing' && attempt < MAX_POLL_ATTEMPTS) {
        status.value = 'computing';
        attempt += 1;
        await new Promise<void>((resolve) => {
          pollTimer = setTimeout(() => {
            pollTimer = null;
            resolve();
          }, POLL_INTERVAL_MS);
        });
        if (requestId !== activeRequestId.value) return;

        data = await fetchOnce(owner, repo, requestId);
        if (!data || requestId !== activeRequestId.value) return;
      }

      applyResponse(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;
      items.value = [];
      status.value = null;
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  onScopeDispose(() => {
    clearPoll();
  });

  return {
    items,
    status,
    loading,
    error,
    fetchStats,
    reset,
  };
}
