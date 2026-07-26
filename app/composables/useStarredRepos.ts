export interface StarredRepo {
  id: number;
  name: string;
  full_name?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  private?: boolean;
  owner?: {
    login?: string;
  };
}

export interface StarredPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface StarredReposResponse {
  items: StarredRepo[];
  pagination: StarredPaginationMeta;
}

const DEFAULT_PAGINATION: StarredPaginationMeta = {
  page: 1,
  perPage: 20,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
};

export function useStarredRepos() {
  const apiFetch = useGitPulseApiFetch();

  const items = ref<StarredRepo[]>([]);
  const pagination = ref<StarredPaginationMeta>({ ...DEFAULT_PAGINATION });
  const loading = ref(true);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);

  const fetchPage = async (page = 1, user: string | null = null) => {
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams({ page: String(page) });
      if (user) {
        params.set('user', user);
      }

      const data = await apiFetch<StarredReposResponse>(`/api/starred?${params.toString()}`);
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
