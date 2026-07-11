import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type { DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import {
  buildRepoIssuePrSearchQuery,
  normalizeRepoIssuePrState,
  type RepoIssuePrKind,
  type RepoIssuePrState,
} from '~/utils/repoIssuePrSearchQuery';
import createSessionLruCache from '~/utils/sessionLruCache';

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

interface RepoIssuePrPageCacheEntry {
  items: DashboardIssuePrEntity[];
  pagination: RepoIssuePrPagination;
}

const DEFAULT_PER_PAGE = 20;
/** Per list query (owner/repo/kind/state): keep recent pages for instant back-nav. */
const MAX_CACHED_PAGES = 12;

const createEmptyPagination = (page = 1): RepoIssuePrPagination => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: 1,
});

const buildListQueryKey = (
  owner: string,
  repo: string,
  kind: RepoIssuePrKind,
  state: RepoIssuePrState
) => `${owner}/${repo}:${kind}:${state}`;

const buildPageCacheKey = (queryKey: string, page: number) => `${queryKey}:p${page}`;

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

  // Lives for the lifetime of this composable instance (repo detail page session).
  const pageCache = createSessionLruCache<RepoIssuePrPageCacheEntry>(MAX_CACHED_PAGES);

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

  const applyPage = (entry: RepoIssuePrPageCacheEntry) => {
    items.value = entry.items;
    pagination.value = entry.pagination;
    error.value = '';
    loading.value = false;
  };

  const fetchPage = async (page = 1, options: { force?: boolean } = {}) => {
    const currentOwner = resolveOwner().trim();
    const currentRepo = resolveRepo().trim();
    const currentKind = resolveKind();
    const currentState = normalizeRepoIssuePrState(currentKind, resolveState());

    if (!currentOwner || !currentRepo) {
      items.value = [];
      pagination.value = createEmptyPagination();
      error.value = '';
      loading.value = false;
      return;
    }

    const queryKey = buildListQueryKey(currentOwner, currentRepo, currentKind, currentState);
    const cacheKey = buildPageCacheKey(queryKey, page);

    if (!options.force) {
      const cached = pageCache.get(cacheKey);
      if (cached) {
        // Invalidate any in-flight network response for a different page.
        requestId += 1;
        applyPage(cached);
        return;
      }
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

      const nextPagination: RepoIssuePrPagination = {
        page: data.pagination?.page ?? page,
        perPage: data.pagination?.perPage ?? DEFAULT_PER_PAGE,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
        totalCount:
          data.pagination?.totalCount ??
          (typeof data.total_count === 'number' ? data.total_count : null),
        totalPages: data.pagination?.totalPages ?? 1,
      };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const entry: RepoIssuePrPageCacheEntry = {
        items: nextItems,
        pagination: nextPagination,
      };

      pageCache.set(buildPageCacheKey(queryKey, nextPagination.page), entry);
      applyPage(entry);
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
    await fetchPage(pagination.value.page || 1, { force: true });
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
        // Files panel (or unscoped) — keep last snapshot + session cache; no fetch.
        loading.value = false;
        return;
      }

      // Kind/state switches and panel return — restore from session page cache when possible.
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
