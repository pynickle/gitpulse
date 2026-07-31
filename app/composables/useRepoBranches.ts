import type { RepoBranchDetail, RepoBranchesDetailResponse } from '#shared/types/repos';

export function useRepoBranches() {
  const apiFetch = useGitPulseApiFetch();

  const items = ref<RepoBranchDetail[]>([]);
  const defaultBranch = ref('');
  const loading = ref(true);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);

  const fetchBranches = async (owner: string, repo: string) => {
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<RepoBranchesDetailResponse>(
        `/api/repos/${owner}/${repo}/branches/details`
      );

      if (requestId !== activeRequestId.value) return;

      items.value = data.items;
      defaultBranch.value = data.defaultBranch || '';
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      items.value = [];
      defaultBranch.value = '';
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  return {
    items,
    defaultBranch,
    loading,
    error,
    fetchBranches,
  };
}
