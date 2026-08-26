import { computed, ref, shallowRef } from 'vue';

import type { CustomTabSource, GitHubSearchQuery } from '#shared/types/custom-search';
import type { GitHubIssueType } from '#shared/types/issues';
import type { DashboardNotification, NotificationSubjectState } from '#shared/types/notifications';
import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
import { getGitHubSearchEndpoint } from '#shared/utils/github-search-query';
import {
  applyNotificationLocalFilters,
  hasNotificationPageLocalPredicates,
  type NotificationFilterAdapter,
} from '~/composables/useDashboardFilters';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import withPendingPaginationPage from '~/utils/withPendingPaginationPage';

interface DashboardEntity {
  id: PropertyKey;
  title: string;
  repository_url: string;
  number: number;
  updated_at: string;
  labels: {
    id: number | string;
    name: string;
    color: string;
  }[];
  type?: GitHubIssueType | null;
  merged_at?: string | null;
  state?: NotificationSubjectState;
  pull_request?: unknown;
  [key: string]: unknown;
}

interface DashboardRepo {
  id: PropertyKey;
  name: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  private?: boolean;
  owner?: {
    login?: string;
  };
  [key: string]: unknown;
}

export interface DashboardPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface PaginatedDashboardResponse<T> {
  items: T[];
  total_count?: number;
  pagination: DashboardPaginationMeta;
}

interface DashboardFetchOptions {
  force?: boolean;
  query?: GitHubSearchQuery;
  notificationParams?: Record<string, boolean | string | undefined>;
  notificationFilters?: NotificationFilterAdapter['local'];
}

interface DashboardPageCache {
  notifications: Record<string, Record<number, PaginatedDashboardResponse<DashboardNotification>>>;
  issues: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
  pulls: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
  repos: Record<number, PaginatedDashboardResponse<DashboardRepo>>;
  customTabs: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
}

interface NotificationRawPageCache {
  items: DashboardNotification[];
  hasNext: boolean;
}

interface NotificationRawPageResponse extends NotificationRawPageCache {
  page: number;
}

interface NotificationStreamCache {
  rawPages: Record<number, NotificationRawPageCache>;
  filteredItems: DashboardNotification[];
  nextRawPage: number;
  hasMoreRawPages: boolean;
  lastMatchesPerRawPage: number | null;
}

interface ActiveNotificationCacheContext {
  queryKey: string;
  page: number;
}

const defaultPerPage = 20;
const notificationApiPerPage = 50;
const notificationInitialBatchSize = 3;
const notificationMaxBatchSize = 5;
const maxCachedPagesPerCollection = 5;
const maxCachedCustomTabQueries = 25;

const createDefaultPaginationMeta = (): DashboardPaginationMeta => ({
  page: 1,
  perPage: defaultPerPage,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: 1,
});

const createPaginationState = (): Record<DashboardTab, DashboardPaginationMeta> => ({
  todos: createDefaultPaginationMeta(),
  notifications: createDefaultPaginationMeta(),
  issues: createDefaultPaginationMeta(),
  pulls: createDefaultPaginationMeta(),
  repos: createDefaultPaginationMeta(),
});

const createPageCache = (): DashboardPageCache => ({
  notifications: {},
  issues: {},
  pulls: {},
  repos: {},
  customTabs: {},
});

const buildPaginationUrl = (
  path: string,
  page: number,
  perPage = defaultPerPage,
  params: Record<string, boolean | string | undefined> = {}
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return `${path}?${searchParams.toString()}`;
};

const buildParamQueryKey = (params: Record<string, boolean | string | undefined> = {}) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return searchParams.toString() || 'default';
};

const createDefaultNotificationLocalFilters = (): NotificationFilterAdapter['local'] => ({});

const buildNotificationQueryKey = (
  params: Record<string, boolean | string | undefined>,
  localFilters: NotificationFilterAdapter['local']
) => {
  return buildParamQueryKey({
    ...params,
    read_state: localFilters.readState,
  });
};

