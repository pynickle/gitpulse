import { describe, expect, test } from 'bun:test';

import type { DashboardNavigationEntry } from '../app/utils/dashboardUrlNavigationUtils';
import {
  applyNavigationHistoryChange,
  isDashboardAreaPath,
  isDashboardRootPath,
  isSameNavigationEntry,
  resolveNavigationEntryRoute,
  routeToNavigationEntry,
  shouldReplaceNavigationEntry,
  type NavigationHistoryState,
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
      data: { owner: 'octo', repo: 'repo', branch: undefined, tab: 'repos' },
    });

    expect(derive('/dashboard', { repo: 'octo/repo', branch: 'dev' })).toEqual({
      type: 'repository',
      data: { owner: 'octo', repo: 'repo', branch: 'dev', tab: undefined },
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

  test('derives entries for transient ?url= deep links', () => {
    expect(
      derive('/dashboard', { url: 'https://github.com/octo/repo/issues/42', tab: 'issues' })
    ).toEqual({
      type: 'issue',
      data: { owner: 'octo', repo: 'repo', number: 42, tab: 'issues' },
    });
  });

  test('falls back to a dashboard entry for malformed detail queries', () => {
    expect(derive('/dashboard', { issue: 'octo/repo' })).toEqual({ type: 'dashboard' });
    expect(derive('/dashboard', { issue: 'octo/repo/not-a-number' })).toEqual({
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

describe('shouldReplaceNavigationEntry', () => {
  const replaceCases: Array<
    [string, DashboardNavigationEntry | null, DashboardNavigationEntry, boolean]
  > = [
    ['no previous entry', null, { type: 'dashboard' }, false],
    ['identical entries', { type: 'dashboard' }, { type: 'dashboard' }, true],
    [
      'dashboard tab switch',
      { type: 'dashboard', data: { tab: 'issues' } },
      { type: 'dashboard', data: { tab: 'pulls' } },
      true,
    ],
    [
      'same-user profile tab switch',
      { type: 'profile', data: { user: 'a', tab: 'followers' } },
      { type: 'profile', data: { user: 'a' } },
      true,
    ],
    [
      'different-user profile',
      { type: 'profile', data: { user: 'a', tab: 'followers' } },
      { type: 'profile', data: { user: 'b' } },
      false,
    ],
    [
      'same-repo wiki page switch',
      { type: 'wiki', data: { owner: 'o', repo: 'r', path: 'Home' } },
      { type: 'wiki', data: { owner: 'o', repo: 'r', path: 'Faq' } },
      true,
    ],
    [
      'different-repo wiki',
      { type: 'wiki', data: { owner: 'o', repo: 'r' } },
      { type: 'wiki', data: { owner: 'o', repo: 'r2' } },
      false,
    ],
    [
      'continuous file browsing',
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'a' } },
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'b' } },
      true,
    ],
    [
      'cross-repo file link',
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'a' } },
      { type: 'file', data: { owner: 'o', repo: 'r2', path: 'b' } },
      true,
    ],
    [
      'repository branch switch',
      { type: 'repository', data: { owner: 'o', repo: 'r', branch: 'main' } },
      { type: 'repository', data: { owner: 'o', repo: 'r', branch: 'dev' } },
      true,
    ],
    [
      'different repository',
      { type: 'repository', data: { owner: 'o', repo: 'r' } },
      { type: 'repository', data: { owner: 'o', repo: 'r2' } },
      false,
    ],
    [
      'leaving file browsing up to the same repo',
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'src' } },
      { type: 'repository', data: { owner: 'o', repo: 'r', tab: 'repos' } },
      true,
    ],
    [
      'file to a different repository',
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'src' } },
      { type: 'repository', data: { owner: 'o', repo: 'r2' } },
      false,
    ],
    [
      'entering file browsing pushes',
      { type: 'repository', data: { owner: 'o', repo: 'r' } },
      { type: 'file', data: { owner: 'o', repo: 'r', path: 'src' } },
      false,
    ],
    [
      'closing a PR review',
      { type: 'pull-request-review', data: { owner: 'o', repo: 'r', number: 5 } },
      { type: 'pull-request', data: { owner: 'o', repo: 'r', number: 5, tab: 'pulls' } },
      true,
    ],
    [
      'opening a PR review pushes',
      { type: 'pull-request', data: { owner: 'o', repo: 'r', number: 5 } },
      { type: 'pull-request-review', data: { owner: 'o', repo: 'r', number: 5 } },
      false,
    ],
    [
      'review of a different PR',
      { type: 'pull-request-review', data: { owner: 'o', repo: 'r', number: 5 } },
      { type: 'pull-request', data: { owner: 'o', repo: 'r', number: 6 } },
      false,
    ],
    [
      'same-user starred list',
      { type: 'starred', data: { user: 'a' } },
      { type: 'starred', data: { user: 'a' } },
      true,
    ],
    [
      'issue to issue',
      { type: 'issue', data: { owner: 'o', repo: 'r', number: 1 } },
      { type: 'issue', data: { owner: 'o', repo: 'r', number: 2 } },
      false,
    ],
  ];

  for (const [label, previous, next, expected] of replaceCases) {
    test(label, () => {
      expect(shouldReplaceNavigationEntry(previous, next)).toBe(expected);
    });
  }
});

