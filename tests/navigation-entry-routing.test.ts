import { describe, expect, test } from 'bun:test';

import type { DashboardNavigationEntry } from '../app/utils/dashboardUrlNavigationUtils';
import {
  applyLogicalNavigationEvent,
  createLogicalNavigationState,
  isDashboardAreaPath,
  isDashboardRootPath,
  isSameNavigationEntry,
  resolveNavigationEntryRoute,
  routeToNavigationEntry,
  type LogicalNavigationState,
} from '../app/utils/navigationEntryRouting';

/** Mirrors vue-router query serialization: undefined/null params are dropped. */
const normalizeQuery = (query: Record<string, unknown>) => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value);
    }
  }
  return normalized;
};

const derive = (path: string, query: Record<string, unknown> = {}) =>
  routeToNavigationEntry({ path, query: normalizeQuery(query) });

describe('dashboard area path detection', () => {
  test('matches the dashboard root across locale prefixes', () => {
    expect(isDashboardRootPath('/dashboard')).toBe(true);
    expect(isDashboardRootPath('/dashboard/')).toBe(true);
    expect(isDashboardRootPath('/zh-cn/dashboard')).toBe(true);
    expect(isDashboardRootPath('/dashboard/profile')).toBe(false);
    expect(isDashboardRootPath('/')).toBe(false);
  });

  test('matches child pages across locale prefixes', () => {
    expect(isDashboardAreaPath('/dashboard/profile')).toBe(true);
    expect(isDashboardAreaPath('/zh-cn/dashboard/releases')).toBe(true);
    expect(isDashboardAreaPath('/login')).toBe(false);
  });
});

