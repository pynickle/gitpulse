import {
  STARRED_DEFAULT_PER_PAGE,
  type StarredDirection,
  type StarredSort,
} from '#shared/utils/starred';
import withPendingPaginationPage from '~/utils/withPendingPaginationPage';

export type { StarredDirection, StarredSort };

export interface StarredRepo {
  id: number;
  node_id?: string;
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

export interface FetchStarredPageOptions {
  page?: number;
  user?: string | null;
  sort?: StarredSort;
  direction?: StarredDirection;
}

interface StarredReposResponse {
  items: StarredRepo[];
  pagination: StarredPaginationMeta;
  sort?: StarredSort;
  direction?: StarredDirection;
}

const DEFAULT_PAGINATION: StarredPaginationMeta = {
  page: 1,
  perPage: STARRED_DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
};

export function useStarredRepos() {
  const apiFetch = useGitPulseApiFetch();

  const items = ref<StarredRepo[]>([]);
  const pagination = ref<StarredPaginationMeta>({ ...DEFAULT_PAGINATION });
  const sort = ref<StarredSort>('created');
  const direction = ref<StarredDirection>('desc');
  const loading = ref(true);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);

  const fetchPage = async (options: FetchStarredPageOptions = {}) => {
    const page = options.page ?? 1;
    const nextSort = options.sort ?? sort.value;
    const nextDirection = options.direction ?? direction.value;
    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value = withPendingPaginationPage(pagination.value, page);

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(STARRED_DEFAULT_PER_PAGE),
        sort: nextSort,
        direction: nextDirection,
      });
      if (options.user) {
        params.set('user', options.user);
      }

      const data = await apiFetch<StarredReposResponse>(`/api/starred?${params.toString()}`);
      if (requestId !== activeRequestId.value) return;

      items.value = data.items;
      pagination.value = data.pagination;
      sort.value = data.sort ?? nextSort;
      direction.value = data.direction ?? nextDirection;
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
    sort,
    direction,
    loading,
    error,
    fetchPage,
  };
}