const parseNotificationQueryParams = (queryKey: string) => {
  return new URLSearchParams(queryKey === 'default' ? '' : queryKey);
};

const getReadStateFromQueryParams = (params: URLSearchParams) => {
  const readState = params.get('read_state');
  return readState === 'read' || readState === 'unread' ? readState : undefined;
};

const isUnreadOnlyNotificationQueryKey = (queryKey: string) => {
  const params = parseNotificationQueryParams(queryKey);
  return params.get('all') !== 'true' && getReadStateFromQueryParams(params) !== 'read';
};

const getNotificationLocalFiltersFromQueryKey = (
  queryKey: string
): NotificationFilterAdapter['local'] => {
  const params = parseNotificationQueryParams(queryKey);
  return {
    readState: getReadStateFromQueryParams(params),
  };
};

const updateNotificationItemsReadState = (
  items: DashboardNotification[],
  threadId: string,
  options: { remove?: boolean } = {}
) => {
  let changed = false;
  const nextItems = items.flatMap((item) => {
    if (String(item.id) !== threadId) return [item];

    changed = true;
    if (options.remove) return [];
    return item.unread ? [{ ...item, unread: false }] : [item];
  });

  return changed ? nextItems : items;
};

const createNotificationStreamCache = (): NotificationStreamCache => ({
  rawPages: {},
  filteredItems: [],
  nextRawPage: 1,
  hasMoreRawPages: true,
  lastMatchesPerRawPage: null,
});

const getNotificationBatchSize = (cache: NotificationStreamCache, requiredItemCount: number) => {
  if (cache.lastMatchesPerRawPage === null) return notificationInitialBatchSize;
  if (cache.lastMatchesPerRawPage <= 0) return notificationMaxBatchSize;

  return Math.min(
    notificationMaxBatchSize,
    Math.max(1, Math.ceil(requiredItemCount / cache.lastMatchesPerRawPage))
  );
};

const buildNotificationDisplayPage = (
  cache: NotificationStreamCache,
  page: number
): PaginatedDashboardResponse<DashboardNotification> => {
  const start = (page - 1) * defaultPerPage;
  const end = start + defaultPerPage;

  return {
    items: cache.filteredItems.slice(start, end),
    pagination: {
      page,
      perPage: defaultPerPage,
      hasPrev: page > 1,
      hasNext: cache.filteredItems.length > end || cache.hasMoreRawPages,
      totalCount: null,
      totalPages: null,
    },
  };
};

const buildCustomTabQueryKey = (
  query: GitHubSearchQuery,
  source: CustomTabSource = 'github-search'
) => {
  const searchParams = new URLSearchParams({ source });
  appendCustomTabQueryParams(searchParams, query);
  if (query.perPage) {
    searchParams.set('per_page', String(query.perPage));
  }

  return searchParams.toString();
};

const buildCustomTabUrl = (page: number, query: GitHubSearchQuery, perPage = defaultPerPage) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(query.perPage ?? perPage),
  });
  appendCustomTabQueryParams(searchParams, query);

  return `/api/search/${getGitHubSearchEndpoint(query)}?${searchParams.toString()}`;
};