describe('routeToNavigationEntry', () => {
  test('returns null outside the dashboard area', () => {
    expect(derive('/')).toBeNull();
    expect(derive('/login')).toBeNull();
    expect(derive('/zh-cn')).toBeNull();
  });

  test('derives dashboard root entries with and without a tab', () => {
    expect(derive('/dashboard')).toEqual({ type: 'dashboard' });
    expect(derive('/dashboard', { tab: 'issues' })).toEqual({
      type: 'dashboard',
      data: { tab: 'issues' },
    });
    expect(derive('/zh-cn/dashboard', { tab: 'pulls' })).toEqual({
      type: 'dashboard',
      data: { tab: 'pulls' },
    });
    expect(derive('/dashboard', { tab: 'release-timeline' })).toEqual({
      type: 'dashboard',
      data: { tab: 'release-timeline' },
    });
  });

  test('derives detail entries following the watcher precedence', () => {
    expect(derive('/dashboard', { tab: 'issues', issue: 'octo/repo/12' })).toEqual({
      type: 'issue',
      data: { owner: 'octo', repo: 'repo', number: 12, tab: 'issues' },
    });

    expect(derive('/dashboard', { pr: 'octo/repo/7' })).toEqual({
      type: 'pull-request',
      data: { owner: 'octo', repo: 'repo', number: 7, tab: undefined },
    });

    expect(derive('/dashboard', { tab: 'pulls', prReview: 'octo/repo/7' })).toEqual({
      type: 'pull-request-review',
      data: { owner: 'octo', repo: 'repo', number: 7, tab: 'pulls' },
    });

    expect(derive('/dashboard', { discussion: 'octo/repo/3' })).toEqual({
      type: 'discussion',
      data: { owner: 'octo', repo: 'repo', number: 3, tab: undefined },
    });

    // prReview outranks pr when both are present, mirroring the detail watcher.
    expect(derive('/dashboard', { pr: 'octo/repo/7', prReview: 'octo/repo/7' })?.type).toBe(
      'pull-request-review'
    );
  });

  test('derives release entries from id and tag query shapes', () => {
    expect(derive('/dashboard', { release: 'octo/repo/55', tab: 'notifications' })).toEqual({
      type: 'release',
      data: {
        owner: 'octo',
        repo: 'repo',
        number: 55,
        releaseRef: { kind: 'id', id: 55 },
        tab: 'notifications',
      },
    });

    expect(derive('/dashboard', { release: 'octo/repo', releaseTag: 'v1.2.3' })).toEqual({
      type: 'release',
      data: {
        owner: 'octo',
        repo: 'repo',
        number: undefined,
        releaseRef: { kind: 'tag', tag: 'v1.2.3' },
        tab: undefined,
      },
    });
  });

  test('derives repository and file entries from repo/path/branch', () => {
    expect(derive('/dashboard', { tab: 'repos', repo: 'octo/repo' })).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: 'repos',
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    });

    expect(derive('/dashboard', { repo: 'octo/repo', branch: 'dev' })).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: 'dev',
        tab: undefined,
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    });

    expect(
      derive('/dashboard', { repo: 'octo/repo', path: 'src/index.ts', branch: 'dev' })
    ).toEqual({
      type: 'file',
      data: { owner: 'octo', repo: 'repo', path: 'src/index.ts', branch: 'dev', tab: undefined },
    });

    // An empty (but present) path is root file browsing, not the repo detail.
    expect(derive('/dashboard', { repo: 'octo/repo', path: '' })?.type).toBe('file');
  });

  test('derives repository section, page, and list state for issue/pr/commit panels', () => {
    expect(
      derive('/dashboard', {
        tab: 'repos',
        repo: 'octo/repo',
        section: 'issues',
        repoPage: '3',
        repoState: 'closed',
      })
    ).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: 'repos',
        section: 'issues',
        repoPage: 3,
        repoState: 'closed',
      },
    });

    expect(
      derive('/dashboard', {
        repo: 'octo/repo',
        section: 'pulls',
        repoPage: '2',
        repoState: 'merged',
      })
    ).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: undefined,
        section: 'pulls',
        repoPage: 2,
        repoState: 'merged',
      },
    });

    expect(derive('/dashboard', { repo: 'octo/repo', section: 'commits', repoPage: '4' })).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: undefined,
        section: 'commits',
        repoPage: 4,
        repoState: undefined,
      },
    });

    // Default files panel / page 1 / open state stay omitted from the entry.
    expect(
      derive('/dashboard', {
        repo: 'octo/repo',
        section: 'files',
        repoPage: '1',
        repoState: 'open',
      })
    ).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: undefined,
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    });

    // Unknown section/page/state values are ignored.
    expect(
      derive('/dashboard', {
        repo: 'octo/repo',
        section: 'wiki',
        repoPage: '0',
        repoState: 'draft',
      })
    ).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: undefined,
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    });
  });

  test('resolves repository section/page/state back onto the dashboard query', () => {
    expect(
      resolveNavigationEntryRoute({
        type: 'repository',
        data: {
          owner: 'octo',
          repo: 'repo',
          tab: 'repos',
          section: 'issues',
          repoPage: 3,
          repoState: 'closed',
        },
      }).query
    ).toEqual({
      tab: 'repos',
      repo: 'octo/repo',
      branch: undefined,
      section: 'issues',
      repoPage: '3',
      repoState: 'closed',
    });

    expect(
      resolveNavigationEntryRoute({
        type: 'repository',
        data: { owner: 'octo', repo: 'repo', section: 'commits', repoPage: 2 },
      }).query
    ).toEqual({
      tab: 'repos',
      repo: 'octo/repo',
      branch: undefined,
      section: 'commits',
      repoPage: '2',
      repoState: undefined,
    });

    // Defaults stay out of the query so residual dashboard page is not polluted.
    expect(
      resolveNavigationEntryRoute({
        type: 'repository',
        data: { owner: 'octo', repo: 'repo', tab: 'repos' },
      }).query
    ).toEqual({
      tab: 'repos',
      repo: 'octo/repo',
      branch: undefined,
      section: undefined,
      repoPage: undefined,
      repoState: undefined,
    });
  });

  test('falls back to a dashboard entry for malformed detail queries', () => {
    expect(derive('/dashboard', { issue: 'octo/repo' })).toEqual({ type: 'dashboard' });
    expect(derive('/dashboard', { issue: 'octo/repo/not-a-number' })).toEqual({
      type: 'dashboard',
    });
  });

  test('does not interpret the retired dashboard url query as a detail entry', () => {
    expect(derive('/dashboard', { url: 'https://github.com/octo/repo/issues/42' })).toEqual({
      type: 'dashboard',
    });
  });

  test('derives child page entries', () => {
    expect(derive('/dashboard/profile', { user: 'octocat', tab: 'packages' })).toEqual({
      type: 'profile',
      data: { user: 'octocat', tab: 'packages' },
    });

    // The self profile has no ?user= query.
    expect(derive('/dashboard/profile')).toEqual({ type: 'profile', data: undefined });

    expect(
      derive('/dashboard/package', {
        user: 'octo-org',
        type: 'container',
        name: 'app-image',
        account: 'organization',
      })
    ).toEqual({
      type: 'package',
      data: {
        user: 'octo-org',
        packageType: 'container',
        packageName: 'app-image',
        packageOrganization: true,
      },
    });

    expect(derive('/dashboard/package', { user: 'octo' })).toEqual({ type: 'dashboard' });

    expect(derive('/dashboard/releases', { repo: 'octo/repo' })).toEqual({
      type: 'releases-list',
      data: { owner: 'octo', repo: 'repo' },
    });

    expect(derive('/dashboard/branches', { repo: 'octo/repo' })).toEqual({
      type: 'branches-list',
      data: { owner: 'octo', repo: 'repo' },
    });

    expect(derive('/dashboard/contributors', { repo: 'octo/repo' })).toEqual({
      type: 'contributors-list',
      data: { owner: 'octo', repo: 'repo' },
    });

    expect(derive('/zh-cn/dashboard/wiki', { repo: 'octo/repo', page: 'Guide' })).toEqual({
      type: 'wiki',
      data: { owner: 'octo', repo: 'repo', path: 'Guide' },
    });

    expect(derive('/dashboard/wiki', { repo: 'octo/repo' })).toEqual({
      type: 'wiki',
      data: { owner: 'octo', repo: 'repo', path: undefined },
    });

    expect(derive('/dashboard/starred', { user: 'octocat' })).toEqual({
      type: 'starred',
      data: { user: 'octocat' },
    });
    expect(derive('/dashboard/starred')).toEqual({ type: 'starred', data: undefined });
  });

  test('derives settings and tabs-settings child pages', () => {
    expect(derive('/dashboard/settings')).toEqual({ type: 'settings' });
    expect(derive('/zh-cn/dashboard/settings')).toEqual({ type: 'settings' });
    expect(derive('/dashboard/tabs')).toEqual({ type: 'tabs-settings' });
    expect(derive('/zh-cn/dashboard/tabs')).toEqual({ type: 'tabs-settings' });
  });

  test('derives the Release Follows configuration overlay', () => {
    expect(derive('/dashboard/release-follows')).toEqual({ type: 'release-follows' });
    expect(derive('/zh-cn/dashboard/release-follows')).toEqual({ type: 'release-follows' });
  });

  test('treats unrecognized child pages as the dashboard', () => {
    expect(derive('/dashboard/unknown-page')).toEqual({ type: 'dashboard' });
  });
});

