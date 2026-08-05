import type {
  RepoContributorListPaginationMeta,
  RepoContributorListResponse,
  RepoContributorSummary,
} from '#shared/types/repos';

const DEFAULT_PAGINATION: RepoContributorListPaginationMeta = {
  page: 1,
  perPage: 30,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
};

/** Sidebar preview shows a short avatar row, matching GitHub's incomplete list. */
export const REPO_CONTRIBUTORS_PREVIEW_COUNT = 14;

/**
 * Fetch repository contributors (list endpoint). Used by the repo sidebar
 * preview and as a fallback when stats are still computing.
 */
export function useRepoContributors() {
  const apiFetch = useGitPulseApiFetch();

  const items = shallowRef<RepoContributorSummary[]>([]);
  const pagination = shallowRef<RepoContributorListPaginationMeta>({ ...DEFAULT_PAGINATION });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);

  const fetchPage = async (
    owner: string,
    repo: string,
    options: { page?: number; perPage?: number } = {}
  ) => {
    if (!owner || !repo) return;

    const page = options.page ?? 1;
    const perPage = options.perPage ?? DEFAULT_PAGINATION.perPage;
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });

      const data = await apiFetch<RepoContributorListResponse>(
        `/api/repos/${owner}/${repo}/contributors?${params.toString()}`
      );
      if (requestId !== activeRequestId.value) return;

      items.value = data.items;
      pagination.value = data.pagination;
    } catch (err) {
      if (requestId !== activeRequestId.value) return;
      items.value = [];
      pagination.value = { ...DEFAULT_PAGINATION, page, perPage };
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const reset = () => {
    activeRequestId.value += 1;
    items.value = [];
    pagination.value = { ...DEFAULT_PAGINATION };
    loading.value = false;
    error.value = null;
  };

  return {
    items,
    pagination,
    loading,
    error,
    fetchPage,
    reset,
  };
}
