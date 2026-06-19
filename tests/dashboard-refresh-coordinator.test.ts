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
      getCustomTabFilterSource: (query) => (query.type === 'pulls' ? 'pulls' : 'issues'),
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
});
