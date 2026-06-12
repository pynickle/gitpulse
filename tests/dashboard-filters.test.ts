import { describe, expect, test } from 'bun:test';

import {
  applyNotificationLocalFilters,
  buildBuiltinIssuePrFilterQuery,
  buildCustomTabOverlayQuery,
  createCustomTabFilterSourceState,
  createDashboardFiltersFromCustomTabQuery,
  createDashboardEffectiveFilters,
  createDashboardFilterChips,
  createDashboardFilterSourceState,
  buildNotificationFilterAdapter,
  clearDashboardRouteFilters,
  clearDashboardSourceFilters,
  hasNotificationPageLocalPredicates,
  isIssuePrQueryFiltered,
  normalizeCustomTabRouteFilterPatch,
  parseDashboardRouteFilters,
  serializeDashboardRouteFilters,
} from '../app/composables/useDashboardFilters';

describe('dashboard route filters', () => {
  test('normalizes route filters and drops invalid values', () => {
    expect(
      parseDashboardRouteFilters({
        f_state: 'merged',
        f_repo: ' owner/repo ',
        f_labels: ' bug, ,needs triage ',
        f_subject_state: 'merged',
        f_review: 'invalid',
        f_order: 'sideways',
      })
    ).toEqual({
      state: 'merged',
      repo: 'owner/repo',
      author: undefined,
      labels: ['bug', 'needs triage'],
      reason: undefined,
      subjectType: undefined,
      subjectState: 'merged',
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

  test('keeps notification API params separate from local predicates', () => {
    expect(
      buildNotificationFilterAdapter({
        state: 'read',
        repo: 'owner/repo',
        author: 'octocat',
        labels: ['bug'],
        reason: 'mention',
        subjectState: 'open',
      })
    ).toEqual({
      apiParams: { all: true },
      local: {
        readState: 'read',
        repo: 'owner/repo',
        author: undefined,
        labels: [],
        reason: 'mention',
        subjectType: undefined,
        subjectState: 'open',
      },
      usesPageLocalPredicates: true,
    });

    expect(buildNotificationFilterAdapter({ state: 'unread', labels: [] }).apiParams).toEqual({
      all: undefined,
    });
    expect(
      buildNotificationFilterAdapter({ state: 'unread', labels: [] }).usesPageLocalPredicates
    ).toBe(false);
    const readAdapter = buildNotificationFilterAdapter({ state: 'read', labels: [] });
    expect(readAdapter.apiParams).toEqual({ all: true });
    expect(readAdapter.usesPageLocalPredicates).toBe(true);
    expect(hasNotificationPageLocalPredicates(readAdapter.local)).toBe(true);
  });

  test('omits author and labels from active notification filters', () => {
    const sourceState = createDashboardFilterSourceState('notifications', {
      state: 'read',
      repo: 'owner/repo',
      author: 'octocat',
      labels: ['bug'],
      reason: 'mention',
    });

    expect(sourceState.filters).toEqual({
      labels: [],
      repo: 'owner/repo',
      state: 'read',
      reason: 'mention',
      subjectType: undefined,
      subjectState: undefined,
    });
    expect(sourceState.chips.map((chip) => chip.key)).toEqual(['state', 'repo', 'reason']);
    expect(sourceState.notificationAdapter.local).toEqual({
      readState: 'read',
      repo: 'owner/repo',
      author: undefined,
      labels: [],
      reason: 'mention',
      subjectType: undefined,
      subjectState: undefined,
    });
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
        reason: 'mention',
        labels: ['bug'],
        archived: 'only',
      })
    ).toEqual({
      state: 'unread',
      reason: 'mention',
      labels: [],
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
      buildBuiltinIssuePrFilterQuery('issues', { state: 'read', labels: [] }, 'octocat')
    ).toMatchObject({
      type: 'issues',
      state: 'open',
      involves: 'octocat',
    });
  });

  test('overlays custom tab queries without mutating the saved query', () => {
    const savedQuery = {
      type: 'pulls' as const,
      repo: 'saved/repo',
      state: 'open' as const,
      labels: ['saved'],
    };

    expect(
      buildCustomTabOverlayQuery(savedQuery, {
        repo: 'route/repo',
        state: 'merged',
        labels: ['route'],
      })
    ).toEqual({
      type: 'pulls',
      repo: 'route/repo',
      state: 'merged',
      labels: ['route'],
    });
    expect(savedQuery).toEqual({
      type: 'pulls',
      repo: 'saved/repo',
      state: 'open',
      labels: ['saved'],
    });
  });

  test('projects custom search query filters into dashboard filter state', () => {
    expect(
      createDashboardFiltersFromCustomTabQuery({
        type: 'pulls',
        repo: ' saved/repo ',
        author: ' octocat ',
        labels: [' bug ', '', 'needs triage'],
        state: 'merged',
        review: 'approved',
        archived: 'include',
        sort: 'comments',
        order: 'asc',
      })
    ).toEqual({
      labels: ['bug', 'needs triage'],
      repo: 'saved/repo',
      author: 'octocat',
      state: 'merged',
      archived: 'include',
      sort: 'comments',
      order: 'asc',
      review: 'approved',
    });

    expect(
      createDashboardFiltersFromCustomTabQuery({
        type: 'issues',
        state: 'open',
        archived: 'exclude',
        sort: 'updated',
        order: 'desc',
      })
    ).toEqual({
      labels: [],
      repo: undefined,
      author: undefined,
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  test('custom tab filter state displays saved query plus route overlay', () => {
    const savedQuery = {
      type: 'pulls' as const,
      repo: 'saved/repo',
      labels: ['saved'],
      state: 'merged' as const,
      review: 'approved' as const,
    };
    const sourceState = createCustomTabFilterSourceState(savedQuery, {
      repo: 'route/repo',
      labels: [],
      sort: 'created',
    });

    expect(sourceState.filters).toEqual({
      labels: ['saved'],
      repo: 'route/repo',
      author: undefined,
      state: 'merged',
      archived: undefined,
      sort: 'created',
      order: undefined,
      review: 'approved',
    });
    expect(sourceState.overlayCustomTabQuery(savedQuery)).toEqual({
      type: 'pulls',
      repo: 'route/repo',
      labels: ['saved'],
      state: 'merged',
      review: 'approved',
      sort: 'created',
    });
  });

  test('custom pull tabs can override saved all state with open from the route', () => {
    const savedQuery = {
      type: 'pulls' as const,
      state: 'all' as const,
    };
    const sourceState = createCustomTabFilterSourceState(savedQuery, {
      state: 'open',
      labels: [],
    });

    expect(sourceState.filters).toEqual({
      labels: [],
      repo: undefined,
      author: undefined,
      state: 'open',
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(sourceState.overlayCustomTabQuery(savedQuery)).toEqual({
      type: 'pulls',
      state: 'open',
    });
  });

  test('custom pull tabs clear merged qualifiers when route state changes to open', () => {
    const savedQuery = {
      type: 'pulls' as const,
      state: 'merged' as const,
    };
    const sourceState = createCustomTabFilterSourceState(savedQuery, {
      state: 'open',
      labels: [],
    });

    expect(sourceState.filters).toEqual({
      labels: [],
      repo: undefined,
      author: undefined,
      state: 'open',
      archived: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(sourceState.overlayCustomTabQuery(savedQuery)).toEqual({
      type: 'pulls',
      state: 'open',
    });
  });

  test('normalizes custom tab open state updates from segmented control empty value', () => {
    expect(normalizeCustomTabRouteFilterPatch({ state: undefined })).toEqual({
      state: 'open',
    });
    expect(normalizeCustomTabRouteFilterPatch({ state: 'closed' })).toEqual({
      state: 'closed',
    });
  });

  test('applies pull-only filters to pull custom tab overlays only', () => {
    const routeFilters = {
      state: 'merged' as const,
      review: 'approved' as const,
      labels: [],
    };

    expect(
      buildCustomTabOverlayQuery(
        { type: 'pulls', state: 'open' },
        createDashboardEffectiveFilters('pulls', { state: 'closed', labels: [] })
      )
    ).toEqual({
      type: 'pulls',
      state: 'closed',
    });

    expect(
      buildCustomTabOverlayQuery(
        { type: 'pulls', state: 'open' },
        createDashboardEffectiveFilters('pulls', routeFilters)
      )
    ).toEqual({
      type: 'pulls',
      state: 'merged',
      review: 'approved',
    });

    expect(
      buildCustomTabOverlayQuery(
        { type: 'issues', state: 'open' },
        createDashboardEffectiveFilters('issues', routeFilters)
      )
    ).toEqual({
      type: 'issues',
      state: 'open',
    });
  });

  test('source state centralizes visible chips, built-in query, and custom tab overlay', () => {
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
    expect(sourceState.overlayCustomTabQuery({ type: 'pulls', state: 'open' })).toEqual({
      type: 'pulls',
      state: 'merged',
      repo: 'owner/repo',
      review: 'approved',
    });
  });

  test('applies local notification predicates after enrichment', () => {
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
        readState: 'read',
        repo: 'owner/repo',
        author: 'octocat',
        labels: ['bug'],
        reason: 'mention',
        subjectType: 'Issue',
        subjectState: 'open',
      }).map((item) => item.id)
    ).toEqual(['1']);
  });
});
