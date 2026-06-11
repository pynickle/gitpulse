import { ref } from 'vue';

import type { CustomTabQuery, CustomTabSource } from '#shared/types/custom-search';
import type {
  DashboardNotification,
  NotificationSubjectState,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';
import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
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
  query?: CustomTabQuery;
  notificationParams?: Record<string, boolean | string | undefined>;
}

interface DashboardPageCache {
  notifications: Record<string, Record<number, PaginatedDashboardResponse<DashboardNotification>>>;
  issues: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
  pulls: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
  repos: Record<number, PaginatedDashboardResponse<DashboardRepo>>;
  customTabs: Record<string, Record<number, PaginatedDashboardResponse<DashboardEntity>>>;
}

const defaultPerPage = 20;
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
  query: CustomTabQuery = {},
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
  query: CustomTabQuery,
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
    maxCachedQueries = maxCachedCustomTabQueries
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
      }
    }
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

  const fetchNotifications = async (page = 1, options: DashboardFetchOptions = {}) => {
    const notificationParams = options.notificationParams ?? { all: true };
    const queryKey = buildParamQueryKey(notificationParams);
    const queryCache = pageCache.value.notifications[queryKey] ?? {};
    const cachedData = queryCache[page];
    if (cachedData && !options.force) {
      touchQueryCache(
        pageCache.value.notifications,
        pageCacheOrder.notifications,
        pageCacheOrder.notificationPages,
        queryKey,
        page
      );
      applyNotificationsData(cachedData);
      if (shouldEnrichNotificationSubjectStates(cachedData.items)) {
        void enrichNotificationSubjectStates(
          queryKey,
          page,
          cachedData.items,
          activeNotificationRequestId.value
        );
      }
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    const notificationRequestId = activeNotificationRequestId.value + 1;
    activeRequestId.value = requestId;
    activeNotificationRequestId.value = notificationRequestId;
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
      touchQueryCache(
        pageCache.value.notifications,
        pageCacheOrder.notifications,
        pageCacheOrder.notificationPages,
        queryKey,
        data.pagination.page
      );
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
    query: CustomTabQuery = {},
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
