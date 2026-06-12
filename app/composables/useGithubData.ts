import { ref } from 'vue';

import type { CustomTabSource, GitHubSearchQuery } from '#shared/types/custom-search';
import type {
  DashboardNotification,
  NotificationSubjectState,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';
import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
import {
  applyNotificationLocalFilters,
  hasNotificationPageLocalPredicates,
  type NotificationFilterAdapter,
} from '~/composables/useDashboardFilters';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import parseGitHubNotificationSubjectTarget, {
  toNotificationSubjectStateTarget,
} from '~/utils/parseGitHubNotificationSubjectTarget';

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
  type?: { name?: string };
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

interface NotificationStreamCache {
  rawPages: Record<number, NotificationRawPageCache>;
  filteredItems: DashboardNotification[];
  nextRawPage: number;
  hasMoreRawPages: boolean;
  lastMatchesPerRawPage: number | null;
}

const defaultPerPage = 20;
const notificationApiPerPage = 50;
const notificationInitialBatchSize = 3;
const notificationMaxBatchSize = 5;
const notificationSubjectStateChunkSize = 50;
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

const createDefaultNotificationLocalFilters = (): NotificationFilterAdapter['local'] => ({
  labels: [],
});

const buildNotificationQueryKey = (
  params: Record<string, boolean | string | undefined>,
  localFilters: NotificationFilterAdapter['local']
) => {
  return buildParamQueryKey({
    ...params,
    read_state: localFilters.readState,
    repo: localFilters.repo,
    reason: localFilters.reason,
    subject_type: localFilters.subjectType,
    subject_state: localFilters.subjectState,
  });
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

const chunkItems = <T>(items: T[], chunkSize: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const parseNotificationSubjectStateTarget = (
  notification: DashboardNotification
): NotificationSubjectStateTarget | null => {
  const target = parseGitHubNotificationSubjectTarget(notification.subject);
  return target ? toNotificationSubjectStateTarget(target) : null;
};

const withPendingNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseGitHubNotificationSubjectTarget(item.subject);
    if (!target) {
      return {
        ...item,
        subject: item.subject
          ? {
              ...item.subject,
              stateStatus: 'unavailable' as const,
            }
          : item.subject,
      };
    }

    return {
      ...item,
      subject: {
        ...item.subject,
        number: target.number,
        state: undefined,
        stateStatus: toNotificationSubjectStateTarget(target)
          ? ('pending' as const)
          : ('unavailable' as const),
      },
    };
  });
};

const collectUniqueNotificationSubjectTargets = (items: DashboardNotification[]) => {
  const targetsByKey = new Map<string, NotificationSubjectStateTarget>();

  for (const item of items) {
    const target = parseNotificationSubjectStateTarget(item);
    if (target) {
      targetsByKey.set(target.key, target);
    }
  }

  return Array.from(targetsByKey.values());
};

const shouldEnrichNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.some((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return false;

    return item.subject?.stateStatus !== 'loaded';
  });
};

const applyNotificationSubjectStates = (
  items: DashboardNotification[],
  states: NotificationSubjectStateResult[]
) => {
  const statesByKey = new Map(states.map((item) => [item.key, item]));

  return items.map((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return item;

    const result = statesByKey.get(target.key);
    return {
      ...item,
      subject: {
        ...item.subject,
        state: result?.state,
        labels: result?.labels,
        authorLogin: result?.authorLogin,
        authorAvatarUrl: result?.authorAvatarUrl,
        stateStatus: result?.state ? ('loaded' as const) : ('error' as const),
      },
    };
  });
};

const markNotificationSubjectStateErrors = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return item;

    return {
      ...item,
      subject: {
        ...item.subject,
        stateStatus: 'error' as const,
      },
    };
  });
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

const buildCustomTabUrl = (
  path: string,
  page: number,
  query: GitHubSearchQuery,
  perPage = defaultPerPage
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(query.perPage ?? perPage),
  });
  appendCustomTabQueryParams(searchParams, query);

  return `${path}?${searchParams.toString()}`;
};

