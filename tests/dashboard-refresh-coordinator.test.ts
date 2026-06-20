import { describe, expect, mock, test } from 'bun:test';

import { computed, ref } from 'vue';

import { createDashboardFilterSourceState } from '../app/composables/useDashboardFilters';
import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const { useDashboardRefreshCoordinator } =
  await import('../app/composables/useDashboardRefreshCoordinator');

const createFilterSourceStates = () =>
  computed(() => ({
    todos: createDashboardFilterSourceState('todos', { labels: [] }),
    notifications: createDashboardFilterSourceState('notifications', {
      labels: [],
      state: 'read',
      repo: 'owner/repo',
      reason: 'mention',
      subjectType: 'Issue',
    }),
    issues: createDashboardFilterSourceState('issues', { labels: [] }, 'octocat'),
    pulls: createDashboardFilterSourceState('pulls', { labels: [] }, 'octocat'),
    repos: createDashboardFilterSourceState('repos', { labels: [] }, 'octocat'),
  }));

describe('dashboard refresh coordinator', () => {
  test('switches freshness URL and key between list and detail surfaces', async () => {
    const fetchedUrls: string[] = [];
    let listRefreshCount = 0;
    let detailRefreshCount = 0;
    const hasVisibleDetail = ref(false);
    const coordinator = useDashboardRefreshCoordinator({
      apiFetch: async (request) => {
        fetchedUrls.push(request);
        return { signature: request };
      },
      currentTab: ref('notifications'),
      currentPage: ref(2),
      currentRouteTabId: ref('notifications'),
      selectedCustomTab: ref(null),
      filterSourceStates: createFilterSourceStates(),
      routeFilterFetchKey: ref('filters-a'),
      hasVisibleDetail,
      currentDetailRefreshKey: ref('issue-owner-repo-1'),
      currentDetailFreshnessUrl: ref('/api/issues/owner/repo/1/freshness'),
      dashboardListLoading: ref(false),
      detailLoading: ref(false),
      sessionReady: ref(true),
      loggedIn: ref(true),
      isDashboardChildRoute: ref(false),
      showFileBrowsingView: ref(false),
      refreshCurrentDetail: async () => {
        detailRefreshCount += 1;
      },
      refreshCurrentTab: async () => {
        listRefreshCount += 1;
      },
    });

    expect(coordinator.activeDashboardFreshnessUrl.value).toBe(
      '/api/notifications/freshness?all=true&read_state=read'
    );
    expect(coordinator.activeDashboardRefreshKey.value).toBe(
      JSON.stringify({
        tab: 'notifications',
        page: 2,
        filters: 'filters-a',
      })
    );

    await coordinator.refreshDashboard();

    expect(listRefreshCount).toBe(1);
    expect(detailRefreshCount).toBe(0);
    expect(fetchedUrls.at(-1)).toBe(coordinator.activeDashboardFreshnessUrl.value);

    hasVisibleDetail.value = true;

    expect(coordinator.activeDashboardFreshnessUrl.value).toBe(
      '/api/issues/owner/repo/1/freshness'
    );
    expect(coordinator.activeDashboardRefreshKey.value).toBe('issue-owner-repo-1');

    await coordinator.refreshDashboard();

    expect(listRefreshCount).toBe(1);
    expect(detailRefreshCount).toBe(1);
    expect(fetchedUrls.at(-1)).toBe('/api/issues/owner/repo/1/freshness');
  });

  test('custom tab freshness uses the saved query without dashboard filter overlays', async () => {
    const selectedCustomTab = ref({
      id: 'custom-review',
      groupId: 'default',
      name: 'Custom review',
      source: 'github-search' as const,
      subtitleMode: 'none' as const,
      query: {
        endpoint: 'repositories' as const,
        syntax: 'repo:saved/repo state:open',
        type: 'pulls' as const,
        repo: 'saved/repo',
        state: 'open' as const,
      },
    });

    const coordinator = useDashboardRefreshCoordinator({
      apiFetch: async (request) => ({ signature: request }),
      currentTab: ref('issues'),
      currentPage: ref(1),
      currentRouteTabId: ref('custom-review'),
      selectedCustomTab,
      filterSourceStates: computed(() => ({
        ...createFilterSourceStates().value,
        pulls: createDashboardFilterSourceState('pulls', {
          labels: ['route-label'],
          repo: 'route/repo',
          state: 'merged',
        }),
      })),
      routeFilterFetchKey: ref('route-filters'),
      hasVisibleDetail: ref(false),
      currentDetailRefreshKey: ref(''),
      currentDetailFreshnessUrl: ref(''),
      dashboardListLoading: ref(false),
      detailLoading: ref(false),
      sessionReady: ref(true),
      loggedIn: ref(true),
      isDashboardChildRoute: ref(false),
      showFileBrowsingView: ref(false),
      refreshCurrentDetail: async () => {},
      refreshCurrentTab: async () => {},
    });

    expect(coordinator.activeDashboardFreshnessUrl.value).toContain(
      '/api/search/repositories/freshness?'
    );
    expect(coordinator.activeDashboardFreshnessUrl.value).toContain(
      'q=repo%3Asaved%2Frepo+state%3Aopen'
    );
    expect(coordinator.activeDashboardFreshnessUrl.value).not.toContain('route%2Frepo');
    expect(coordinator.activeDashboardFreshnessUrl.value).not.toContain('merged');
    expect(coordinator.activeDashboardFreshnessUrl.value).not.toContain('route-label');
  });
});