describe('applyNavigationHistoryChange', () => {
  const dashboard: DashboardNavigationEntry = { type: 'dashboard', data: { tab: 'repos' } };
  const profile: DashboardNavigationEntry = { type: 'profile', data: { user: 'octocat' } };
  const repository: DashboardNavigationEntry = {
    type: 'repository',
    data: { owner: 'o', repo: 'r', branch: undefined, tab: 'repos' },
  };
  const file: DashboardNavigationEntry = {
    type: 'file',
    data: { owner: 'o', repo: 'r', path: 'src', branch: 'main' },
  };

  const push = (state: NavigationHistoryState, entry: DashboardNavigationEntry) =>
    applyNavigationHistoryChange(state, entry, { kind: 'push' });

  test('reset clears the stack', () => {
    expect(
      applyNavigationHistoryChange({ history: [dashboard], current: profile }, repository, {
        kind: 'reset',
      })
    ).toEqual({ history: [], current: repository });
  });

  test('a null entry (outside the dashboard area) clears everything', () => {
    expect(
      applyNavigationHistoryChange({ history: [dashboard], current: profile }, null, {
        kind: 'push',
      })
    ).toEqual({ history: [], current: null });
  });

  test('push stacks the current entry', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = push(state, dashboard);
    // Without a current entry nothing is stacked.
    expect(state).toEqual({ history: [], current: dashboard });

    state = push(state, profile);
    expect(state).toEqual({ history: [dashboard], current: profile });

    state = push(state, repository);
    expect(state).toEqual({ history: [dashboard, profile], current: repository });
  });

  test('push applies the in-place collapse rules', () => {
    let state: NavigationHistoryState = { history: [dashboard], current: profile };
    const profileTab: DashboardNavigationEntry = {
      type: 'profile',
      data: { user: 'octocat', tab: 'followers' },
    };

    state = push(state, profileTab);
    expect(state).toEqual({ history: [dashboard], current: profileTab });
  });

  test('replace updates the current entry in place', () => {
    const state = applyNavigationHistoryChange(
      { history: [dashboard], current: profile },
      { type: 'profile', data: { user: 'octocat', tab: 'packages' } },
      { kind: 'replace' }
    );
    expect(state.history).toEqual([dashboard]);
    expect(state.current?.data?.tab).toBe('packages');
  });

  test('a non-collapsible replace falls back to pushing', () => {
    // Browser positions can desync (cancelled popstate followed by a link
    // click), making a genuine forward navigation look like a replace. The
    // current entry must not be lost from the back chain.
    const issue: DashboardNavigationEntry = {
      type: 'issue',
      data: { owner: 'o', repo: 'r', number: 1, tab: 'issues' },
    };

    const state = applyNavigationHistoryChange(
      { history: [dashboard, profile], current: repository },
      issue,
      { kind: 'replace' }
    );
    expect(state).toEqual({ history: [dashboard, profile, repository], current: issue });
  });

  test('closing a PR review collapses onto the pull request pushed at open', () => {
    const pr: DashboardNavigationEntry = {
      type: 'pull-request',
      data: { owner: 'o', repo: 'r', number: 5, tab: 'pulls' },
    };
    const review: DashboardNavigationEntry = {
      type: 'pull-request-review',
      data: { owner: 'o', repo: 'r', number: 5, tab: 'pulls' },
    };

    let state: NavigationHistoryState = { history: [], current: null };
    state = push(state, dashboard);
    state = push(state, pr);
    state = push(state, review);
    expect(state).toEqual({ history: [dashboard, pr], current: review });

    // Closing the review navigates back to ?pr=; the review entry collapses
    // and the duplicate pull request on the stack is deduped away.
    state = push(state, pr);
    expect(state).toEqual({ history: [dashboard], current: pr });
  });

  test('leaving file browsing via the repo header behaves like back', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = push(state, dashboard);
    state = push(state, profile);
    state = push(state, repository);
    state = push(state, file);
    expect(state).toEqual({ history: [dashboard, profile, repository], current: file });

    state = push(state, repository);
    expect(state).toEqual({ history: [dashboard, profile], current: repository });
  });

  test('pop follows the browser back to a matching entry', () => {
    const state: NavigationHistoryState = {
      history: [dashboard, profile],
      current: repository,
    };

    expect(applyNavigationHistoryChange(state, profile, { kind: 'pop', depth: 1 })).toEqual({
      history: [dashboard],
      current: profile,
    });

    expect(applyNavigationHistoryChange(state, dashboard, { kind: 'pop', depth: 2 })).toEqual({
      history: [],
      current: dashboard,
    });
  });

  test('pop without a matching entry only syncs the current entry', () => {
    // Browser-back across a collapsed wiki page change: the previous wiki page
    // never made it onto the stack, so nothing must be popped.
    const wikiHome: DashboardNavigationEntry = {
      type: 'wiki',
      data: { owner: 'o', repo: 'r', path: undefined },
    };
    const wikiFaq: DashboardNavigationEntry = {
      type: 'wiki',
      data: { owner: 'o', repo: 'r', path: 'Faq' },
    };

    const state: NavigationHistoryState = { history: [dashboard, profile], current: wikiFaq };

    expect(applyNavigationHistoryChange(state, wikiHome, { kind: 'pop', depth: 1 })).toEqual({
      history: [dashboard, profile],
      current: wikiHome,
    });
  });

  test('cold start on a detail route leaves the stack empty', () => {
    const issue: DashboardNavigationEntry = {
      type: 'issue',
      data: { owner: 'o', repo: 'r', number: 1, tab: 'issues' },
    };

    const state = applyNavigationHistoryChange({ history: [], current: null }, issue, {
      kind: 'reset',
    });
    expect(state).toEqual({ history: [], current: issue });
  });
});

