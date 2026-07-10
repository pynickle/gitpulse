import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type { DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import {
  buildRepoIssuePrSearchQuery,
  normalizeRepoIssuePrState,
  type RepoIssuePrKind,
  type RepoIssuePrState,
} from '~/utils/repoIssuePrSearchQuery';

export interface RepoIssuePrPagination {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface SearchListResponse {
  items?: DashboardIssuePrEntity[];
  total_count?: number;
  pagination?: Partial<RepoIssuePrPagination>;
}

const DEFAULT_PER_PAGE = 20;

const createEmptyPagination = (page = 1): RepoIssuePrPagination => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: 1,
});

export function useRepoIssuePrList(
  owner: Ref<string> | (() => string),
  repo: Ref<string> | (() => string),
  kind: Ref<RepoIssuePrKind> | (() => RepoIssuePrKind),
  state: Ref<RepoIssuePrState> | (() => RepoIssuePrState) = () => 'open'
) {
  const apiFetch = useGitPulseApiFetch();

  const resolveOwner = () => (typeof owner === 'function' ? owner() : owner.value);
  const resolveRepo = () => (typeof repo === 'function' ? repo() : repo.value);
  const resolveKind = () => (typeof kind === 'function' ? kind() : kind.value);
  const resolveState = () => (typeof state === 'function' ? state() : state.value);

  const items = shallowRef<DashboardIssuePrEntity[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<RepoIssuePrPagination>(createEmptyPagination());
  let requestId = 0;

  const hasItems = computed(() => items.value.length > 0);

  const showPagination = computed(() => {
    return (
      !loading.value &&
      !error.value &&
      (pagination.value.hasPrev ||
        pagination.value.hasNext ||
        (pagination.value.totalPages ?? 1) > 1)
    );
  });

  const fetchPage = async (page = 1) => {
    const currentOwner = resolveOwner().trim();
    const currentRepo = resolveRepo().trim();
    const currentKind = resolveKind();
    const currentState = normalizeRepoIssuePrState(currentKind, resolveState());

    if (!currentOwner || !currentRepo) {
      items.value = [];
      pagination.value = createEmptyPagination();
      error.value = '';
      return;
    }

    const nextRequestId = requestId + 1;
    requestId = nextRequestId;
    loading.value = true;
    error.value = '';

    const searchParams = new URLSearchParams({
      q: buildRepoIssuePrSearchQuery(currentOwner, currentRepo, currentKind, currentState),
      page: String(page),
      per_page: String(DEFAULT_PER_PAGE),
    });

    try {
      const data = await apiFetch<SearchListResponse>(
        `/api/search/issues?${searchParams.toString()}`
      );

      if (nextRequestId !== requestId) return;

      items.value = Array.isArray(data.items) ? data.items : [];
      pagination.value = {
        page: data.pagination?.page ?? page,
        perPage: data.pagination?.perPage ?? DEFAULT_PER_PAGE,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
        totalCount:
          data.pagination?.totalCount ??
          (typeof data.total_count === 'number' ? data.total_count : null),
        totalPages: data.pagination?.totalPages ?? 1,
      };
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      pagination.value = createEmptyPagination(page);
      error.value = getFetchErrorMessage(fetchError, 'Failed to load repository items.');
    } finally {
      if (nextRequestId === requestId) {
        loading.value = false;
      }
    }
  };

  const goToPage = async (page: number) => {
    if (page < 1 || page === pagination.value.page || loading.value) return;
    await fetchPage(page);
  };

  const refresh = async () => {
    await fetchPage(pagination.value.page || 1);
  };

  watch(
    () =>
      [
        resolveOwner(),
        resolveRepo(),
        resolveKind(),
        normalizeRepoIssuePrState(resolveKind(), resolveState()),
      ] as const,
    ([nextOwner, nextRepo]) => {
      if (!nextOwner || !nextRepo) {
        items.value = [];
        pagination.value = createEmptyPagination();
        error.value = '';
        return;
      }

      void fetchPage(1);
    },
    { immediate: true }
  );

  return {
    items,
    loading,
    error,
    pagination,
    hasItems,
    showPagination,
    fetchPage,
    goToPage,
    refresh,
  };
}