export function useGithubData() {
  const apiFetch = useGitPulseApiFetch();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);
  const activeNotificationRequestId = ref(0);
  const activeNotificationStateRequestId = ref(0);
  const pageCache = ref(createPageCache());
  const notificationStreamCache = ref<Record<string, NotificationStreamCache>>({});
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

  const applyNotificationsData = (data: PaginatedDashboardResponse<DashboardNotification>) => {
    notifications.value = data.items;
    pagination.value.notifications = data.pagination;
  };

  const enrichNotificationSubjectStates = async (
    queryKey: string,
    page: number,
    items: DashboardNotification[],
    notificationRequestId: number
  ) => {
    const targets = collectUniqueNotificationSubjectTargets(items);
    if (targets.length === 0) return;

    const stateRequestId = activeNotificationStateRequestId.value + 1;
    activeNotificationStateRequestId.value = stateRequestId;

    try {
      const data = await apiFetch<{ items: NotificationSubjectStateResult[] }>(
        '/api/notifications/subject-states',
        {
          method: 'POST',
          body: { targets },
        }
      );

      if (
        notificationRequestId !== activeNotificationRequestId.value ||
        stateRequestId !== activeNotificationStateRequestId.value
      ) {
        return;
      }

      const cachedData = pageCache.value.notifications[queryKey]?.[page];
      if (!cachedData) return;

      const enrichedItems = applyNotificationSubjectStates(cachedData.items, data.items);
      const enrichedData = {
        ...cachedData,
        items: enrichedItems,
      };

      const queryCache = pageCache.value.notifications[queryKey];
      if (!queryCache) return;

      queryCache[page] = enrichedData;
      applyNotificationsData(enrichedData);
    } catch (err) {
      if (
        notificationRequestId !== activeNotificationRequestId.value ||
        stateRequestId !== activeNotificationStateRequestId.value
      ) {
        return;
      }

      const cachedData = pageCache.value.notifications[queryKey]?.[page];
      if (!cachedData) return;

      const erroredData = {
        ...cachedData,
        items: markNotificationSubjectStateErrors(cachedData.items),
      };

      const queryCache = pageCache.value.notifications[queryKey];
      if (!queryCache) return;

      queryCache[page] = erroredData;
      applyNotificationsData(erroredData);
      console.error('Error enriching notification subject states:', err);
    }
  };

  const enrichNotificationItems = async (items: DashboardNotification[]) => {
    const pendingItems = withPendingNotificationSubjectStates(items);
    const targets = collectUniqueNotificationSubjectTargets(pendingItems);
    if (targets.length === 0) return pendingItems;

    try {
      const responses = await Promise.all(
        chunkItems(targets, notificationSubjectStateChunkSize).map((chunk) =>
          apiFetch<{ items: NotificationSubjectStateResult[] }>(
            '/api/notifications/subject-states',
            {
              method: 'POST',
              body: { targets: chunk },
            }
          )
        )
      );

      return applyNotificationSubjectStates(
        pendingItems,
        responses.flatMap((response) => response.items)
      );
    } catch (err) {
      console.error('Error enriching notification subject states:', err);
      return markNotificationSubjectStateErrors(pendingItems);
    }
  };

  const fetchNotificationRawPage = async (
    page: number,
    notificationParams: Record<string, boolean | string | undefined>
  ): Promise<{ page: number; items: DashboardNotification[]; hasNext: boolean }> => {
    const data = await apiFetch<PaginatedDashboardResponse<DashboardNotification>>(
      buildPaginationUrl('/api/notifications', page, notificationApiPerPage, notificationParams)
    );

    return {
      page: data.pagination.page,
      items: await enrichNotificationItems(data.items),
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
    localFilters: NotificationFilterAdapter['local'],
    targetPage: number
  ) => {
    const requiredItemCount = Math.max(
      targetPage * defaultPerPage - cache.filteredItems.length,
      defaultPerPage
    );
    const batchSize = getNotificationBatchSize(cache, requiredItemCount);
    const pages = Array.from({ length: batchSize }, (_, index) => cache.nextRawPage + index);
    const fetchedPages = (
      await Promise.all(
        pages.map((rawPage) => fetchNotificationRawPage(rawPage, notificationParams))
      )
    ).sort((left, right) => left.page - right.page);

    let matchedItems = 0;
    for (const rawPage of fetchedPages) {
      cache.rawPages[rawPage.page] = {
        items: rawPage.items,
        hasNext: rawPage.hasNext,
      };
      matchedItems += applyNotificationLocalFilters(rawPage.items, localFilters).length;
    }

    const lastFetchedPage = fetchedPages[fetchedPages.length - 1];
    if (lastFetchedPage) {
      cache.nextRawPage = Math.max(cache.nextRawPage, lastFetchedPage.page + 1);
      cache.hasMoreRawPages = fetchedPages.every((rawPage) => rawPage.hasNext);
      cache.lastMatchesPerRawPage = matchedItems / fetchedPages.length;
    }

    rebuildNotificationFilteredItems(cache, localFilters);
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
    notificationParams: Record<string, boolean | string | undefined>,
    notificationRequestId: number
  ) => {
    const queryKey = buildParamQueryKey(notificationParams);
    const queryCache = pageCache.value.notifications[queryKey] ?? {};
    const cachedData = queryCache[page];

    if (cachedData && !options.force) {
      touchNotificationCache(queryKey, page);
      applyNotificationsData(cachedData);
      if (shouldEnrichNotificationSubjectStates(cachedData.items)) {
        void enrichNotificationSubjectStates(
          queryKey,
          page,
          cachedData.items,
          notificationRequestId
        );
      }
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardNotification>>(
        buildPaginationUrl('/api/notifications', page, defaultPerPage, notificationParams)
      );
      if (requestId !== activeRequestId.value) return;

      const pendingData = {
        ...data,
        items: withPendingNotificationSubjectStates(data.items),
      };

      if (!pageCache.value.notifications[queryKey]) {
        pageCache.value.notifications[queryKey] = {};
      }

      pageCache.value.notifications[queryKey][data.pagination.page] = pendingData;
      touchNotificationCache(queryKey, data.pagination.page);
      applyNotificationsData(pendingData);
      void enrichNotificationSubjectStates(
        queryKey,
        data.pagination.page,
        pendingData.items,
        notificationRequestId
      );
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
    const notificationRequestId = activeNotificationRequestId.value + 1;
    activeNotificationRequestId.value = notificationRequestId;

    if (!hasNotificationPageLocalPredicates(localFilters)) {
      await fetchLegacyNotifications(page, options, notificationParams, notificationRequestId);
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
      touchNotificationCache(queryKey, page);
      applyNotificationsData(cachedData);
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      if (streamCache.filteredItems.length < page * defaultPerPage && streamCache.hasMoreRawPages) {
        await fetchNotificationBatch(streamCache, notificationParams, localFilters, page);
      }

      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.notifications[queryKey]) {
        pageCache.value.notifications[queryKey] = {};
      }

      const data = buildNotificationDisplayPage(streamCache, page);
      pageCache.value.notifications[queryKey][page] = data;
      touchNotificationCache(queryKey, page);
      applyNotificationsData(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
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

    try {
      // Built-in issue tabs use GitHub Search when query-level filters are available.
      const url = options.query
        ? buildCustomTabUrl('/api/search/issues', page, options.query)
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

    try {
      // Built-in PR tabs use GitHub Search when query-level filters are available.
      const url = options.query
        ? buildCustomTabUrl('/api/search/issues', page, options.query)
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

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildCustomTabUrl('/api/search/issues', page, query)
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
  };
}
