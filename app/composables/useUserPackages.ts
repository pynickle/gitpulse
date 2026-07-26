import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type {
  PackageDetailResponse,
  PackageSummary,
  PackageType,
  PackageTypeFilter,
  PackageVersionListResponse,
  PackageVersionSummary,
  UserPackageListResponse,
} from '#shared/types/packages';
import type { UserConnectionPaginationMeta } from '#shared/types/users';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import createSessionLruCache from '~/utils/sessionLruCache';

const DEFAULT_PER_PAGE = 30;
/** Per list query (username/type/account): keep recent pages for instant back-nav. */
const MAX_CACHED_PAGES = 8;

type MaybeGetter<T> = Ref<T> | (() => T);

const resolveValue = <T>(source: MaybeGetter<T>): T =>
  typeof source === 'function' ? source() : source.value;

const createEmptyPagination = (page = 1): UserConnectionPaginationMeta => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
});

const normalizePagination = (
  pagination: UserConnectionPaginationMeta | undefined,
  fallbackPage: number
): UserConnectionPaginationMeta => ({
  page: pagination?.page ?? fallbackPage,
  perPage: pagination?.perPage ?? DEFAULT_PER_PAGE,
  hasPrev: Boolean(pagination?.hasPrev),
  hasNext: Boolean(pagination?.hasNext),
  totalCount: pagination?.totalCount ?? null,
  totalPages: pagination?.totalPages ?? null,
});

interface PackageListCacheEntry {
  items: PackageSummary[];
  pagination: UserConnectionPaginationMeta;
}

/**
 * Paginated `/api/users/{username}/packages` list for the profile "Packages"
 * tab. Mirrors {@link useUserConnections}: session page cache, request-id
 * guarding, and no traffic while username is empty (tab not active).
 */
