import { describe, expect, mock, test } from 'bun:test';

import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const { buildCustomTabSummary, customTabIssueStateOptions, customTabPullStateOptions } =
  await import('../app/composables/useCustomTabSettingsOptions');

const t = (key: string, params?: Record<string, string>) => {
  const messages: Record<string, string> = {
    'dashboard.tabsSettings.options.open': 'Open',
    'dashboard.tabsSettings.options.closed': 'Closed',
    'dashboard.tabsSettings.options.merged': 'Merged',
    'dashboard.tabsSettings.summary.pullRequests': 'pull requests',
    'dashboard.tabsSettings.summary.issues': 'issues',
  };

  if (key === 'dashboard.tabsSettings.summary.state') {
    return `state ${params?.value ?? ''}`;
  }

  if (key === 'dashboard.tabsSettings.summary.showing') {
    return `Showing ${params?.value ?? ''}`;
  }

  return messages[key] ?? key;
};

describe('custom tab settings options', () => {
  test('exposes merged state only for pull requests', () => {
    expect(customTabIssueStateOptions.map((option) => option.value)).toEqual([
      'open',
      'closed',
      'all',
    ]);
    expect(customTabPullStateOptions.map((option) => option.value)).toEqual([
      'open',
      'closed',
      'merged',
      'all',
    ]);
  });

  test('summarizes pull request states including merged', () => {
    expect(buildCustomTabSummary({ type: 'pulls', state: 'merged' }, t)).toBe(
      'Showing pull requests, state Merged'
    );
    expect(buildCustomTabSummary({ type: 'pulls', state: 'closed' }, t)).toBe(
      'Showing pull requests, state Closed'
    );
    expect(buildCustomTabSummary({ type: 'issues', state: 'open' }, t)).toBe(
      'Showing issues, state Open'
    );
    expect(buildCustomTabSummary({ type: 'pulls', state: 'all' }, t)).toBe('Showing pull requests');
    expect(buildCustomTabSummary({ type: 'pulls' }, t)).toBe('Showing pull requests');
  });
});
