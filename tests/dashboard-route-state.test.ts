import { describe, expect, test } from 'bun:test';

import {
  buildDashboardQuery,
  parseDashboardPage,
  parseDashboardTab,
} from '../app/composables/useDashboardRouteState';

describe('dashboard route state helpers', () => {
  test('parses dashboard tabs with notifications fallback', () => {
    expect(parseDashboardTab('issues')).toBe('issues');
    expect(parseDashboardTab(['pulls', 'issues'])).toBe('pulls');
    expect(parseDashboardTab('custom-tab-1')).toBe('notifications');
    expect(parseDashboardTab(undefined)).toBe('notifications');
  });

  test('does not swallow the Release Timeline tab as notifications', () => {
    expect(parseDashboardTab('release-timeline')).toBe('release-timeline');
    expect(parseDashboardTab(['release-timeline', 'issues'])).toBe('release-timeline');
  });

  test('parses positive integer pages only', () => {
    expect(parseDashboardPage('3')).toBe(3);
    expect(parseDashboardPage(['4'])).toBe(4);
    expect(parseDashboardPage('0')).toBe(1);
    expect(parseDashboardPage('-1')).toBe(1);
    expect(parseDashboardPage('2.5')).toBe(1);
    expect(parseDashboardPage('abc')).toBe(1);
  });

  test('drops empty route query values while preserving false and zero', () => {
    expect(
      buildDashboardQuery({
        tab: 'issues',
        page: 0,
        empty: '',
        nil: null,
        missing: undefined,
        flag: false,
      })
    ).toEqual({
      tab: 'issues',
      page: 0,
      flag: false,
    });
  });
});
