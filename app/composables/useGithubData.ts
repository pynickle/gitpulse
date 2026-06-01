import { ref } from 'vue';

import type {
  DashboardNotification,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';
import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
import type { CustomTabQuery, CustomTabSource } from '~/composables/useCustomTabs';
import type { DashboardTab } from '~/composables/useDashboardTabs';

interface DashboardEntity {
  id: PropertyKey;
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

interface DashboardRepo {
  id: PropertyKey;
  name?: string;
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
}

interface DashboardPageCache {
  notifications: Record<number, PaginatedDashboardResponse<DashboardNotification>>;
  issues: Record<number, PaginatedDashboardResponse<DashboardEntity>>;
  pulls: Record<number, PaginatedDashboardResponse<DashboardEntity>>;
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

const buildPaginationUrl = (path: string, page: number, perPage = defaultPerPage) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  return `${path}?${searchParams.toString()}`;
};

const parseNotificationSubjectTarget = (
  notification: DashboardNotification
): NotificationSubjectStateTarget | null => {
  const subjectType = notification.subject?.type;
  if (subjectType !== 'Issue' && subjectType !== 'PullRequest') return null;

  const url = notification.subject?.url;
  if (!url) return null;

  const match = url.match(/repos\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)/);
  if (!match) return null;

  const [, owner, repo, type, number] = match;
  const parsedNumber = Number.parseInt(number ?? '', 10);
  if (
    !owner ||
    !repo ||
    !Number.isSafeInteger(parsedNumber) ||
    parsedNumber < 1 ||
    (type !== 'issues' && type !== 'pulls')
  )
    return null;

  return {
    key: `${owner}/${repo}/${type}/${parsedNumber}`,
    owner,
    repo,
    type,
    number: parsedNumber,
  };
};

const withPendingNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseNotificationSubjectTarget(item);
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
        state: undefined,
        stateStatus: 'pending' as const,
      },
    };
  });
};

const collectUniqueNotificationSubjectTargets = (items: DashboardNotification[]) => {
  const targetsByKey = new Map<string, NotificationSubjectStateTarget>();

  for (const item of items) {
    const target = parseNotificationSubjectTarget(item);
    if (target) {
      targetsByKey.set(target.key, target);
    }
  }

  return Array.from(targetsByKey.values());
};

const shouldEnrichNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.some((item) => {
    const target = parseNotificationSubjectTarget(item);
    if (!target) return false;

    return item.subject?.stateStatus !== 'loaded';
  });
};

const applyNotificationSubjectStates = (
  items: DashboardNotification[],
  states: NotificationSubjectStateResult[]
) => {
  const statesByKey = new Map(states.map((item) => [item.key, item.state]));

  return items.map((item) => {
    const target = parseNotificationSubjectTarget(item);
    if (!target) return item;

    const state = statesByKey.get(target.key);
    return {
      ...item,
      subject: {
        ...item.subject,
        state,
        stateStatus: state ? ('loaded' as const) : ('error' as const),
      },
    };
  });
};

const markNotificationSubjectStateErrors = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseNotificationSubjectTarget(item);
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
    notifications: [] as number[],
    issues: [] as number[],
    pulls: [] as number[],
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

  const touchCustomTabCache = (queryKey: string, page: number) => {
    const existingQueryIndex = pageCacheOrder.customTabs.indexOf(queryKey);
    if (existingQueryIndex >= 0) {
      pageCacheOrder.customTabs.splice(existingQueryIndex, 1);
    }

    pageCacheOrder.customTabs.push(queryKey);

    const queryCache = pageCache.value.customTabs[queryKey];
    if (queryCache) {
      const queryPageOrder = pageCacheOrder.customTabPages[queryKey] ?? [];
      pageCacheOrder.customTabPages[queryKey] = queryPageOrder;
      touchCachedPage(queryCache, queryPageOrder, page);
    }

    while (pageCacheOrder.customTabs.length > maxCachedCustomTabQueries) {
      const expiredQueryKey = pageCacheOrder.customTabs.shift();
      if (expiredQueryKey) {
        delete pageCache.value.customTabs[expiredQueryKey];
        delete pageCacheOrder.customTabPages[expiredQueryKey];
      }
    }
  };

  const applyNotificationsData = (data: PaginatedDashboardResponse<DashboardNotification>) => {
    notifications.value = data.items;
    pagination.value.notifications = data.pagination;
  };

  const enrichNotificationSubjectStates = async (
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

      const cachedData = pageCache.value.notifications[page];
      if (!cachedData) return;

      const enrichedItems = applyNotificationSubjectStates(cachedData.items, data.items);
      const enrichedData = {
        ...cachedData,
        items: enrichedItems,
      };

      pageCache.value.notifications[page] = enrichedData;
      applyNotificationsData(enrichedData);
    } catch (err) {
      if (
        notificationRequestId !== activeNotificationRequestId.value ||
        stateRequestId !== activeNotificationStateRequestId.value
      ) {
        return;
      }

      const cachedData = pageCache.value.notifications[page];
      if (!cachedData) return;

      const erroredData = {
        ...cachedData,
        items: markNotificationSubjectStateErrors(cachedData.items),
      };

      pageCache.value.notifications[page] = erroredData;
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
    const cachedData = pageCache.value.notifications[page];
    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.notifications, pageCacheOrder.notifications, page);
      applyNotificationsData(cachedData);
      if (shouldEnrichNotificationSubjectStates(cachedData.items)) {
        void enrichNotificationSubjectStates(
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
        buildPaginationUrl('/api/notifications', page)
      );
      if (requestId !== activeRequestId.value) return;

      const pendingData = {
        ...data,
        items: withPendingNotificationSubjectStates(data.items),
      };

      pageCache.value.notifications[data.pagination.page] = pendingData;
      touchCachedPage(
        pageCache.value.notifications,
        pageCacheOrder.notifications,
        data.pagination.page
      );
      applyNotificationsData(pendingData);
      void enrichNotificationSubjectStates(
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
    const cachedData = pageCache.value.issues[page];
    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.issues, pageCacheOrder.issues, page);
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
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildPaginationUrl('/api/issues', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.issues[data.pagination.page] = data;
      touchCachedPage(pageCache.value.issues, pageCacheOrder.issues, data.pagination.page);
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
    const cachedData = pageCache.value.pulls[page];
    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.pulls, pageCacheOrder.pulls, page);
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
      const data = await apiFetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildPaginationUrl('/api/pulls', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.pulls[data.pagination.page] = data;
      touchCachedPage(pageCache.value.pulls, pageCacheOrder.pulls, data.pagination.page);
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
