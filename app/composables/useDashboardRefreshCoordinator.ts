import { computed, type MaybeRefOrGetter, toValue } from 'vue';

import type { CustomTab, GitHubSearchQuery } from './useCustomTabs';
import {
  createCustomTabPreviewSearchParams,
  getCustomTabEndpointPath,
} from './useCustomTabSettingsOptions';
import type { DashboardFilterSourceState } from './useDashboardFilters';
import type { DashboardTab } from './useDashboardTabs';
import { useRefreshableView } from './useRefreshableView';

interface FreshnessResponse {
  signature: string;
  pollIntervalMs?: number;
}

type ApiFetch = <T>(request: string) => Promise<T>;

interface DashboardRefreshCoordinatorOptions {
  apiFetch: ApiFetch;
  currentTab: MaybeRefOrGetter<DashboardTab>;
  currentPage: MaybeRefOrGetter<number>;
  currentRouteTabId: MaybeRefOrGetter<string>;
  selectedCustomTab: MaybeRefOrGetter<CustomTab | null>;
  filterSourceStates: MaybeRefOrGetter<Record<DashboardTab, DashboardFilterSourceState>>;
  routeFilterFetchKey: MaybeRefOrGetter<string>;
  issuePrQuery?: MaybeRefOrGetter<GitHubSearchQuery | undefined>;
  pullRequestQuery?: MaybeRefOrGetter<GitHubSearchQuery | undefined>;
  hasVisibleDetail: MaybeRefOrGetter<boolean>;
  currentDetailRefreshKey: MaybeRefOrGetter<string>;
  currentDetailFreshnessUrl: MaybeRefOrGetter<string>;
  dashboardListLoading: MaybeRefOrGetter<boolean>;
  detailLoading: MaybeRefOrGetter<boolean>;
  sessionReady: MaybeRefOrGetter<boolean>;
  loggedIn: MaybeRefOrGetter<boolean>;
  isDashboardChildRoute: MaybeRefOrGetter<boolean>;
  showFileBrowsingView: MaybeRefOrGetter<boolean>;
  refreshCurrentDetail: () => Promise<void>;
  refreshCurrentTab: () => Promise<void>;
}

const buildUrlWithParams = (path: string, params: Record<string, boolean | string | undefined>) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const buildSearchFreshnessUrl = (query: GitHubSearchQuery) => {
  return `${getCustomTabEndpointPath(query)}/freshness?${createCustomTabPreviewSearchParams(query, 1, 5).toString()}`;
};

export function useDashboardRefreshCoordinator(options: DashboardRefreshCoordinatorOptions) {
  const notificationFreshnessUrl = computed(() => {
    const notificationAdapter = toValue(options.filterSourceStates).notifications
      .notificationAdapter;
    const localFilters = notificationAdapter.local;

    return buildUrlWithParams('/api/notifications/freshness', {
      ...notificationAdapter.apiParams,
      read_state: localFilters.readState,
    });
  });

  const dashboardListFreshnessUrl = computed(() => {
    const customTab = toValue(options.selectedCustomTab);
    if (customTab) {
      return buildSearchFreshnessUrl(customTab.query);
    }

    const filterSourceStates = toValue(options.filterSourceStates);
    const currentTab = toValue(options.currentTab);
    if (currentTab === 'notifications') {
      return notificationFreshnessUrl.value;
    }

    if (currentTab === 'todos') {
      return '';
    }

    if (currentTab === 'issues') {
      const query = options.issuePrQuery ? toValue(options.issuePrQuery) : undefined;
      return query ? buildSearchFreshnessUrl(query) : '/api/issues/freshness';
    }

    if (currentTab === 'pulls') {
      const query = options.pullRequestQuery ? toValue(options.pullRequestQuery) : undefined;
      return query ? buildSearchFreshnessUrl(query) : '/api/pulls/freshness';
    }

    return '/api/repos/freshness';
  });

  const activeDashboardFreshnessUrl = computed(() => {
    return toValue(options.hasVisibleDetail)
      ? toValue(options.currentDetailFreshnessUrl)
      : dashboardListFreshnessUrl.value;
  });

  const activeDashboardRefreshKey = computed(() => {
    if (toValue(options.hasVisibleDetail)) {
      return toValue(options.currentDetailRefreshKey);
    }

    return JSON.stringify({
      tab: toValue(options.currentRouteTabId),
      page: toValue(options.currentPage),
      filters: toValue(options.routeFilterFetchKey),
    });
  });

  const fetchActiveDashboardFreshness = async () => {
    if (!activeDashboardFreshnessUrl.value) {
      return null;
    }

    return options.apiFetch<FreshnessResponse>(activeDashboardFreshnessUrl.value);
  };

  const refreshActiveDashboardSurface = async () => {
    if (toValue(options.hasVisibleDetail)) {
      await options.refreshCurrentDetail();
      return;
    }

    await options.refreshCurrentTab();
  };

  const activeDashboardLoading = computed(() => {
    return toValue(options.hasVisibleDetail)
      ? toValue(options.detailLoading)
      : toValue(options.dashboardListLoading);
  });

  const enabled = computed(() => {
    return (
      import.meta.client &&
      toValue(options.sessionReady) &&
      toValue(options.loggedIn) &&
      !toValue(options.isDashboardChildRoute) &&
      !toValue(options.showFileBrowsingView) &&
      Boolean(activeDashboardFreshnessUrl.value)
    );
  });

  const dashboardRefresh = useRefreshableView({
    refresh: refreshActiveDashboardSurface,
    checkFreshness: fetchActiveDashboardFreshness,
    freshnessKey: activeDashboardRefreshKey,
    enabled,
  });

  return {
    activeDashboardFreshnessUrl,
    activeDashboardRefreshKey,
    activeDashboardLoading,
    dashboardHasNewContent: dashboardRefresh.hasNewContent,
    dashboardRefreshing: dashboardRefresh.refreshing,
    dashboardChecking: dashboardRefresh.checking,
    checkDashboardFreshness: dashboardRefresh.checkForFreshness,
    refreshDashboard: dashboardRefresh.refreshNow,
  };
}
