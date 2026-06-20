import { describe, expect, mock, test } from 'bun:test';

import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const { buildCustomTabSummary, customTabEndpointOptions } =
  await import('../app/composables/useCustomTabSettingsOptions');

const t = (key: string, params?: Record<string, string>) => {
  const messages: Record<string, string> = {
    'dashboard.tabsSettings.options.open': 'Open',
    'dashboard.tabsSettings.options.closed': 'Closed',
    'dashboard.tabsSettings.options.merged': 'Merged',
    'dashboard.tabsSettings.summary.pullRequests': 'pull requests',
    'dashboard.tabsSettings.summary.issues': 'issues',
    'dashboard.tabsSettings.endpoint.issues': 'issues',
    'dashboard.tabsSettings.endpoint.repositories': 'repositories',
  };

  if (key === 'dashboard.tabsSettings.summary.state') {
    return `state ${params?.value ?? ''}`;
  }

  if (key === 'dashboard.tabsSettings.summary.query') {
    return `query ${params?.value ?? ''}`;
  }

  if (key === 'dashboard.tabsSettings.summary.showing') {
    return `Showing ${params?.value ?? ''}`;
  }

  return messages[key] ?? key;
};

describe('custom tab settings options', () => {
  test('exposes all supported GitHub Search endpoints with issues first', () => {
    expect(customTabEndpointOptions.map((option) => option.value)).toEqual([
      'issues',
      'repositories',
    ]);
  });

  test('summarizes pull request states including merged', () => {
    expect(buildCustomTabSummary({ type: 'pulls', state: 'merged' }, t)).toBe(
      'Showing issues, state Merged'
    );
    expect(buildCustomTabSummary({ type: 'pulls', state: 'closed' }, t)).toBe(
      'Showing issues, state Closed'
    );
    expect(buildCustomTabSummary({ type: 'issues', state: 'open' }, t)).toBe(
      'Showing issues, state Open'
    );
    expect(buildCustomTabSummary({ type: 'pulls', state: 'all' }, t)).toBe('Showing issues');
    expect(buildCustomTabSummary({ type: 'pulls' }, t)).toBe('Showing issues');
    expect(
      buildCustomTabSummary({ endpoint: 'repositories', type: 'issues', syntax: 'topic:nuxt' }, t)
    ).toBe('Showing repositories, query topic:nuxt');
  });
});
