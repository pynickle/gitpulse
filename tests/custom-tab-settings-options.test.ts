import { describe, expect, mock, test } from 'bun:test';

import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const {
  applyCustomTabEditorState,
  buildCustomTabSummary,
  customTabIssueStateOptions,
  customTabPullStateOptions,
  getCustomTabEditorState,
} = await import('../app/composables/useCustomTabSettingsOptions');

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
  test('uses one no-state option and exposes merged only for pull requests', () => {
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

  test('maps editor state to GitHub pull request search qualifiers', () => {
    expect(applyCustomTabEditorState({ type: 'pulls' }, 'merged')).toEqual({
      type: 'pulls',
      state: 'closed',
      merged: 'merged',
    });

    expect(applyCustomTabEditorState({ type: 'pulls' }, 'closed')).toEqual({
      type: 'pulls',
      state: 'closed',
      merged: 'unmerged',
    });

    expect(applyCustomTabEditorState({ type: 'pulls', merged: 'merged' }, 'all')).toEqual({
      type: 'pulls',
      state: 'all',
    });
  });

  test('projects saved pull request merge qualifiers back to editor state and summaries', () => {
    expect(getCustomTabEditorState({ type: 'pulls', state: 'closed', merged: 'merged' })).toBe(
      'merged'
    );
    expect(getCustomTabEditorState({ type: 'pulls', state: 'closed', merged: 'unmerged' })).toBe(
      'closed'
    );
    expect(getCustomTabEditorState({ type: 'pulls' })).toBe('all');

    expect(buildCustomTabSummary({ type: 'pulls', state: 'closed', merged: 'merged' }, t)).toBe(
      'Showing pull requests, state Merged'
    );
  });
});
