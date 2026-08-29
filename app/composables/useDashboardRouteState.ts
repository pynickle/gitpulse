import type { LocationQueryRaw } from 'vue-router';

import getQueryParamValue from '../utils/getQueryParamValue';
import { RELEASE_TIMELINE_TAB, type DashboardRootTab, type DashboardTab } from './useDashboardTabs';

export const dashboardTabs: DashboardTab[] = ['todos', 'notifications', 'issues', 'pulls', 'repos'];

export const dashboardRootTabs: DashboardRootTab[] = [...dashboardTabs, RELEASE_TIMELINE_TAB];

export const isDashboardListTab = (tab: string): tab is DashboardTab => {
  return dashboardTabs.includes(tab as DashboardTab);
};

export const parseDashboardTab = (value: unknown): DashboardRootTab => {
  const tab = getQueryParamValue(value);
  return dashboardRootTabs.includes(tab as DashboardRootTab)
    ? (tab as DashboardRootTab)
    : 'notifications';
};

export const parseDashboardPage = (value: unknown) => {
  const rawValue = getQueryParamValue(value);

  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return 1;
  }

  const parsedPage = Number.parseInt(rawValue, 10);
  return Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
};

export const buildDashboardQuery = (query: LocationQueryRaw) => {
  const nextQuery: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
};
