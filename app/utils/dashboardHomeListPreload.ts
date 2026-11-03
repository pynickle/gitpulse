import {
  createDashboardFilterSourceState,
  parseDashboardRouteFilters,
} from '../composables/useDashboardFilters';
import { parseDashboardPage } from '../composables/useDashboardRouteState';
import {
  buildCustomTabUrl,
  buildPaginationUrl,
  dashboardListPageSize,
} from './dashboardListRequest';
import { getQueryParamValue } from './getQueryParamValue';
import { isDashboardRootPath } from './navigationEntryRouting';
import { parseGitHubRepoPath } from './parseGitHubRepoPath';

export interface DashboardHomeListPreloadRoute {
  path: string;
  query: Record<string, unknown>;
}

export type DashboardHomeListPreload = {
  rel: 'preload';
  as: 'fetch';
  href: string;
  crossorigin: 'anonymous';
};

const preloadListTabs = ['notifications', 'issues', 'pulls', 'repos'] as const;

type PreloadListTab = (typeof preloadListTabs)[number];

const isPreloadListTab = (tab: string): tab is PreloadListTab => {
  return preloadListTabs.includes(tab as PreloadListTab);
};

const isFileBrowsingQuery = (query: Record<string, unknown>) => {
  const repo = getQueryParamValue(query.repo);
  return Boolean(repo && parseGitHubRepoPath(repo) && Object.hasOwn(query, 'path'));
};

const resolvePreloadListTab = (query: Record<string, unknown>): PreloadListTab | null => {
  const tab = getQueryParamValue(query.tab);
  if (!tab) return 'notifications';
  return isPreloadListTab(tab) ? tab : null;
};

const listHref = (
  tab: PreloadListTab,
  page: number,
  query: Record<string, unknown>,
  userLogin?: string
) => {
  const filters = parseDashboardRouteFilters(query);

  if (tab === 'notifications') {
    const source = createDashboardFilterSourceState('notifications', filters);
    return buildPaginationUrl(
      '/api/notifications',
      page,
      dashboardListPageSize,
      source.notificationAdapter.apiParams
    );
  }

  if (tab === 'repos') {
    return buildPaginationUrl('/api/repos', page);
  }

  const source = createDashboardFilterSourceState(tab, filters, userLogin);
  if (!source.issuePrQuery) return null;

  return buildCustomTabUrl(page, source.issuePrQuery);
};

export function resolveDashboardHomeListPreload(
  route: DashboardHomeListPreloadRoute,
  userLogin?: string
): DashboardHomeListPreload | null {
  if (!isDashboardRootPath(route.path) || isFileBrowsingQuery(route.query)) {
    return null;
  }

  const tab = resolvePreloadListTab(route.query);
  if (!tab) return null;

  const href = listHref(tab, parseDashboardPage(route.query.page), route.query, userLogin);
  if (!href) return null;

  return {
    rel: 'preload',
    as: 'fetch',
    href,
    crossorigin: 'anonymous',
  };
}