describe('routeToNavigationEntry / resolveNavigationEntryRoute round trip', () => {
  const owners = ['octo'];
  const tabs = [undefined, 'issues'];
  const branches = [undefined, 'dev'];

  const corpus: Array<{ label: string; entry: DashboardNavigationEntry }> = [
    { label: 'dashboard', entry: { type: 'dashboard' } },
    { label: 'dashboard tab', entry: { type: 'dashboard', data: { tab: 'pulls' } } },
    {
      label: 'dashboard release timeline tab',
      entry: { type: 'dashboard', data: { tab: 'release-timeline' } },
    },
    { label: 'profile self', entry: { type: 'profile', data: undefined } },
    { label: 'profile user', entry: { type: 'profile', data: { user: 'octocat' } } },
    {
      label: 'profile user tab',
      entry: { type: 'profile', data: { user: 'octocat', tab: 'followers' } },
    },
    {
      label: 'package',
      entry: {
        type: 'package',
        data: { user: 'octo', packageType: 'npm', packageName: 'pkg' },
      },
    },
    {
      label: 'package organization',
      entry: {
        type: 'package',
        data: {
          user: 'octo-org',
          packageType: 'container',
          packageName: 'img',
          packageOrganization: true,
        },
      },
    },
    {
      label: 'releases list',
      entry: { type: 'releases-list', data: { owner: 'octo', repo: 'r' } },
    },
    {
      label: 'branches list',
      entry: { type: 'branches-list', data: { owner: 'octo', repo: 'r' } },
    },
    {
      label: 'contributors list',
      entry: { type: 'contributors-list', data: { owner: 'octo', repo: 'r' } },
    },
    { label: 'wiki', entry: { type: 'wiki', data: { owner: 'octo', repo: 'r' } } },
    {
      label: 'wiki page',
      entry: { type: 'wiki', data: { owner: 'octo', repo: 'r', path: 'Faq' } },
    },
    { label: 'starred', entry: { type: 'starred', data: undefined } },
    { label: 'starred user', entry: { type: 'starred', data: { user: 'octocat' } } },
    { label: 'settings', entry: { type: 'settings' } },
    { label: 'tabs settings', entry: { type: 'tabs-settings' } },
    { label: 'release follows', entry: { type: 'release-follows' } },
  ];

  for (const owner of owners) {
    for (const tab of tabs) {
      for (const type of ['issue', 'pull-request', 'pull-request-review', 'discussion'] as const) {
        corpus.push({
          label: `${type} tab=${tab}`,
          entry: { type, data: { owner, repo: 'repo', number: 42, tab } },
        });
      }

      corpus.push({
        label: `release id tab=${tab}`,
        entry: {
          type: 'release',
          data: { owner, repo: 'repo', number: 9, releaseRef: { kind: 'id', id: 9 }, tab },
        },
      });
      corpus.push({
        label: `release tag tab=${tab}`,
        entry: {
          type: 'release',
          data: {
            owner,
            repo: 'repo',
            number: undefined,
            releaseRef: { kind: 'tag', tag: 'v2.0' },
            tab,
          },
        },
      });

      for (const branch of branches) {
        corpus.push({
          label: `repository tab=${tab} branch=${branch}`,
          entry: { type: 'repository', data: { owner, repo: 'repo', branch, tab } },
        });
        corpus.push({
          label: `repository issues page tab=${tab} branch=${branch}`,
          entry: {
            type: 'repository',
            data: {
              owner,
              repo: 'repo',
              branch,
              tab,
              section: 'issues',
              repoPage: 3,
              repoState: 'closed',
            },
          },
        });
        corpus.push({
          label: `repository pulls page tab=${tab} branch=${branch}`,
          entry: {
            type: 'repository',
            data: {
              owner,
              repo: 'repo',
              branch,
              tab,
              section: 'pulls',
              repoPage: 2,
              repoState: 'merged',
            },
          },
        });
        corpus.push({
          label: `repository commits page tab=${tab} branch=${branch}`,
          entry: {
            type: 'repository',
            data: { owner, repo: 'repo', branch, tab, section: 'commits', repoPage: 4 },
          },
        });
        for (const path of ['', 'src/app.ts']) {
          corpus.push({
            label: `file ${path || '(root)'} tab=${tab} branch=${branch}`,
            entry: { type: 'file', data: { owner, repo: 'repo', path, branch, tab } },
          });
        }
      }
    }
  }

  /**
   * Resolving a tab-less repository entry defaults the tab to `repos` (the
   * legacy back-to-repo default); the reparsed entry carries that tab.
   */
  const expectedAfterRoundTrip = (entry: DashboardNavigationEntry): DashboardNavigationEntry => {
    if (entry.type === 'repository' && !entry.data?.tab) {
      return { ...entry, data: { ...entry.data, tab: 'repos' } };
    }
    return entry;
  };

  test('every resolvable entry survives the route round trip', () => {
    const failures = corpus
      .filter(({ entry }) => {
        const resolved = resolveNavigationEntryRoute(entry);
        const reparsed = derive(resolved.path, resolved.query as Record<string, unknown>);
        return !isSameNavigationEntry(reparsed, expectedAfterRoundTrip(entry));
      })
      .map(({ label }) => label);

    expect(failures).toEqual([]);
  });

  test('resolution falls back to the dashboard root', () => {
    expect(resolveNavigationEntryRoute(null)).toEqual({ path: '/dashboard', query: {} });
    expect(resolveNavigationEntryRoute({ type: 'dashboard' })).toEqual({
      path: '/dashboard',
      query: {},
    });
    expect(resolveNavigationEntryRoute({ type: 'dashboard', data: { tab: 'repos' } })).toEqual({
      path: '/dashboard',
      query: { tab: 'repos' },
    });
    // The legacy notification type has no route of its own.
    expect(resolveNavigationEntryRoute({ type: 'notification' })).toEqual({
      path: '/dashboard',
      query: {},
    });
  });

  test('resolution onto the dashboard preserves the residual query', () => {
    const dashboardQuery = { tab: 'issues', page: '2', issue: undefined };

    expect(resolveNavigationEntryRoute({ type: 'dashboard' }, { dashboardQuery })).toEqual({
      path: '/dashboard',
      query: { tab: 'issues', page: '2', issue: undefined },
    });

    expect(
      resolveNavigationEntryRoute({ type: 'dashboard', data: { tab: 'pulls' } }, { dashboardQuery })
        .query
    ).toEqual({ tab: 'pulls', page: '2', issue: undefined });

    expect(
      resolveNavigationEntryRoute(
        { type: 'issue', data: { owner: 'octo', repo: 'r', number: 1, tab: 'issues' } },
        { dashboardQuery }
      ).query
    ).toEqual({ tab: 'issues', page: '2', issue: 'octo/r/1' });

    // Child pages never inherit dashboard residue.
    expect(
      resolveNavigationEntryRoute(
        { type: 'profile', data: { user: 'octocat' } },
        { dashboardQuery }
      ).query
    ).toEqual({ user: 'octocat', tab: undefined });
  });
});

