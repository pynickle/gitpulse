import { describe, expect, test } from 'bun:test';

import {
  applyNotificationLocalFilters,
  buildBuiltinIssuePrFilterQuery,
  createDashboardEffectiveFilters,
  createDashboardFilterPatchForSource,
  createDashboardFilterChips,
  createDashboardFilterSourceState,
  buildNotificationFilterAdapter,
  clearDashboardRouteFilters,
  clearDashboardSourceFilters,
  hasNotificationPageLocalPredicates,
  isIssuePrQueryFiltered,
  parseDashboardRouteFilters,
  serializeDashboardRouteFilters,
  sourceUsesDashboardTodoSortControls,
} from '../app/composables/useDashboardFilters';

describe('dashboard route filters', () => {
  test('drops the unsupported notification read state from the route', () => {
    expect(parseDashboardRouteFilters({ f_state: 'read' })).toEqual({
      state: undefined,
      repo: undefined,
      author: undefined,
      labels: [],
      subjectType: undefined,
      review: undefined,
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  test('normalizes route filters and drops invalid values', () => {
    expect(
      parseDashboardRouteFilters({
        f_state: 'merged',
        f_repo: ' owner/repo ',
        f_labels: ' bug, ,needs triage ',
        f_reason: 'mention',
        f_subject_state: 'merged',
        f_review: 'invalid',
        f_order: 'sideways',
      })
    ).toEqual({
      state: 'merged',
      repo: 'owner/repo',
      author: undefined,
      labels: ['bug', 'needs triage'],
      subjectType: undefined,
      review: undefined,
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  test('serializes only namespaced filter keys and clear preserves detail keys', () => {
    expect(
      serializeDashboardRouteFilters({
        state: 'closed',
        repo: 'owner/repo',
        labels: ['bug'],
        sort: 'created',
      })
    ).toEqual({
      f_state: 'closed',
      f_repo: 'owner/repo',
      f_labels: 'bug',
      f_sort: 'created',
    });

    expect(
      clearDashboardRouteFilters({
        tab: 'issues',
        page: 3,
        repo: 'detail/repo',
        path: 'src/index.ts',
        f_repo: 'filter/repo',
        f_state: 'closed',
      })
    ).toEqual({
      tab: 'issues',
      repo: 'detail/repo',
      path: 'src/index.ts',
    });
  });

  test('keeps notification filters limited to GitHub all and unread params', () => {
    expect(
      buildNotificationFilterAdapter('notifications', {
        state: 'all',
        repo: 'owner/repo',
        author: 'octocat',
        labels: ['bug'],
        subjectType: 'Issue',
      })
    ).toEqual({
      apiParams: { all: true },
      local: {
        readState: undefined,
      },
      usesPageLocalPredicates: false,
    });

    expect(
      buildNotificationFilterAdapter('notifications', { state: 'unread', labels: [] }).apiParams
    ).toEqual({ all: undefined });
    expect(
      buildNotificationFilterAdapter('notifications', { state: 'unread', labels: [] })
        .usesPageLocalPredicates
    ).toBe(false);
    const allAdapter = buildNotificationFilterAdapter('notifications', {
      state: 'all',
      labels: [],
    });
    expect(allAdapter.apiParams).toEqual({ all: true });
    expect(allAdapter.usesPageLocalPredicates).toBe(false);
    expect(hasNotificationPageLocalPredicates(allAdapter.local)).toBe(false);
  });

  test('omits advanced filters from active notification filters', () => {
    const sourceState = createDashboardFilterSourceState('notifications', {
      state: 'unread',
      repo: 'owner/repo',
      author: 'octocat',
      labels: ['bug'],
      subjectType: 'Issue',
    });

    expect(sourceState.filters).toEqual({
      labels: [],
      state: 'unread',
    });
    expect(sourceState.chips.map((chip) => chip.key)).toEqual(['state']);
    expect(sourceState.notificationAdapter.local).toEqual({
      readState: 'unread',
    });
  });

  test('todo filters omit read state and keep todo sort controls', () => {
    const sourceState = createDashboardFilterSourceState('todos', {
      state: 'unread',
      repo: 'owner/repo',
      author: 'octocat',
      labels: ['bug'],
      subjectType: 'PullRequest',
      sort: 'updated',
      order: 'asc',
    });

    expect(sourceState.filters).toEqual({
      labels: [],
      repo: 'owner/repo',
      subjectType: 'PullRequest',
      sort: 'updated',
      order: 'asc',
    });
    expect(sourceState.chips.map((chip) => chip.key)).toEqual([
      'repo',
      'subjectType',
      'sort',
      'order',
    ]);
    expect(sourceState.hasActiveFilters).toBe(true);
    expect(sourceState.notificationAdapter.local).toEqual({
      repo: 'owner/repo',
      subjectType: 'PullRequest',
    });
  });

  test('todo sort controls are only available on the todo source', () => {
    expect(sourceUsesDashboardTodoSortControls('todos')).toBe(true);
    expect(sourceUsesDashboardTodoSortControls('issues')).toBe(false);
    expect(sourceUsesDashboardTodoSortControls('pulls')).toBe(false);
    expect(sourceUsesDashboardTodoSortControls('notifications')).toBe(false);
    expect(sourceUsesDashboardTodoSortControls('repos')).toBe(false);
  });

  test('drops source-inapplicable filters from active issue filters and chips', () => {
    const issueFilters = createDashboardEffectiveFilters('issues', {
      state: 'unread',
      review: 'approved',
      labels: [],
    });

    expect(issueFilters).toEqual({
      labels: [],
      repo: undefined,
      author: undefined,
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(isIssuePrQueryFiltered(issueFilters)).toBe(false);
    expect(createDashboardFilterChips(issueFilters)).toEqual([]);
  });

  test('canonicalizes explicit built-in issue defaults out of active chips but keeps search query', () => {
    const sourceState = createDashboardFilterSourceState(
      'issues',
      {
        state: 'open',
        archived: 'exclude',
        sort: 'updated',
        order: 'desc',
        labels: [],
      },
      'octocat'
    );

    expect(sourceState.chips).toEqual([]);
    expect(sourceState.hasActiveFilters).toBe(false);
    expect(sourceState.issuePrQuery).toEqual({
      type: 'issues',
      state: 'open',
      archived: 'exclude',
      sort: 'updated',
      order: 'desc',
      involves: 'octocat',
    });
  });

  test('clears only filters visible for the active source', () => {
    expect(
      clearDashboardSourceFilters('issues', {
        state: 'unread',
        repo: 'owner/repo',
        labels: ['bug'],
        archived: 'only',
        subjectType: 'Issue',
      })
    ).toEqual({
      state: 'unread',
      labels: [],
      subjectType: 'Issue',
    });

    expect(
      clearDashboardSourceFilters('notifications', {
        state: 'unread',
        repo: 'owner/repo',
        author: 'octocat',
        labels: ['bug'],
        subjectType: 'Issue',
        archived: 'only',
      })
    ).toEqual({
      labels: ['bug'],
      repo: 'owner/repo',
      author: 'octocat',
      subjectType: 'Issue',
      archived: 'only',
    });

    expect(
      clearDashboardSourceFilters('todos', {
        state: 'unread',
        repo: 'owner/repo',
        author: 'octocat',
        labels: ['bug'],
        subjectType: 'Issue',
        sort: 'updated',
        order: 'asc',
      })
    ).toEqual({
      state: 'unread',
      author: 'octocat',
      labels: ['bug'],
    });
  });

  test('clips filter patches to the active source schema', () => {
    expect(
      createDashboardFilterPatchForSource('notifications', {
        state: 'unread',
        repo: 'owner/repo',
        subjectType: 'Issue',
      })
    ).toEqual({
      state: 'unread',
    });

    expect(
      createDashboardFilterPatchForSource('todos', {
        state: 'unread',
        repo: 'owner/repo',
        subjectType: 'Issue',
        sort: 'updated',
        order: 'asc',
      })
    ).toEqual({
      repo: 'owner/repo',
      subjectType: 'Issue',
      sort: 'updated',
      order: 'asc',
    });
  });

  test('creates chips for advanced issue and pull filters', () => {
    expect(
      createDashboardFilterChips({
        labels: [],
        review: 'approved',
        archived: 'only',
        sort: 'comments',
        order: 'asc',
      })
    ).toEqual([
      {
        key: 'review',
        value: 'approved',
        labelKey: 'dashboard.filters.chips.review',
        labelValue: 'dashboard.filters.options.approved',
      },
      {
        key: 'archived',
        value: 'only',
        labelKey: 'dashboard.filters.chips.archived',
        labelValue: 'dashboard.filters.options.onlyArchived',
      },
      {
        key: 'sort',
        value: 'comments',
        labelKey: 'dashboard.filters.chips.sort',
        labelValue: 'dashboard.filters.options.comments',
      },
      {
        key: 'order',
        value: 'asc',
        labelKey: 'dashboard.filters.chips.order',
        labelValue: 'dashboard.filters.options.asc',
      },
    ]);
  });

  test('builds built-in issue and pull queries from base scope plus route overlay', () => {
    expect(
      buildBuiltinIssuePrFilterQuery(
        'issues',
        {
          repo: 'owner/repo',
          labels: ['bug'],
          sort: 'created',
        },
        'octocat'
      )
    ).toEqual({
      type: 'issues',
      state: 'open',
      archived: 'exclude',
      sort: 'created',
      order: 'desc',
      involves: 'octocat',
      repo: 'owner/repo',
      labels: ['bug'],
    });

    expect(
      buildBuiltinIssuePrFilterQuery('pulls', { state: 'closed', labels: [] }, 'octocat')
    ).toEqual({
      type: 'pulls',
      state: 'closed',
      archived: 'exclude',
      sort: 'updated',
      order: 'desc',
      involves: 'octocat',
    });

    expect(
      buildBuiltinIssuePrFilterQuery('pulls', { state: 'merged', labels: [] }, 'octocat')
    ).toEqual({
      type: 'pulls',
      state: 'merged',
      archived: 'exclude',
      sort: 'updated',
      order: 'desc',
      involves: 'octocat',
    });

    expect(
      buildBuiltinIssuePrFilterQuery('issues', { state: 'unread', labels: [] }, 'octocat')
    ).toMatchObject({
      type: 'issues',
      state: 'open',
      involves: 'octocat',
    });
  });

  test('source state centralizes visible chips and built-in query', () => {
    const sourceState = createDashboardFilterSourceState(
      'pulls',
      {
        state: 'merged',
        repo: 'owner/repo',
        labels: [],
        review: 'approved',
      },
      'octocat'
    );

    expect(sourceState.hasActiveFilters).toBe(true);
    expect(sourceState.chips.map((chip) => chip.key)).toEqual(['state', 'repo', 'review']);
    expect(sourceState.issuePrQuery).toEqual({
      type: 'pulls',
      state: 'merged',
      archived: 'exclude',
      sort: 'updated',
      order: 'desc',
      involves: 'octocat',
      repo: 'owner/repo',
      review: 'approved',
    });
  });

  test('applies supported notification item predicates after enrichment', () => {
    const items = [
      {
        id: '1',
        unread: false,
        reason: 'mention',
        repository: { full_name: 'owner/repo' },
        subject: {
          type: 'Issue',
          state: 'open',
          authorLogin: 'octocat',
          labels: [{ name: 'bug' }],
        },
      },
      {
        id: '2',
        unread: true,
        reason: 'subscribed',
        repository: { full_name: 'owner/repo' },
        subject: {
          type: 'PullRequest',
          state: 'closed',
          authorLogin: 'hubot',
          labels: [{ name: 'enhancement' }],
        },
      },
    ] as any[];

    expect(
      applyNotificationLocalFilters(items, {
        readState: 'unread',
        repo: 'owner/repo',
        subjectType: 'PullRequest',
      }).map((item) => item.id)
    ).toEqual(['2']);
  });
});