export function useGithubData() {
  const apiFetch = useGitPulseApiFetch();
  const subjectEnrichment = useNotificationSubjectEnrichment();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const notificationSubjectEnrichmentError = shallowRef(false);
  const activeRequestId = ref(0);
  const activeNotificationCacheContext = ref<ActiveNotificationCacheContext | null>(null);
  const pageCache = ref(createPageCache());
  const notificationStreamCache = ref<Record<string, NotificationStreamCache>>({});
  const pendingNotificationReadThreadIds = new Set<string>();
  const pageCacheOrder = {
    notifications: [] as string[],
    notificationPages: {} as Record<string, number[]>,
    issues: [] as string[],
    issuePages: {} as Record<string, number[]>,
    pulls: [] as string[],
    pullPages: {} as Record<string, number[]>,
    repos: [] as number[],
    customTabs: [] as string[],
    customTabPages: {} as Record<string, number[]>,
  };
  const notifications = ref<DashboardNotification[]>([]);
  const issues = ref<DashboardEntity[]>([]);
  const pulls = ref<DashboardEntity[]>([]);
  const repos = ref<DashboardRepo[]>([]);
  const pagination = ref(createPaginationState());
  const stats = ref({
    issues: 0,
    prs: 0,
    repos: 0,
  });
  const notificationSubjectEnrichmentRefreshing = computed(() => {
    return notifications.value.some(
      (notification) => notification.subject?.stateStatus === 'pending'
    );
  });

  const touchCachedPage = <T>(cache: Record<number, T>, order: number[], page: number) => {
    const existingIndex = order.indexOf(page);
    if (existingIndex >= 0) {
      order.splice(existingIndex, 1);
    }

    order.push(page);

    while (order.length > maxCachedPagesPerCollection) {
      const expiredPage = order.shift();
      if (expiredPage !== undefined) {
        delete cache[expiredPage];
      }
    }
  };

  const touchQueryCache = <T>(
    cache: Record<string, Record<number, T>>,
    queryOrder: string[],
    pageOrders: Record<string, number[]>,
    queryKey: string,
    page: number,
    maxCachedQueries = maxCachedCustomTabQueries,
    onExpireQuery?: (queryKey: string) => void
  ) => {
    const existingQueryIndex = queryOrder.indexOf(queryKey);
    if (existingQueryIndex >= 0) {
      queryOrder.splice(existingQueryIndex, 1);
    }

    queryOrder.push(queryKey);

    const queryCache = cache[queryKey];
    if (queryCache) {
      const queryPageOrder = pageOrders[queryKey] ?? [];
      pageOrders[queryKey] = queryPageOrder;
      touchCachedPage(queryCache, queryPageOrder, page);
    }

    while (queryOrder.length > maxCachedQueries) {
      const expiredQueryKey = queryOrder.shift();
      if (expiredQueryKey) {
        delete cache[expiredQueryKey];
        delete pageOrders[expiredQueryKey];
        onExpireQuery?.(expiredQueryKey);
      }
    }
  };

  const touchNotificationCache = (queryKey: string, page: number) => {
    touchQueryCache(
      pageCache.value.notifications,
      pageCacheOrder.notifications,
      pageCacheOrder.notificationPages,
      queryKey,
      page,
      maxCachedCustomTabQueries,
      (expiredQueryKey) => {
        delete notificationStreamCache.value[expiredQueryKey];
      }
    );
  };

  const touchCustomTabCache = (queryKey: string, page: number) => {
    touchQueryCache(
      pageCache.value.customTabs,
      pageCacheOrder.customTabs,
      pageCacheOrder.customTabPages,
      queryKey,
      page
    );
  };

  const applyNotificationsData = (
    data: PaginatedDashboardResponse<DashboardNotification>,
    context?: ActiveNotificationCacheContext
  ) => {
    if (context) {
      activeNotificationCacheContext.value = context;
    }
    notifications.value = data.items;
    pagination.value.notifications = data.pagination;
  };

  const mergeNotificationEnrichment = (
    currentItems: DashboardNotification[],
    enrichedItems: DashboardNotification[]
  ) => {
    const enrichedById = new Map(
      enrichedItems.map((notification) => [String(notification.id), notification])
    );

    return currentItems.map((notification) => {
      const enriched = enrichedById.get(String(notification.id));
      if (!enriched) return notification;

      return {
        ...notification,
        updated_at: enriched.updated_at,
        subject: enriched.subject,
      };
    });
  };

  const startNotificationPageEnrichment = (
    queryKey: string,
    page: number,
    data: PaginatedDashboardResponse<DashboardNotification>
  ) => {
    notificationSubjectEnrichmentError.value = false;
    const run = subjectEnrichment.start(data.items);
    const pendingData = {
      ...data,
      items: run.notifications,
    };

    if (!pageCache.value.notifications[queryKey]) {
      pageCache.value.notifications[queryKey] = {};
    }
    pageCache.value.notifications[queryKey][page] = pendingData;

    void run.completion
      .then((outcome) => {
        if (outcome.outcome === 'stale') return;

        notificationSubjectEnrichmentError.value =
          outcome.outcome === 'partial' || outcome.outcome === 'failed';
        const cachedData = pageCache.value.notifications[queryKey]?.[page];
        const queryCache = pageCache.value.notifications[queryKey];
        if (!cachedData || !queryCache) return;

        const enrichedData = {
          ...cachedData,
          items: mergeNotificationEnrichment(cachedData.items, outcome.notifications),
        };
        queryCache[page] = enrichedData;

        const activeContext = activeNotificationCacheContext.value;
        if (activeContext?.queryKey === queryKey && activeContext.page === page) {
          applyNotificationsData(enrichedData);
        }
      })
      .catch((enrichmentError) => {
        console.error('Notification Subject Enrichment invariant failed:', enrichmentError);
      });

    return pendingData;
  };

  const fetchNotificationRawPage = async (
    page: number,
    notificationParams: Record<string, boolean | string | undefined>
  ): Promise<NotificationRawPageResponse> => {
    const data = await apiFetch<PaginatedDashboardResponse<DashboardNotification>>(
      buildPaginationUrl('/api/notifications', page, notificationApiPerPage, notificationParams)
    );

    return {
      page: data.pagination.page,
      items: data.items,
      hasNext: data.pagination.hasNext,
    };
  };

  const rebuildNotificationFilteredItems = (
    cache: NotificationStreamCache,
    localFilters: NotificationFilterAdapter['local']
  ) => {
    const rawItems = Object.entries(cache.rawPages)
      .sort(([left], [right]) => Number(left) - Number(right))
      .flatMap(([, rawPage]) => rawPage.items);

    cache.filteredItems = applyNotificationLocalFilters(rawItems, localFilters);
  };

  const fetchNotificationBatch = async (
    cache: NotificationStreamCache,
    notificationParams: Record<string, boolean | string | undefined>,
    targetPage: number
  ) => {
    const requiredItemCount = Math.max(
      targetPage * defaultPerPage - cache.filteredItems.length,
      defaultPerPage
    );
    const batchSize = getNotificationBatchSize(cache, requiredItemCount);
    const pages = Array.from({ length: batchSize }, (_, index) => cache.nextRawPage + index);
    return (
      await Promise.all(
        pages.map((rawPage) => fetchNotificationRawPage(rawPage, notificationParams))
      )
    ).sort((left, right) => left.page - right.page);
  };

  const applyNotificationStreamEnrichment = (
    cache: NotificationStreamCache,
    pages: NotificationRawPageResponse[],
    enrichedNotifications: DashboardNotification[]
  ) => {
    let offset = 0;
    for (const page of pages) {
      const enrichedPageItems = enrichedNotifications.slice(offset, offset + page.items.length);
      offset += page.items.length;
      const currentItems = cache.rawPages[page.page]?.items ?? page.items;

      cache.rawPages[page.page] = {
        items: mergeNotificationEnrichment(currentItems, enrichedPageItems),
        hasNext: page.hasNext,
      };
    }
  };

  const updateNotificationStreamProgress = (
    cache: NotificationStreamCache,
    fetchedPages: NotificationRawPageResponse[],
    localFilters: NotificationFilterAdapter['local']
  ) => {
    let matchedItems = 0;
    for (const rawPage of fetchedPages) {
      const cachedPage = cache.rawPages[rawPage.page];
      matchedItems += applyNotificationLocalFilters(
        cachedPage?.items ?? rawPage.items,
        localFilters
      ).length;
    }

    const lastFetchedPage = fetchedPages[fetchedPages.length - 1];
    if (lastFetchedPage) {
      cache.nextRawPage = Math.max(cache.nextRawPage, lastFetchedPage.page + 1);
      cache.hasMoreRawPages = fetchedPages.every((rawPage) => rawPage.hasNext);
      cache.lastMatchesPerRawPage = matchedItems / fetchedPages.length;
    }
  };

  const rebuildNotificationQueryPages = (
    queryKey: string,
    cache: NotificationStreamCache,
    targetPage: number
  ) => {
    const queryCache = pageCache.value.notifications[queryKey] ?? {};
    pageCache.value.notifications[queryKey] = queryCache;
    const displayPages = new Set([...Object.keys(queryCache).map(Number), targetPage]);

    for (const displayPage of displayPages) {
      queryCache[displayPage] = buildNotificationDisplayPage(cache, displayPage);
    }

    return queryCache[targetPage]!;
  };

  const startNotificationStreamEnrichment = (
    queryKey: string,
    cache: NotificationStreamCache,
    localFilters: NotificationFilterAdapter['local'],
    targetPage: number,
    pages: NotificationRawPageResponse[],
    advanceStream: boolean
  ) => {
    notificationSubjectEnrichmentError.value = false;
    const run = subjectEnrichment.start(pages.flatMap((page) => page.items));
    applyNotificationStreamEnrichment(cache, pages, run.notifications);

    if (advanceStream) {
      updateNotificationStreamProgress(cache, pages, localFilters);
    }

    rebuildNotificationFilteredItems(cache, localFilters);
    const pendingData = rebuildNotificationQueryPages(queryKey, cache, targetPage);

    void run.completion
      .then((outcome) => {
        if (outcome.outcome === 'stale') return;

        notificationSubjectEnrichmentError.value =
          outcome.outcome === 'partial' || outcome.outcome === 'failed';
        applyNotificationStreamEnrichment(cache, pages, outcome.notifications);
        rebuildNotificationFilteredItems(cache, localFilters);
        rebuildNotificationQueryPages(queryKey, cache, targetPage);

        const activeContext = activeNotificationCacheContext.value;
        if (activeContext?.queryKey !== queryKey) return;

        const activeData = pageCache.value.notifications[queryKey]?.[activeContext.page];
        if (activeData) {
          applyNotificationsData(activeData);
        }
      })
      .catch((enrichmentError) => {
        console.error('Notification Subject Enrichment invariant failed:', enrichmentError);
      });

    return pendingData;
  };

  const applyIssuesData = (data: PaginatedDashboardResponse<DashboardEntity>) => {
    issues.value = data.items || [];
    stats.value.issues = data.total_count || 0;
    pagination.value.issues = data.pagination;
  };

  const applyPullsData = (data: PaginatedDashboardResponse<DashboardEntity>) => {
    pulls.value = data.items || [];
    stats.value.prs = data.total_count || 0;
    pagination.value.pulls = data.pagination;
  };

  const applyReposData = (data: PaginatedDashboardResponse<DashboardRepo>) => {
    repos.value = data.items;
    stats.value.repos = data.pagination.totalCount ?? data.items.length;
    pagination.value.repos = data.pagination;
  };

  const fetchLegacyNotifications = async (
    page: number,
    options: DashboardFetchOptions,
    notificationParams: Record<string, boolean | string | undefined>
  ) => {
    const queryKey = buildParamQueryKey(notificationParams);
    const queryCache = pageCache.value.notifications[queryKey] ?? {};
    const cachedData = queryCache[page];

    if (cachedData && !options.force) {
      const pendingData = startNotificationPageEnrichment(queryKey, page, cachedData);
      touchNotificationCache(queryKey, page);
      applyNotificationsData(pendingData, { queryKey, page });
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.notifications = withPendingPaginationPage(
      pagination.value.notifications,
      page
    );

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardNotification>>(
        buildPaginationUrl('/api/notifications', page, defaultPerPage, notificationParams)
      );
      if (requestId !== activeRequestId.value) return;

      const pendingData = startNotificationPageEnrichment(queryKey, data.pagination.page, data);
      touchNotificationCache(queryKey, data.pagination.page);
      applyNotificationsData(pendingData, { queryKey, page: data.pagination.page });
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchNotifications = async (page = 1, options: DashboardFetchOptions = {}) => {
    const notificationParams = options.notificationParams ?? { all: true };
    const localFilters = options.notificationFilters ?? createDefaultNotificationLocalFilters();
    activeRequestId.value += 1;
    notificationSubjectEnrichmentError.value = false;
    void subjectEnrichment.start([]).completion;

    if (!hasNotificationPageLocalPredicates(localFilters)) {
      await fetchLegacyNotifications(page, options, notificationParams);
      return;
    }

    const queryKey = buildNotificationQueryKey(notificationParams, localFilters);

    if (!notificationStreamCache.value[queryKey] || options.force) {
      notificationStreamCache.value[queryKey] = createNotificationStreamCache();
      pageCache.value.notifications[queryKey] = {};
    }

    const streamCache = notificationStreamCache.value[queryKey]!;
    const queryCache = pageCache.value.notifications[queryKey] ?? {};
    const cachedData = queryCache[page];
    const cachedPageIsFilled = Boolean(
      cachedData &&
      (cachedData.items.length >= defaultPerPage ||
        !streamCache.hasMoreRawPages ||
        streamCache.filteredItems.length >= page * defaultPerPage)
    );

    if (cachedData && cachedPageIsFilled && !options.force) {
      const cachedRawPages = Object.entries(streamCache.rawPages)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([rawPage, cachedPage]) => ({
          page: Number(rawPage),
          items: cachedPage.items,
          hasNext: cachedPage.hasNext,
        }));
      const pendingData = startNotificationStreamEnrichment(
        queryKey,
        streamCache,
        localFilters,
        page,
        cachedRawPages,
        false
      );
      touchNotificationCache(queryKey, page);
      applyNotificationsData(pendingData, { queryKey, page });
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.notifications = withPendingPaginationPage(
      pagination.value.notifications,
      page
    );

    try {
      let fetchedPages: NotificationRawPageResponse[] = [];
      if (streamCache.filteredItems.length < page * defaultPerPage && streamCache.hasMoreRawPages) {
        fetchedPages = await fetchNotificationBatch(streamCache, notificationParams, page);
      }

      if (requestId !== activeRequestId.value) return;

      const data =
        fetchedPages.length > 0
          ? startNotificationStreamEnrichment(
              queryKey,
              streamCache,
              localFilters,
              page,
              fetchedPages,
              true
            )
          : rebuildNotificationQueryPages(queryKey, streamCache, page);
      touchNotificationCache(queryKey, page);
      applyNotificationsData(data, { queryKey, page });
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const retryNotificationSubjectEnrichment = async () => {
    const activeContext = activeNotificationCacheContext.value;
    if (!activeContext) return;

    const streamCache = notificationStreamCache.value[activeContext.queryKey];
    if (streamCache) {
      const pages = Object.entries(streamCache.rawPages)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([rawPage, cachedPage]) => ({
          page: Number(rawPage),
          items: cachedPage.items,
          hasNext: cachedPage.hasNext,
        }));
      const localFilters = getNotificationLocalFiltersFromQueryKey(activeContext.queryKey);
      const data = startNotificationStreamEnrichment(
        activeContext.queryKey,
        streamCache,
        localFilters,
        activeContext.page,
        pages,
        false
      );
      applyNotificationsData(data);
      return;
    }

    const cachedData = pageCache.value.notifications[activeContext.queryKey]?.[activeContext.page];
    if (!cachedData) return;

    const pendingData = startNotificationPageEnrichment(
      activeContext.queryKey,
      activeContext.page,
      cachedData
    );
    applyNotificationsData(pendingData);
  };

  const updateCachedNotificationReadState = (threadId: string) => {
    for (const [queryKey, queryCache] of Object.entries(pageCache.value.notifications)) {
      const remove = isUnreadOnlyNotificationQueryKey(queryKey);
      const nextQueryCache = { ...queryCache };
      let changed = false;

      for (const [pageKey, cachedData] of Object.entries(queryCache)) {
        const items = updateNotificationItemsReadState(cachedData.items, threadId, { remove });
        if (items !== cachedData.items) {
          nextQueryCache[Number(pageKey)] = {
            ...cachedData,
            items,
          };
          changed = true;
        }
      }

      if (changed) {
        pageCache.value.notifications[queryKey] = nextQueryCache;
      }
    }

    for (const [queryKey, streamCache] of Object.entries(notificationStreamCache.value)) {
      const remove = isUnreadOnlyNotificationQueryKey(queryKey);
      const nextRawPages = { ...streamCache.rawPages };
      let changed = false;

      for (const [pageKey, rawPage] of Object.entries(streamCache.rawPages)) {
        const items = updateNotificationItemsReadState(rawPage.items, threadId, { remove });
        if (items !== rawPage.items) {
          nextRawPages[Number(pageKey)] = {
            ...rawPage,
            items,
          };
          changed = true;
        }
      }

      if (!changed) continue;

      const nextStreamCache: NotificationStreamCache = {
        ...streamCache,
        rawPages: nextRawPages,
      };
      rebuildNotificationFilteredItems(
        nextStreamCache,
        getNotificationLocalFiltersFromQueryKey(queryKey)
      );
      notificationStreamCache.value[queryKey] = nextStreamCache;

      const queryCache = pageCache.value.notifications[queryKey];
      if (!queryCache) continue;

      const nextQueryCache = { ...queryCache };
      for (const pageKey of Object.keys(queryCache)) {
        const page = Number(pageKey);
        nextQueryCache[page] = buildNotificationDisplayPage(nextStreamCache, page);
      }
      pageCache.value.notifications[queryKey] = nextQueryCache;
    }

    const activeContext = activeNotificationCacheContext.value;
    if (!activeContext) {
      notifications.value = updateNotificationItemsReadState(notifications.value, threadId);
      return;
    }

    const cachedData = pageCache.value.notifications[activeContext.queryKey]?.[activeContext.page];
    if (cachedData) {
      applyNotificationsData(cachedData);
      return;
    }

    notifications.value = updateNotificationItemsReadState(notifications.value, threadId, {
      remove: isUnreadOnlyNotificationQueryKey(activeContext.queryKey),
    });
  };

  const markNotificationAsRead = async (notification: DashboardNotification) => {
    if (!notification.unread) return false;

    const threadId = String(notification.id);
    if (pendingNotificationReadThreadIds.has(threadId)) return false;

    pendingNotificationReadThreadIds.add(threadId);

    try {
      await apiFetch(`/api/notifications/${encodeURIComponent(threadId)}`, {
        method: 'PATCH',
      });
      updateCachedNotificationReadState(threadId);
      return true;
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      return false;
    } finally {
      pendingNotificationReadThreadIds.delete(threadId);
    }
  };

  const fetchIssues = async (page = 1, options: DashboardFetchOptions = {}) => {
    const queryKey = options.query ? buildCustomTabQueryKey(options.query) : 'default';
    const queryCache = pageCache.value.issues[queryKey] ?? {};
    const cachedData = queryCache[page];
    if (cachedData && !options.force) {
      touchQueryCache(
        pageCache.value.issues,
        pageCacheOrder.issues,
        pageCacheOrder.issuePages,
        queryKey,
        page
      );
      applyIssuesData(cachedData);
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.issues = withPendingPaginationPage(pagination.value.issues, page);

    try {
      // Built-in issue tabs use GitHub Search when query-level filters are available.
      const url = options.query
        ? buildCustomTabUrl(page, options.query)
        : buildPaginationUrl('/api/issues', page);
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(url);
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.issues[queryKey]) {
        pageCache.value.issues[queryKey] = {};
      }
      pageCache.value.issues[queryKey][data.pagination.page] = data;
      touchQueryCache(
        pageCache.value.issues,
        pageCacheOrder.issues,
        pageCacheOrder.issuePages,
        queryKey,
        data.pagination.page
      );
      applyIssuesData(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchPulls = async (page = 1, options: DashboardFetchOptions = {}) => {
    const queryKey = options.query ? buildCustomTabQueryKey(options.query) : 'default';
    const queryCache = pageCache.value.pulls[queryKey] ?? {};
    const cachedData = queryCache[page];
    if (cachedData && !options.force) {
      touchQueryCache(
        pageCache.value.pulls,
        pageCacheOrder.pulls,
        pageCacheOrder.pullPages,
        queryKey,
        page
      );
      applyPullsData(cachedData);
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.pulls = withPendingPaginationPage(pagination.value.pulls, page);

    try {
      // Built-in PR tabs use GitHub Search when query-level filters are available.
      const url = options.query
        ? buildCustomTabUrl(page, options.query)
        : buildPaginationUrl('/api/pulls', page);
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(url);
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.pulls[queryKey]) {
        pageCache.value.pulls[queryKey] = {};
      }
      pageCache.value.pulls[queryKey][data.pagination.page] = data;
      touchQueryCache(
        pageCache.value.pulls,
        pageCacheOrder.pulls,
        pageCacheOrder.pullPages,
        queryKey,
        data.pagination.page
      );
      applyPullsData(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchRepos = async (page = 1, options: DashboardFetchOptions = {}) => {
    const cachedData = pageCache.value.repos[page];
    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.repos, pageCacheOrder.repos, page);
      applyReposData(cachedData);
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.repos = withPendingPaginationPage(pagination.value.repos, page);

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardRepo>>(
        buildPaginationUrl('/api/repos', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.repos[data.pagination.page] = data;
      touchCachedPage(pageCache.value.repos, pageCacheOrder.repos, data.pagination.page);
      applyReposData(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchCustomTab = async (
    query: GitHubSearchQuery,
    page = 1,
    options: DashboardFetchOptions = {},
    source: CustomTabSource = 'github-search'
  ) => {
    const queryKey = buildCustomTabQueryKey(query, source);
    const queryCache = pageCache.value.customTabs[queryKey] ?? {};
    const cachedData = queryCache[page];

    if (cachedData && !options.force) {
      touchCustomTabCache(queryKey, page);
      applyIssuesData(cachedData);
      error.value = null;
      loading.value = false;
      return cachedData;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;
    pagination.value.issues = withPendingPaginationPage(pagination.value.issues, page);

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildCustomTabUrl(page, query)
      );
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.customTabs[queryKey]) {
        pageCache.value.customTabs[queryKey] = {};
      }

      pageCache.value.customTabs[queryKey][data.pagination.page] = data;
      touchCustomTabCache(queryKey, data.pagination.page);
      applyIssuesData(data);
      return data;
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
    loading,
    error,
    notificationSubjectEnrichmentError,
    notificationSubjectEnrichmentRefreshing,
    notifications,
    issues,
    pulls,
    repos,
    pagination,
    stats,
    fetchNotifications,
    fetchIssues,
    fetchPulls,
    fetchRepos,
    fetchCustomTab,
    retryNotificationSubjectEnrichment,
    markNotificationAsRead,
  };
}
