import { describe, expect, mock, test } from 'bun:test';

import { reactive } from 'vue';

const dashboardUrlNavigationUtils = await import('../app/utils/dashboardUrlNavigationUtils');
const getQueryParamValue = await import('../app/utils/getQueryParamValue');
const repoIssuePrSearchQuery = await import('../app/utils/repoIssuePrSearchQuery');

mock.module('~/utils/dashboardUrlNavigationUtils', () => dashboardUrlNavigationUtils);
mock.module('~/utils/getQueryParamValue', () => getQueryParamValue);
mock.module('~/utils/repoIssuePrSearchQuery', () => repoIssuePrSearchQuery);

const { createRepoDetailLocation } =
  await import('../app/composables/repo-detail-session/location');

const createHarness = (query: Record<string, unknown> = {}) => {
  const route = reactive({
    path: '/dashboard',
    query: { repo: 'octo/repo', ...query } as Record<string, unknown>,
  });
  const replace = mock(async (location: { query?: Record<string, unknown> }) => {
    if (location.query) {
      const nextQuery: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(location.query)) {
        if (value !== undefined && value !== null) {
          nextQuery[key] = value;
        }
      }
      route.query = nextQuery;
    }
  });

  const location = createRepoDetailLocation({
    route,
    router: { replace },
  });

  return { route, replace, location };
};

describe('repo detail session location', () => {
  test('defaults to the files panel when the query has no panel state', () => {
    const { location } = createHarness();

    expect(location.activePanel.value).toBe('files');
    expect(location.listState.value).toBe('open');
    expect(location.resumeListPage.value).toBe(1);
    expect(location.resumeCommitsPage.value).toBe(1);
    expect(location.isListPanel.value).toBe(false);
    expect(location.listKind.value).toBe('issues');
  });

  test('restores a paginated pulls panel from the query', () => {
    const { location } = createHarness({ section: 'pulls', repoPage: '3', repoState: 'merged' });

    expect(location.activePanel.value).toBe('pulls');
    expect(location.listState.value).toBe('merged');
    expect(location.resumeListPage.value).toBe(3);
    expect(location.resumeCommitsPage.value).toBe(1);
    expect(location.listKind.value).toBe('pulls');
  });

  test('restores a paginated commits panel from the query', () => {
    const { location } = createHarness({ section: 'commits', repoPage: '5' });

    expect(location.activePanel.value).toBe('commits');
    expect(location.resumeCommitsPage.value).toBe(5);
    expect(location.resumeListPage.value).toBe(1);
    expect(location.listState.value).toBe('open');
  });

  test('normalizes an invalid issues state away on restore', () => {
    const { location } = createHarness({ section: 'issues', repoState: 'merged' });

    expect(location.activePanel.value).toBe('issues');
    expect(location.listState.value).toBe('open');
  });

  test('ignores invalid section and page values', () => {
    const { location } = createHarness({ section: 'bogus', repoPage: '0' });

    expect(location.activePanel.value).toBe('files');
    expect(location.resumeListPage.value).toBe(1);
  });

  test('selecting a list panel resets state and syncs the URL', async () => {
    const { route, location } = createHarness();

    await location.selectPanel('pulls');

    expect(location.activePanel.value).toBe('pulls');
    expect(location.listState.value).toBe('open');
    expect(location.resumeListPage.value).toBe(1);
    expect(route.query.section).toBe('pulls');
    expect(route.query.repoPage).toBeUndefined();
    expect(route.query.repoState).toBeUndefined();
  });

  test('list state and page changes are reflected in the URL', async () => {
    const { route, location } = createHarness({ section: 'issues' });

    await location.selectListState('closed');
    expect(location.listState.value).toBe('closed');
    expect(location.resumeListPage.value).toBe(1);
    expect(route.query.repoState).toBe('closed');

    await location.setListPage(4);
    expect(route.query.repoPage).toBe('4');
    expect(route.query.repoState).toBe('closed');
  });

  test('merged state is normalized per kind when selected', async () => {
    const { location } = createHarness({ section: 'issues' });

    await location.selectListState('merged');
    expect(location.listState.value).toBe('open');
  });

  test('commits page changes are reflected in the URL', async () => {
    const { route, location } = createHarness({ section: 'commits' });

    await location.setCommitsPage(3);
    expect(location.resumeCommitsPage.value).toBe(3);
    expect(route.query.repoPage).toBe('3');
  });

  test('selecting files clears panel keys from the URL', async () => {
    const { route, location } = createHarness({
      section: 'pulls',
      repoPage: '3',
      repoState: 'all',
    });

    await location.selectPanel('files');

    expect(route.query.section).toBeUndefined();
    expect(route.query.repoPage).toBeUndefined();
    expect(route.query.repoState).toBeUndefined();
  });

  test('does not touch the URL while file browsing owns the path key', async () => {
    const { replace, location } = createHarness({ path: 'src/index.ts' });

    await location.selectPanel('issues');

    expect(location.activePanel.value).toBe('issues');
    expect(replace).not.toHaveBeenCalled();
  });

  test('does not touch the URL when no repository is open', async () => {
    const { route, replace, location } = createHarness();
    route.query = {};

    await location.selectPanel('issues');

    expect(replace).not.toHaveBeenCalled();
  });

  test('skips replace when the query already matches', async () => {
    const { replace, location } = createHarness({ section: 'issues' });

    await location.sync();

    expect(replace).not.toHaveBeenCalled();
  });

  test('preserves unrelated query keys when syncing', async () => {
    const { route, location } = createHarness({ tab: 'repos' });

    await location.selectPanel('commits');

    expect(route.query.tab).toBe('repos');
    expect(route.query.repo).toBe('octo/repo');
    expect(route.query.section).toBe('commits');
  });

  test('resetForRepo returns to the files panel and syncs', async () => {
    const { route, location } = createHarness({
      section: 'pulls',
      repoPage: '3',
      repoState: 'all',
    });

    await location.resetForRepo();

    expect(location.activePanel.value).toBe('files');
    expect(location.listState.value).toBe('open');
    expect(location.resumeListPage.value).toBe(1);
    expect(location.resumeCommitsPage.value).toBe(1);
    expect(route.query.section).toBeUndefined();
    expect(route.query.repoPage).toBeUndefined();
    expect(route.query.repoState).toBeUndefined();
  });
});
