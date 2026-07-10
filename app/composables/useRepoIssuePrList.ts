import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type { DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

export type RepoIssuePrKind = 'issues' | 'pulls';

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

const buildSearchQuery = (owner: string, repo: string, kind: RepoIssuePrKind) => {
  const typeQualifier = kind === 'pulls' ? 'is:pr' : 'is:issue';
  return [
    typeQualifier,
    'is:open',
    'archived:false',
    `repo:${owner}/${repo}`,
    'sort:updated-desc',
  ].join(' ');
};

export function useRepoIssuePrList(
  owner: Ref<string> | (() => string),
  repo: Ref<string> | (() => string),
  kind: Ref<RepoIssuePrKind> | (() => RepoIssuePrKind)
) {
  const apiFetch = useGitPulseApiFetch();

  const resolveOwner = () => (typeof owner === 'function' ? owner() : owner.value);
  const resolveRepo = () => (typeof repo === 'function' ? repo() : repo.value);
  const resolveKind = () => (typeof kind === 'function' ? kind() : kind.value);

  const items = shallowRef<DashboardIssuePrEntity[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<RepoIssuePrPagination>(createEmptyPagination());
  let requestId = 0;

  const hasItems = computed(() => items.value.length > 0);

  const fetchPage = async (page = 1) => {
    const currentOwner = resolveOwner().trim();
    const currentRepo = resolveRepo().trim();
    const currentKind = resolveKind();

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
      q: buildSearchQuery(currentOwner, currentRepo, currentKind),
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
    () => [resolveOwner(), resolveRepo(), resolveKind()] as const,
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
    fetchPage,
    goToPage,
    refresh,
  };
}
