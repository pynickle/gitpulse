import { computed, ref, shallowRef, watch } from 'vue';

import type { StarredPaginationMeta, StarredRepo } from '~/composables/useStarredRepos';
import {
  REPOSITORY_SEARCH_DEBOUNCE_MS,
  REPOSITORY_SEARCH_DEFAULT_PER_PAGE,
  buildRepositorySearchRequest,
  normalizeRepositorySearchQuery,
} from '~/utils/repositorySearchQuery';
import withPendingPaginationPage from '~/utils/withPendingPaginationPage';

interface RepositorySearchResponse {
  items?: StarredRepo[];
  pagination?: StarredPaginationMeta;
}

const DEFAULT_PAGINATION: StarredPaginationMeta = {
  page: 1,
  perPage: REPOSITORY_SEARCH_DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
};

export function useRepositorySearch() {
  const apiFetch = useGitPulseApiFetch();

  const query = shallowRef('');
  const items = ref<StarredRepo[]>([]);
  const pagination = ref<StarredPaginationMeta>({ ...DEFAULT_PAGINATION });
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const activeRequestId = shallowRef(0);

  const hasQuery = computed(() => normalizeRepositorySearchQuery(query.value) !== null);

  const resetIdle = () => {
    activeRequestId.value += 1;
    items.value = [];
    pagination.value = { ...DEFAULT_PAGINATION };
    loading.value = false;
    error.value = null;
  };

  const fetchPage = async (options: { page?: number } = {}) => {
    const request = buildRepositorySearchRequest({
      query: query.value,
      page: options.page ?? pagination.value.page,
    });
    if (!request) {
      resetIdle();
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value = withPendingPaginationPage(pagination.value, request.page);

    try {
      const data = await apiFetch<RepositorySearchResponse>(request.path);
      if (requestId !== activeRequestId.value) return;

      items.value = Array.isArray(data.items) ? data.items : [];
      pagination.value = data.pagination ?? {
        page: request.page,
        perPage: request.perPage,
        hasPrev: request.page > 1,
        hasNext: false,
        totalCount: null,
        totalPages: 1,
      };
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  watch(query, (value, _previous, onCleanup) => {
    if (!normalizeRepositorySearchQuery(value)) {
      resetIdle();
      return;
    }

    activeRequestId.value += 1;
    const timer = setTimeout(() => {
      void fetchPage({ page: 1 });
    }, REPOSITORY_SEARCH_DEBOUNCE_MS);

    onCleanup(() => clearTimeout(timer));
  });

  return {
    query,
    items,
    pagination,
    loading,
    error,
    hasQuery,
    fetchPage,
  };
}