const applyRoute = (
  state: LogicalNavigationState,
  path: string,
  query: Record<string, unknown>,
  position: number,
  extras: { failed?: boolean } = {}
) =>
  applyLogicalNavigationEvent(state, {
    type: 'route',
    route: { path, query: normalizeQuery(query) },
    position,
    failed: extras.failed,
  });

describe('applyLogicalNavigationEvent', () => {
  test('a cold-start route derives the entry and leaves the stack empty', () => {
    const result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);

    expect(result.decision).toBe('reset');
    expect(result.entry).toEqual({ type: 'dashboard', data: { tab: 'repos' } });
    expect(result.snapshot).toEqual({
      history: [],
      current: { type: 'dashboard', data: { tab: 'repos' } },
      previousEntry: null,
      canGoBack: false,
      shouldShowHomeButton: false,
    });
  });

  test('a later position is a forward push', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(
      result.state,
      '/dashboard/profile',
      { user: 'octocat', tab: 'repositories' },
      1
    );

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({
      type: 'profile',
      data: { user: 'octocat', tab: 'repositories' },
    });
    expect(result.snapshot.history).toEqual([{ type: 'dashboard', data: { tab: 'repos' } }]);
    expect(result.snapshot.canGoBack).toBe(true);
    expect(result.snapshot.shouldShowHomeButton).toBe(false);
  });

  test('the same position replaces in place for a dashboard tab switch', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'issues' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'pulls' }, 0);

    expect(result.decision).toBe('replace');
    expect(result.snapshot.history).toEqual([]);
    expect(result.snapshot.current).toEqual({ type: 'dashboard', data: { tab: 'pulls' } });
  });

  test('a smaller position is browser-back and pops a matching entry', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 1);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 2);
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', repo: 'octocat/repo' }, 3);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 2);

    expect(result.decision).toBe('pop');
    expect(result.snapshot.current).toEqual({
      type: 'profile',
      data: { user: 'octocat', tab: undefined },
    });
    expect(result.snapshot.history).toEqual([{ type: 'dashboard', data: { tab: 'repos' } }]);
  });

  test('leaving the dashboard area resets the stack', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', {}, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 1);
    result = applyRoute(result.state, '/login', {}, 2);

    expect(result.decision).toBe('reset');
    expect(result.entry).toBeNull();
    expect(result.snapshot).toEqual({
      history: [],
      current: null,
      previousEntry: null,
      canGoBack: false,
      shouldShowHomeButton: false,
    });
  });

  test('a failed route keeps the stack and consumes a pending back intent', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 1);
    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard/profile', query: { user: 'octocat' } },
    });

    expect(result.target).toEqual({ path: '/dashboard', query: { tab: 'repos' } });

    result = applyRoute(result.state, '/dashboard', { tab: 'repos' }, 2, { failed: true });

    expect(result.decision).toBeNull();
    expect(result.snapshot.current).toEqual({ type: 'dashboard', data: { tab: 'repos' } });
    expect(result.snapshot.history).toEqual([]);

    result = applyRoute(result.state, '/dashboard/settings', {}, 3);
    expect(result.decision).toBe('push');
    expect(result.snapshot.history).toEqual([{ type: 'dashboard', data: { tab: 'repos' } }]);
  });

  test('Release Timeline tab is a dashboard entry; configuration overlay pushes on top', () => {
    let result = applyRoute(
      createLogicalNavigationState(),
      '/dashboard',
      { tab: 'release-timeline' },
      0
    );

    expect(result.snapshot.current).toEqual({
      type: 'dashboard',
      data: { tab: 'release-timeline' },
    });
    expect(result.snapshot.history).toEqual([]);

    result = applyRoute(result.state, '/dashboard', { tab: 'issues' }, 0);
    expect(result.decision).toBe('replace');
    expect(result.snapshot.current).toEqual({ type: 'dashboard', data: { tab: 'issues' } });
    expect(result.snapshot.history).toEqual([]);

    result = applyRoute(
      createLogicalNavigationState(),
      '/dashboard',
      { tab: 'release-timeline' },
      0
    );
    result = applyRoute(result.state, '/dashboard/release-follows', {}, 1);

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({ type: 'release-follows' });
    expect(result.snapshot.history).toEqual([
      { type: 'dashboard', data: { tab: 'release-timeline' } },
    ]);

    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard/release-follows', query: {} },
    });
    expect(result.target).toEqual({ path: '/dashboard', query: { tab: 'release-timeline' } });

    result = applyLogicalNavigationEvent(result.state, {
      type: 'home',
      route: { path: '/dashboard/release-follows', query: {} },
    });
    expect(result.target).toEqual({ path: '/dashboard', query: {} });
    expect(result.snapshot.current).toEqual({ type: 'dashboard' });
  });

  test('Release Follows configuration overlay push, back, and home', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(result.state, '/dashboard/release-follows', {}, 1);

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({ type: 'release-follows' });
    expect(result.snapshot.history).toEqual([{ type: 'dashboard', data: { tab: 'repos' } }]);
    expect(result.snapshot.canGoBack).toBe(true);

    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard/release-follows', query: {} },
    });
    expect(result.target).toEqual({ path: '/dashboard', query: { tab: 'repos' } });

    result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'issues' }, 0);
    result = applyRoute(result.state, '/dashboard/release-follows', {}, 1);
    result = applyLogicalNavigationEvent(result.state, {
      type: 'home',
      route: { path: '/dashboard/release-follows', query: {} },
    });
    expect(result.target).toEqual({ path: '/dashboard', query: {} });
    expect(result.snapshot.history).toEqual([]);
    expect(result.snapshot.current).toEqual({ type: 'dashboard' });
  });

  test('logical Back returns the previous route and the following route does not re-push', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'issues' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'issues', issue: 'octo/repo/12' }, 1);

    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard', query: { tab: 'issues', issue: 'octo/repo/12', page: '2' } },
    });

    expect(result.target).toEqual({
      path: '/dashboard',
      query: { tab: 'issues', page: '2' },
    });
    expect(result.snapshot.current).toEqual({ type: 'dashboard', data: { tab: 'issues' } });
    expect(result.snapshot.history).toEqual([]);

    result = applyRoute(result.state, '/dashboard', { tab: 'issues', page: '2' }, 2);

    expect(result.decision).toBe('replace');
    expect(result.snapshot.history).toEqual([]);
    expect(result.snapshot.current).toEqual({ type: 'dashboard', data: { tab: 'issues' } });
  });

  test('logical Home clears the stack and the following route stays at the dashboard', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'a' }, 1);
    result = applyRoute(result.state, '/dashboard/wiki', { repo: 'a/r' }, 2);

    expect(result.snapshot.shouldShowHomeButton).toBe(true);

    result = applyLogicalNavigationEvent(result.state, {
      type: 'home',
      route: { path: '/dashboard/wiki', query: { repo: 'a/r' } },
    });

    expect(result.target).toEqual({ path: '/dashboard', query: {} });
    expect(result.snapshot.history).toEqual([]);
    expect(result.snapshot.current).toEqual({ type: 'dashboard' });
    expect(result.snapshot.canGoBack).toBe(false);
    expect(result.snapshot.shouldShowHomeButton).toBe(false);

    result = applyRoute(result.state, '/dashboard', {}, 3);

    expect(result.decision).toBe('replace');
    expect(result.snapshot.history).toEqual([]);
    expect(result.snapshot.current).toEqual({ type: 'dashboard' });
  });

  test('cancel-intent lets the next route record as a real push', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', {}, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 1);
    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard/profile', query: { user: 'octocat' } },
    });
    result = applyLogicalNavigationEvent(result.state, { type: 'cancel-intent' });
    result = applyRoute(result.state, '/dashboard/settings', {}, 2);

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({ type: 'settings' });
    expect(result.snapshot.history).toEqual([{ type: 'dashboard' }]);
  });

  test('child-page Back does not inherit the dashboard residual query', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'octocat' }, 1);
    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard/profile', query: { user: 'octocat' } },
    });

    expect(result.target).toEqual({ path: '/dashboard', query: { tab: 'repos' } });
  });

  test('a missing mid-session position is treated as a forward push', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', {}, 4);
    result = applyLogicalNavigationEvent(result.state, {
      type: 'route',
      route: { path: '/dashboard/profile', query: { user: 'octocat' } },
      position: null,
    });

    expect(result.decision).toBe('push');
    expect(result.snapshot.history).toEqual([{ type: 'dashboard' }]);
  });

  test('browser-back across a collapsed wiki page only syncs the current entry', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { repo: 'o/r' }, 0);
    result = applyRoute(result.state, '/dashboard/wiki', { repo: 'o/r' }, 1);
    result = applyRoute(result.state, '/dashboard/wiki', { repo: 'o/r', page: 'Faq' }, 1);
    result = applyRoute(result.state, '/dashboard/wiki', { repo: 'o/r' }, 0);

    expect(result.decision).toBe('pop');
    expect(result.snapshot.current).toEqual({
      type: 'wiki',
      data: { owner: 'o', repo: 'r', path: undefined },
    });
    expect(result.snapshot.history).toEqual([
      {
        type: 'repository',
        data: {
          owner: 'o',
          repo: 'r',
          branch: undefined,
          tab: undefined,
          section: undefined,
          repoPage: undefined,
          repoState: undefined,
        },
      },
    ]);
  });

  test('closing a PR review via a later position collapses onto the pull request', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'pulls' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'pulls', pr: 'o/r/5' }, 1);
    result = applyRoute(result.state, '/dashboard', { tab: 'pulls', prReview: 'o/r/5' }, 2);
    result = applyRoute(result.state, '/dashboard', { tab: 'pulls', pr: 'o/r/5' }, 3);

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({
      type: 'pull-request',
      data: { owner: 'o', repo: 'r', number: 5, tab: 'pulls' },
    });
    expect(result.snapshot.history).toEqual([{ type: 'dashboard', data: { tab: 'pulls' } }]);
  });

  test('same-user profile tab switches replace; a different user pushes', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard/profile', { user: 'a' }, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'a', tab: 'followers' }, 0);
    result = applyRoute(result.state, '/dashboard/profile', { user: 'b' }, 1);

    expect(result.decision).toBe('push');
    expect(result.snapshot.current).toEqual({
      type: 'profile',
      data: { user: 'b', tab: undefined },
    });
    expect(result.snapshot.history).toEqual([
      { type: 'profile', data: { user: 'a', tab: 'followers' } },
    ]);
  });

  test('multi-level file browsing collapses into one entry', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard/profile', { user: 'a' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', repo: 'a/r' }, 1);
    result = applyRoute(
      result.state,
      '/dashboard',
      { tab: 'repos', repo: 'a/r', path: '', branch: 'main' },
      2
    );
    result = applyRoute(
      result.state,
      '/dashboard',
      { tab: 'repos', repo: 'a/r', path: 'src', branch: 'main' },
      3
    );
    result = applyRoute(
      result.state,
      '/dashboard',
      { tab: 'repos', repo: 'a/r', path: 'src/app.ts', branch: 'main' },
      4
    );

    expect(result.snapshot.current?.type).toBe('file');
    expect(result.snapshot.history.map((entry) => entry.type)).toEqual(['profile', 'repository']);
  });

  test('leaving file browsing via the repo header collapses back onto the repository', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard/profile', { user: 'a' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', repo: 'a/r' }, 1);
    result = applyRoute(
      result.state,
      '/dashboard',
      { tab: 'repos', repo: 'a/r', path: 'src', branch: 'main' },
      2
    );
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', repo: 'a/r' }, 3);

    expect(result.snapshot.current).toEqual({
      type: 'repository',
      data: {
        owner: 'a',
        repo: 'r',
        branch: undefined,
        tab: 'repos',
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    });
    expect(result.snapshot.history.map((entry) => entry.type)).toEqual(['profile']);
  });

  test('releases list to a release detail keeps the list as Back', () => {
    let result = applyRoute(
      createLogicalNavigationState(),
      '/dashboard/releases',
      { repo: 'o/r' },
      0
    );
    result = applyRoute(result.state, '/dashboard', { release: 'o/r/9' }, 1);

    expect(result.snapshot.current?.type).toBe('release');
    expect(result.snapshot.history).toEqual([
      { type: 'releases-list', data: { owner: 'o', repo: 'r' } },
    ]);
  });

  test('a repo issues panel page survives opening an issue', () => {
    let result = applyRoute(createLogicalNavigationState(), '/dashboard', { tab: 'repos' }, 0);
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', repo: 'octo/repo' }, 1);
    result = applyRoute(
      result.state,
      '/dashboard',
      { tab: 'repos', repo: 'octo/repo', section: 'issues', repoPage: '3', repoState: 'closed' },
      1
    );
    result = applyRoute(result.state, '/dashboard', { tab: 'repos', issue: 'octo/repo/12' }, 2);

    expect(result.snapshot.current?.type).toBe('issue');
    expect(result.snapshot.previousEntry).toEqual({
      type: 'repository',
      data: {
        owner: 'octo',
        repo: 'repo',
        branch: undefined,
        tab: 'repos',
        section: 'issues',
        repoPage: 3,
        repoState: 'closed',
      },
    });

    result = applyLogicalNavigationEvent(result.state, {
      type: 'back',
      route: { path: '/dashboard', query: { tab: 'repos', issue: 'octo/repo/12' } },
    });
    expect(result.target?.query).toMatchObject({
      tab: 'repos',
      repo: 'octo/repo',
      section: 'issues',
      repoPage: '3',
      repoState: 'closed',
    });
  });

  test('a same-position non-collapsible navigation still pushes so Back is not lost', () => {
    let result = applyRoute(
      createLogicalNavigationState(),
      '/dashboard/profile',
      { user: 'octocat' },
      0
    );
    result = applyRoute(result.state, '/dashboard', { tab: 'issues', issue: 'o/r/1' }, 0);

    expect(result.decision).toBe('replace');
    expect(result.snapshot.history).toEqual([
      { type: 'profile', data: { user: 'octocat', tab: undefined } },
    ]);
    expect(result.snapshot.current?.type).toBe('issue');
  });
});
