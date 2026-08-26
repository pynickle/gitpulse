import type { ReleaseListItem } from '#shared/types/releases';
import withPendingPaginationPage from '~/utils/withPendingPaginationPage';

export interface ReleasePaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface RepoReleasesResponse {
  items: ReleaseListItem[];
  pagination: ReleasePaginationMeta;
}

const DEFAULT_PAGINATION: ReleasePaginationMeta = {
  page: 1,
  perPage: 20,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
};

export function useRepoReleases() {
  const apiFetch = useGitPulseApiFetch();

  const items = ref<ReleaseListItem[]>([]);
  const pagination = ref<ReleasePaginationMeta>({ ...DEFAULT_PAGINATION });
  const loading = ref(true);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);

  const fetchPage = async (owner: string, repo: string, page = 1) => {
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value = withPendingPaginationPage(pagination.value, page);

    try {
      const params = new URLSearchParams({ page: String(page) });

      const data = await apiFetch<RepoReleasesResponse>(
        `/api/releases/${owner}/${repo}?${params.toString()}`
      );
      if (requestId !== activeRequestId.value) return;

      items.value = data.items;
      pagination.value = data.pagination;
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  return {
    items,
    pagination,
    loading,
    error,
    fetchPage,
  };
}
