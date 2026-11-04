import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { DashboardNavigationEntry } from '../app/utils/dashboardUrlNavigationUtils';
import {
  isDashboardRouteShapeAdmissible,
  resolveNavigationEntryRoute,
  type NavigationRouteLocation,
} from '../app/utils/navigationEntryRouting';

/** Mirrors vue-router query serialization: undefined/null params are dropped. */
const normalizeQuery = (query: Record<string, unknown> = {}) => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      normalized[key] = value.join(',');
    } else if (typeof value === 'string') {
      normalized[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = String(value);
    }
  }
  return normalized;
};

const isAdmissible = (path: string, query: Record<string, unknown> = {}) =>
  isDashboardRouteShapeAdmissible({ path, query: normalizeQuery(query) });

describe('a dashboard child page that identifies its target is admissible', () => {
  const identified: [string, Record<string, string>][] = [
    ['/dashboard/wiki', { repo: 'octo/repo' }],
    ['/dashboard/wiki', { repo: 'octo/repo', page: 'Home' }],
    ['/dashboard/branches', { repo: 'octo/repo' }],
    ['/dashboard/releases', { repo: 'octo/repo' }],
    ['/dashboard/contributors', { repo: 'octo/repo' }],
    ['/dashboard/package', { user: 'octo', type: 'npm', name: 'pkg' }],
    ['/zh-cn/dashboard/wiki', { repo: 'octo/repo' }],
    ['/dashboard/wiki/', { repo: 'octo/repo' }],
  ];

  for (const [path, query] of identified) {
    test(`${path}?${new URLSearchParams(query)}`, () => {
      expect(isAdmissible(path, query)).toBe(true);
    });
  }

  test('child pages that need no target are admissible', () => {
    for (const path of [
      '/dashboard/profile',
      '/dashboard/profile?user=octo',
      '/dashboard/starred',
      '/dashboard/settings',
      '/dashboard/tabs',
      '/dashboard/release-follows',
    ]) {
      const [pathname, search = ''] = path.split('?');
      expect(isAdmissible(pathname, Object.fromEntries(new URLSearchParams(search)))).toBe(true);
    }
  });
});

describe('a dashboard child page that identifies nothing is not admissible', () => {
  test('a repository page without ?repo=', () => {
    for (const path of [
      '/dashboard/wiki',
      '/dashboard/wiki/',
      '/dashboard/branches',
      '/dashboard/releases',
      '/dashboard/contributors',
    ]) {
      expect(isAdmissible(path)).toBe(false);
    }
  });

  test('an unparseable ?repo= counts as no target', () => {
    expect(isAdmissible('/dashboard/wiki', { repo: 'not-a-repository' })).toBe(false);
    expect(isAdmissible('/dashboard/branches', { repo: '' })).toBe(false);
  });

  test('a package page needs user, type and name', () => {
    expect(isAdmissible('/dashboard/package')).toBe(false);
    expect(isAdmissible('/dashboard/package', { user: 'octo' })).toBe(false);
    expect(isAdmissible('/dashboard/package', { user: 'octo', name: 'pkg' })).toBe(false);
    expect(isAdmissible('/dashboard/package', { user: 'octo', type: 'npm' })).toBe(false);
    expect(
      isAdmissible('/dashboard/package', { user: 'octo', type: 'not-a-type', name: 'pkg' })
    ).toBe(false);
  });
});

describe('URLs outside a dashboard child page are never rejected', () => {
  test('landing, launch and the dashboard root', () => {
    for (const path of ['/', '/open', '/dashboard', '/dashboard/', '/zh-cn/dashboard']) {
      expect(isAdmissible(path)).toBe(true);
    }
  });

  test('the dashboard root keeps tolerating stray detail params', () => {
    expect(isAdmissible('/dashboard', { repo: 'not-a-repository' })).toBe(true);
    expect(isAdmissible('/dashboard', { path: 'src/index.ts' })).toBe(true);
  });
});

describe('every route the app builds for a child page is admissible', () => {
  // Direction matters: this feeds the entry -> route resolver's own output back
  // in. If the builder and the admission rule ever disagree about which
  // parameters a page needs, the app would redirect away from its own links.
  const entries: DashboardNavigationEntry[] = [
    { type: 'wiki', data: { owner: 'octo', repo: 'repo', path: 'Home' } },
    { type: 'branches-list', data: { owner: 'octo', repo: 'repo' } },
    { type: 'releases-list', data: { owner: 'octo', repo: 'repo' } },
    { type: 'contributors-list', data: { owner: 'octo', repo: 'repo' } },
    {
      type: 'package',
      data: { user: 'octo', packageType: 'npm', packageName: 'pkg', packageOrganization: true },
    },
    { type: 'profile', data: { user: 'octo' } },
    { type: 'starred', data: { user: 'octo' } },
    { type: 'settings' },
    { type: 'tabs-settings' },
    { type: 'release-follows' },
  ];

  for (const entry of entries) {
    test(entry.type, () => {
      const route: NavigationRouteLocation = resolveNavigationEntryRoute(entry);
      expect(isDashboardRouteShapeAdmissible(route)).toBe(true);
    });
  }
});

describe('the route middleware sends a shape-less dashboard URL to the dashboard root', () => {
  const navigateTo = mock(() => undefined);
  const localePath = mock((path: string) => (path === '/dashboard' ? '/zh-cn/dashboard' : path));

  const loadMiddleware = async () => {
    Object.assign(globalThis, {
      defineNuxtRouteMiddleware: (middleware: unknown) => middleware,
      navigateTo,
      useLocalePath: () => localePath,
      isDashboardRouteShapeAdmissible,
      resolveNavigationEntryRoute,
    });
    const module = await import('../app/middleware/dashboard-route-shape.global');
    return module.default as (to: {
      path: string;
      query: Record<string, string>;
      matched: unknown[];
    }) => unknown;
  };

  const toRoute = (path: string, query: Record<string, string> = {}, matched = [{}]) => ({
    path,
    query,
    matched,
  });

  beforeEach(() => {
    navigateTo.mockClear();
    localePath.mockClear();
  });

  test('redirects a matched child page that identifies nothing', async () => {
    const middleware = await loadMiddleware();

    middleware(toRoute('/dashboard/wiki'));

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith({ path: '/zh-cn/dashboard' });
  });

  test('leaves a matched child page that identifies its target alone', async () => {
    const middleware = await loadMiddleware();

    expect(middleware(toRoute('/dashboard/wiki', { repo: 'octo/repo' }))).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test('leaves an unmatched path to the 404 error page', async () => {
    const middleware = await loadMiddleware();

    expect(middleware(toRoute('/dashboard/wiki', {}, []))).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