export function useUserPackages(
  username: MaybeGetter<string>,
  typeFilter: MaybeGetter<PackageTypeFilter>,
  isOrganization: MaybeGetter<boolean>
) {
  const apiFetch = useGitPulseApiFetch();

  const items = shallowRef<PackageSummary[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<UserConnectionPaginationMeta>(createEmptyPagination());
  let requestId = 0;

  const pageCache = createSessionLruCache<PackageListCacheEntry>(MAX_CACHED_PAGES);

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

  const buildQueryKey = () =>
    `${resolveValue(username).trim()}:${resolveValue(typeFilter)}:${
      resolveValue(isOrganization) ? 'org' : 'user'
    }`;

  const applyPage = (entry: PackageListCacheEntry) => {
    items.value = entry.items;
    pagination.value = entry.pagination;
    error.value = '';
    loading.value = false;
  };

  const fetchPage = async (page = 1, options: { force?: boolean } = {}) => {
    const currentUsername = resolveValue(username).trim();

    if (!currentUsername) {
      items.value = [];
      pagination.value = createEmptyPagination();
      error.value = '';
      loading.value = false;
      return;
    }

    const queryKey = buildQueryKey();
    const cacheKey = `${queryKey}:p${page}`;

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
      type: resolveValue(typeFilter),
    });
    if (resolveValue(isOrganization)) {
      searchParams.set('account', 'organization');
    }

    try {
      const data = await apiFetch<UserPackageListResponse>(
        `/api/users/${encodeURIComponent(currentUsername)}/packages?${searchParams.toString()}`
      );

      if (nextRequestId !== requestId) return;

      const entry: PackageListCacheEntry = {
        items: Array.isArray(data.items) ? data.items : [],
        pagination: normalizePagination(data.pagination, page),
      };

      pageCache.set(`${queryKey}:p${entry.pagination.page}`, entry);
      applyPage(entry);
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      pagination.value = createEmptyPagination(page);
      error.value = getFetchErrorMessage(fetchError, 'Failed to load packages.');
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
    () => [resolveValue(username), resolveValue(typeFilter), resolveValue(isOrganization)] as const,
    ([nextUsername]) => {
      if (!nextUsername) {
        // Tab inactive — keep last snapshot + session cache; no fetch.
        loading.value = false;
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

export interface PackageDetailTarget {
  username: string;
  packageType: PackageType;
  name: string;
  isOrganization: boolean;
}

const buildTargetSearchParams = (
  target: PackageDetailTarget,
  extra: Record<string, string> = {}
) => {
  const searchParams = new URLSearchParams({
    type: target.packageType,
    name: target.name,
    ...extra,
  });
  if (target.isOrganization) {
    searchParams.set('account', 'organization');
  }
  return searchParams;
};

/**
 * Package detail + paginated version list for the `/dashboard/package` page.
 * Detail and versions carry independent loading/error state and request ids so
 * a version page change never drops an in-flight detail response (or vice
 * versa); target switches invalidate both.
 */
export function useUserPackageDetail(target: () => PackageDetailTarget | null) {
  const apiFetch = useGitPulseApiFetch();

  const detail = shallowRef<PackageSummary | null>(null);
  const loadingDetail = ref(false);
  const detailError = ref('');

  const versions = shallowRef<PackageVersionSummary[]>([]);
  const loadingVersions = ref(false);
  const versionsError = ref('');
  const versionsPagination = ref<UserConnectionPaginationMeta>(createEmptyPagination());

  let detailRequestId = 0;
  let versionsRequestId = 0;

  const versionsShowPagination = computed(() => {
    return (
      !loadingVersions.value &&
      !versionsError.value &&
      (versionsPagination.value.hasPrev ||
        versionsPagination.value.hasNext ||
        (versionsPagination.value.totalPages ?? 1) > 1)
    );
  });

  const resetState = () => {
    detail.value = null;
    versions.value = [];
    detailError.value = '';
    versionsError.value = '';
    loadingDetail.value = false;
    loadingVersions.value = false;
    versionsPagination.value = createEmptyPagination();
  };

  const fetchVersionsPage = async (page = 1) => {
    const currentTarget = target();
    if (!currentTarget) return;

    const nextRequestId = versionsRequestId + 1;
    versionsRequestId = nextRequestId;
    const isCurrent = () => nextRequestId === versionsRequestId;

    loadingVersions.value = true;
    versionsError.value = '';

    const searchParams = buildTargetSearchParams(currentTarget, {
      page: String(page),
      per_page: String(DEFAULT_PER_PAGE),
    });

    try {
      const data = await apiFetch<PackageVersionListResponse>(
        `/api/users/${encodeURIComponent(currentTarget.username)}/packages/versions?${searchParams.toString()}`
      );

      if (!isCurrent()) return;

      versions.value = Array.isArray(data.items) ? data.items : [];
      versionsPagination.value = normalizePagination(data.pagination, page);
    } catch (fetchError) {
      if (!isCurrent()) return;

      versions.value = [];
      versionsPagination.value = createEmptyPagination(page);
      versionsError.value = getFetchErrorMessage(fetchError, 'Failed to load package versions.');
    } finally {
      if (isCurrent()) {
        loadingVersions.value = false;
      }
    }
  };

  const goToVersionsPage = async (page: number) => {
    if (page < 1 || page === versionsPagination.value.page || loadingVersions.value) return;
    await fetchVersionsPage(page);
  };

  const load = async () => {
    const currentTarget = target();

    if (!currentTarget) {
      detailRequestId += 1;
      versionsRequestId += 1;
      resetState();
      return;
    }

    const nextRequestId = detailRequestId + 1;
    detailRequestId = nextRequestId;
    const isCurrent = () => nextRequestId === detailRequestId;

    loadingDetail.value = true;
    detailError.value = '';
    versions.value = [];
    versionsPagination.value = createEmptyPagination();

    const searchParams = buildTargetSearchParams(currentTarget);
    const detailRequest = apiFetch<PackageDetailResponse>(
      `/api/users/${encodeURIComponent(currentTarget.username)}/packages/detail?${searchParams.toString()}`
    )
      .then((data) => {
        if (isCurrent()) detail.value = data.package;
      })
      .catch((error) => {
        if (!isCurrent()) return;
        detail.value = null;
        detailError.value = getFetchErrorMessage(error, 'Failed to load package.');
      })
      .finally(() => {
        if (isCurrent()) loadingDetail.value = false;
      });

    await Promise.all([detailRequest, fetchVersionsPage(1)]);
  };

  watch(
    () => {
      const currentTarget = target();
      return currentTarget
        ? `${currentTarget.username}:${currentTarget.packageType}:${currentTarget.name}:${currentTarget.isOrganization}`
        : '';
    },
    () => void load(),
    { immediate: true }
  );

  return {
    detail,
    loadingDetail,
    detailError,
    versions,
    loadingVersions,
    versionsError,
    versionsPagination,
    versionsShowPagination,
    goToVersionsPage,
    refresh: load,
  };
}
