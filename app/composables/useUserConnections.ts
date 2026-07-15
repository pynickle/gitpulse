import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type {
  UserConnectionListResponse,
  UserConnectionPaginationMeta,
  UserSummary,
} from '#shared/types/users';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import createSessionLruCache from '~/utils/sessionLruCache';

export type UserConnectionRelation = 'followers' | 'following';

const DEFAULT_PER_PAGE = 30;
/** Per list query (username/relation): keep recent pages for instant back-nav. */
const MAX_CACHED_PAGES = 8;

interface ConnectionPageCacheEntry {
  items: UserSummary[];
  pagination: UserConnectionPaginationMeta;
}

const createEmptyPagination = (page = 1): UserConnectionPaginationMeta => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
});

const buildListQueryKey = (username: string, relation: UserConnectionRelation) =>
  `${username}:${relation}`;

const buildPageCacheKey = (queryKey: string, page: number) => `${queryKey}:p${page}`;

/**
 * Paginated followers/following list for the profile connections panel.
 * Mirrors {@link useRepoIssuePrList}: session page cache, request-id guarding,
 * and no traffic while username is empty (panel not active).
 */
export function useUserConnections(
  username: Ref<string> | (() => string),
  relation: Ref<UserConnectionRelation> | (() => UserConnectionRelation)
) {
  const apiFetch = useGitPulseApiFetch();

  const resolveUsername = () => (typeof username === 'function' ? username() : username.value);
  const resolveRelation = () => (typeof relation === 'function' ? relation() : relation.value);

  const items = shallowRef<UserSummary[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<UserConnectionPaginationMeta>(createEmptyPagination());
  let requestId = 0;

  // Lives for the lifetime of this composable instance (profile page session).
  const pageCache = createSessionLruCache<ConnectionPageCacheEntry>(MAX_CACHED_PAGES);

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

  const applyPage = (entry: ConnectionPageCacheEntry) => {
    items.value = entry.items;
    pagination.value = entry.pagination;
    error.value = '';
    loading.value = false;
  };

  const fetchPage = async (page = 1, options: { force?: boolean } = {}) => {
    const currentUsername = resolveUsername().trim();
    const currentRelation = resolveRelation();

    if (!currentUsername) {
      items.value = [];
      pagination.value = createEmptyPagination();
      error.value = '';
      loading.value = false;
      return;
    }

    const queryKey = buildListQueryKey(currentUsername, currentRelation);
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

    try {
      const data = await apiFetch<UserConnectionListResponse>(
        `/api/users/${encodeURIComponent(currentUsername)}/${currentRelation}?${searchParams.toString()}`
      );

      if (nextRequestId !== requestId) return;

      const nextPagination: UserConnectionPaginationMeta = {
        page: data.pagination?.page ?? page,
        perPage: data.pagination?.perPage ?? DEFAULT_PER_PAGE,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
        totalCount: data.pagination?.totalCount ?? null,
        totalPages: data.pagination?.totalPages ?? null,
      };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const entry: ConnectionPageCacheEntry = {
        items: nextItems,
        pagination: nextPagination,
      };

      pageCache.set(buildPageCacheKey(queryKey, nextPagination.page), entry);
      applyPage(entry);
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      pagination.value = createEmptyPagination(page);
      error.value = getFetchErrorMessage(fetchError, 'Failed to load list.');
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
    () => [resolveUsername(), resolveRelation()] as const,
    ([nextUsername]) => {
      if (!nextUsername) {
        // Panel inactive — keep last snapshot + session cache; no fetch.
        loading.value = false;
        return;
      }

      // Relation switches and panel return — restore from session page cache when possible.
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