describe('acceptance flows through derivation + reducer', () => {
  const navigate = (
    state: NavigationHistoryState,
    path: string,
    query: Record<string, unknown> = {},
    kind: 'push' | 'replace' | 'reset' = 'push'
  ) => applyNavigationHistoryChange(state, derive(path, query), { kind });

  test('dashboard -> profile -> repository keeps the full back chain', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard', { tab: 'repos' }, 'reset');
    state = navigate(state, '/dashboard/profile', { user: 'octocat', tab: 'repositories' });
    state = navigate(state, '/dashboard', { tab: 'repos', repo: 'octocat/repo' });

    expect(state.current?.type).toBe('repository');
    // Back target: the profile with its original tab.
    expect(state.history[state.history.length - 1]).toEqual({
      type: 'profile',
      data: { user: 'octocat', tab: 'repositories' },
    });
    // Home button: previous entry is not the dashboard.
    expect(state.history[state.history.length - 1]?.type).not.toBe('dashboard');
  });

  test('profile A -> followers -> profile B goes back to A', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard/profile', { user: 'a' }, 'reset');
    state = navigate(state, '/dashboard/profile', { user: 'a', tab: 'followers' }, 'replace');
    state = navigate(state, '/dashboard/profile', { user: 'b' });

    expect(state.current).toEqual({ type: 'profile', data: { user: 'b', tab: undefined } });
    expect(state.history).toEqual([{ type: 'profile', data: { user: 'a', tab: 'followers' } }]);
  });

  test('multi-level file browsing collapses into one entry', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard/profile', { user: 'a' }, 'reset');
    state = navigate(state, '/dashboard', { tab: 'repos', repo: 'a/r' });
    state = navigate(state, '/dashboard', { tab: 'repos', repo: 'a/r', path: '', branch: 'main' });
    state = navigate(state, '/dashboard', {
      tab: 'repos',
      repo: 'a/r',
      path: 'src',
      branch: 'main',
    });
    state = navigate(state, '/dashboard', {
      tab: 'repos',
      repo: 'a/r',
      path: 'src/app.ts',
      branch: 'main',
    });

    expect(state.current?.type).toBe('file');
    expect(state.history.map((entry) => entry.type)).toEqual(['profile', 'repository']);
  });

  test('releases list -> release detail goes back to the list', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard/releases', { repo: 'o/r' }, 'reset');
    state = navigate(state, '/dashboard', { release: 'o/r/9' });

    expect(state.current?.type).toBe('release');
    expect(state.history).toEqual([{ type: 'releases-list', data: { owner: 'o', repo: 'r' } }]);
  });

  test('wiki page switches never accumulate history', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard', { tab: 'repos', repo: 'o/r' }, 'reset');
    state = navigate(state, '/dashboard/wiki', { repo: 'o/r' });
    state = navigate(state, '/dashboard/wiki', { repo: 'o/r', page: 'Faq' });
    state = navigate(state, '/dashboard/wiki', { repo: 'o/r', page: 'Setup' });

    expect(state.current?.data?.path).toBe('Setup');
    expect(state.history.map((entry) => entry.type)).toEqual(['repository']);
  });

  test('a detail opened from a dashboard tab goes back to that tab', () => {
    let state: NavigationHistoryState = { history: [], current: null };
    state = navigate(state, '/dashboard', { tab: 'notifications' }, 'reset');
    state = navigate(state, '/dashboard', { tab: 'notifications', issue: 'o/r/1' });

    expect(state.history).toEqual([{ type: 'dashboard', data: { tab: 'notifications' } }]);
  });
});
