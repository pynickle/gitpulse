import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type {
  RepoCommitListItemPayload,
  RepoCommitListPaginationMeta,
  RepoCommitListResponse,
} from '#shared/types/repos';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import createSessionLruCache from '~/utils/sessionLruCache';

const DEFAULT_PER_PAGE = 20;
/** Per list query (owner/repo/ref): keep recent pages for instant back-nav. */
const MAX_CACHED_PAGES = 12;

interface RepoCommitPageCacheEntry {
  items: RepoCommitListItemPayload[];
  pagination: RepoCommitListPaginationMeta;
}

const createEmptyPagination = (page = 1): RepoCommitListPaginationMeta => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
});

const buildListQueryKey = (owner: string, repo: string, ref: string) => `${owner}/${repo}@${ref}`;

const buildPageCacheKey = (queryKey: string, page: number) => `${queryKey}:p${page}`;

/**
 * Paginated repository commit list for the Commits panel.
 * Mirrors {@link useRepoIssuePrList}: session page cache, request-id guarding,
 * and no traffic while owner/repo is empty (panel not active).
 */
export function useRepoCommitList(
  owner: Ref<string> | (() => string),
  repo: Ref<string> | (() => string),
  refName: Ref<string> | (() => string) = () => ''
) {
  const apiFetch = useGitPulseApiFetch();

  const resolveOwner = () => (typeof owner === 'function' ? owner() : owner.value);
  const resolveRepo = () => (typeof repo === 'function' ? repo() : repo.value);
  const resolveRef = () => (typeof refName === 'function' ? refName() : refName.value);

  const items = shallowRef<RepoCommitListItemPayload[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<RepoCommitListPaginationMeta>(createEmptyPagination());
  let requestId = 0;

  // Lives for the lifetime of this composable instance (repo detail page session).
  const pageCache = createSessionLruCache<RepoCommitPageCacheEntry>(MAX_CACHED_PAGES);

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

  const applyPage = (entry: RepoCommitPageCacheEntry) => {
    items.value = entry.items;
    pagination.value = entry.pagination;
    error.value = '';
    loading.value = false;
  };

  const fetchPage = async (page = 1, options: { force?: boolean } = {}) => {
    const currentOwner = resolveOwner().trim();
    const currentRepo = resolveRepo().trim();
    const currentRef = resolveRef().trim();

    if (!currentOwner || !currentRepo) {
      items.value = [];
      pagination.value = createEmptyPagination();
      error.value = '';
      loading.value = false;
      return;
    }

    const queryKey = buildListQueryKey(currentOwner, currentRepo, currentRef);
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
      page: String(page),
      per_page: String(DEFAULT_PER_PAGE),
    });
    if (currentRef) {
      searchParams.set('ref', currentRef);
    }

    try {
      const data = await apiFetch<RepoCommitListResponse>(
        `/api/repos/${currentOwner}/${currentRepo}/commits?${searchParams.toString()}`
      );

      if (nextRequestId !== requestId) return;

      const nextPagination: RepoCommitListPaginationMeta = {
        page: data.pagination?.page ?? page,
        perPage: data.pagination?.perPage ?? DEFAULT_PER_PAGE,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
        totalCount: data.pagination?.totalCount ?? null,
        totalPages: data.pagination?.totalPages ?? null,
      };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const entry: RepoCommitPageCacheEntry = {
        items: nextItems,
        pagination: nextPagination,
      };

      pageCache.set(buildPageCacheKey(queryKey, nextPagination.page), entry);
      applyPage(entry);
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      pagination.value = createEmptyPagination(page);
      error.value = getFetchErrorMessage(fetchError, 'Failed to load repository commits.');
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
    () => [resolveOwner(), resolveRepo(), resolveRef()] as const,
    ([nextOwner, nextRepo]) => {
      if (!nextOwner || !nextRepo) {
        // Panel inactive (or unscoped) — keep last snapshot + session cache; no fetch.
        loading.value = false;
        return;
      }

      // Ref switches and panel return — restore from session page cache when possible.
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
