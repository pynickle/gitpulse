import { ref } from 'vue';

import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
import type { CustomTabQuery, CustomTabSource } from '~/composables/useCustomTabs';
import type { DashboardTab } from '~/composables/useDashboardTabs';

interface DashboardEntity {
  id: PropertyKey;
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

interface DashboardNotification {
  id: PropertyKey;
  subject?: {
    type?: string;
    url?: string;
  };
  repository?: {
    owner?: {
      avatar_url?: string;
      login?: string;
    };
    full_name?: string;
  };
  unread?: boolean;
  updated_at?: string;
  reason?: string;
  html_url?: string;
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
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);
  const pageCache = ref(createPageCache());
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

  const applyNotificationsData = (data: PaginatedDashboardResponse<DashboardNotification>) => {
    notifications.value = data.items;
    pagination.value.notifications = data.pagination;
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
      const data = await $fetch<PaginatedDashboardResponse<DashboardNotification>>(
        buildPaginationUrl('/api/notifications', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.notifications[data.pagination.page] = data;
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
    const cachedData = pageCache.value.issues[page];
    if (cachedData && !options.force) {
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
      const data = await $fetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildPaginationUrl('/api/issues', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.issues[data.pagination.page] = data;
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
      const data = await $fetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildPaginationUrl('/api/pulls', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.pulls[data.pagination.page] = data;
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
      const data = await $fetch<PaginatedDashboardResponse<DashboardRepo>>(
        buildPaginationUrl('/api/repos', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.repos[data.pagination.page] = data;
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
      const path = source === 'github-search' ? '/api/search/issues' : '/api/search/issues';
      const data = await $fetch<PaginatedDashboardResponse<DashboardEntity>>(
        buildCustomTabUrl(path, page, query)
      );
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.customTabs[queryKey]) {
        pageCache.value.customTabs[queryKey] = {};
      }

      pageCache.value.customTabs[queryKey][data.pagination.page] = data;
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
