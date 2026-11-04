import { afterAll, expect, mock, test } from 'bun:test';

import { useHead } from '@unhead/vue';
import { createHead, renderSSRHead } from '@unhead/vue/server';
import { effectScope, shallowRef } from 'vue';

import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const { createDashboardFilterSourceState, parseDashboardRouteFilters } =
  await import('../app/composables/useDashboardFilters');
const { parseDashboardPage } = await import('../app/composables/useDashboardRouteState');
const { buildCustomTabUrl, buildPaginationUrl, dashboardListPageSize } =
  await import('../app/utils/dashboardListRequest');
const { resolveDashboardHomeListPreload } = await import('../app/utils/dashboardHomeListPreload');

const routeState: { path: string; query: Record<string, unknown> } = {
  path: '/dashboard',
  query: {},
};
const sessionUser = shallowRef<{ login: string } | undefined>({ login: 'octocat' });
let head = createHead();

const globals = {
  defineNuxtPlugin: (setup: () => void) => setup,
  useHead: (input: Parameters<typeof useHead>[0]) => useHead(input, { head }),
  useRoute: () => routeState,
  useUserSession: () => ({ user: sessionUser }),
  resolveDashboardHomeListPreload,
};

const originals = new Map(
  Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
);
Object.assign(globalThis, globals);

const { default: renderDashboardHomeListPreload } =
  await import('../app/plugins/dashboard-home-list-preload');

const renderPlugin = async () => {
  head = createHead();
  const scope = effectScope();
  scope.run(() => {
    renderDashboardHomeListPreload({} as Parameters<typeof renderDashboardHomeListPreload>[0]);
  });
  const rendered = renderSSRHead(head);
  scope.stop();
  return rendered.headTags;
};

const readFetchPreloads = (headTags: string) => {
  return [...headTags.matchAll(/<link\b([^>]*)>/g)].flatMap((match) => {
    const attrs = Object.fromEntries(
      [...match[1].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((attr) => [attr[1], attr[2] ?? ''])
    );
    if (attrs.rel !== 'preload' || attrs.as !== 'fetch') return [];

    return [
      {
        rel: attrs.rel,
        as: attrs.as,
        href: attrs.href,
        crossorigin: attrs.crossorigin,
      },
    ];
  });
};

const notificationHref = (query: Record<string, unknown>) => {
  const source = createDashboardFilterSourceState(
    'notifications',
    parseDashboardRouteFilters(query)
  );
  return buildPaginationUrl(
    '/api/notifications',
    parseDashboardPage(query.page),
    dashboardListPageSize,
    source.notificationAdapter.apiParams
  );
};

const searchHref = (
  tab: 'issues' | 'pulls',
  query: Record<string, unknown>,
  userLogin?: string
) => {
  const source = createDashboardFilterSourceState(
    tab,
    parseDashboardRouteFilters(query),
    userLogin
  );
  if (!source.issuePrQuery) {
    throw new Error(`missing ${tab} search query`);
  }

  return buildCustomTabUrl(parseDashboardPage(query.page), source.issuePrQuery);
};

const reposHref = (query: Record<string, unknown>) => {
  return buildPaginationUrl('/api/repos', parseDashboardPage(query.page));
};

const renderAt = async (
  path: string,
  query: Record<string, unknown> = {},
  userLogin: string | null = 'octocat'
) => {
  routeState.path = path;
  routeState.query = query;
  sessionUser.value = userLogin ? { login: userLogin } : undefined;
  return readFetchPreloads(await renderPlugin());
};

test('preloads the notifications list for Dashboard Home without a tab', async () => {
  const query = {};
  const links = await renderAt('/dashboard', query);

  expect(links).toEqual([
    {
      rel: 'preload',
      as: 'fetch',
      href: notificationHref(query),
      crossorigin: 'anonymous',
    },
  ]);
});

test('preloads the addressed notifications page, including the explicit tab', async () => {
  const query = { tab: 'notifications', page: '2' };
  const links = await renderAt('/dashboard', query);

  expect(links).toEqual([
    {
      rel: 'preload',
      as: 'fetch',
      href: notificationHref(query),
      crossorigin: 'anonymous',
    },
  ]);
  expect(links[0]?.href).toContain('page=2');
});

test('preloads the first notifications page when the address has no page', async () => {
  const query = { tab: 'notifications' };
  const links = await renderAt('/dashboard', query);

  expect(links[0]?.href).toBe(notificationHref(query));
  expect(links[0]?.href).toContain('page=1');
});

test('preloads unread notifications without the all-notifications parameter', async () => {
  const query = { tab: 'notifications', f_state: 'unread' };
  const links = await renderAt('/dashboard', query);

  expect(links[0]?.href).toBe(notificationHref(query));
  expect(links[0]?.href).not.toContain('all=');
});

test('keeps notification route filters that do not change the list request out of the preload', async () => {
  const query = {
    tab: 'notifications',
    f_state: 'unread',
    f_repo: 'owner/repo',
    f_labels: 'bug',
  };
  const links = await renderAt('/dashboard', query);

  expect(links[0]?.href).toBe(notificationHref(query));
  expect(links[0]?.href).not.toContain('owner');
});

test('preloads the issues search for the route filters and signed-in login', async () => {
  const query = {
    tab: 'issues',
    page: '3',
    f_state: 'closed',
    f_repo: 'owner/repo',
    f_author: 'hubot',
    f_labels: 'bug',
  };
  const links = await renderAt('/dashboard', query, 'octocat');

  expect(links).toEqual([
    {
      rel: 'preload',
      as: 'fetch',
      href: searchHref('issues', query, 'octocat'),
      crossorigin: 'anonymous',
    },
  ]);
});

test('preloads pulls on their own search address', async () => {
  const query = { tab: 'pulls', f_state: 'merged', f_review: 'approved' };
  const links = await renderAt('/dashboard', query, 'octocat');

  expect(links[0]?.href).toBe(searchHref('pulls', query, 'octocat'));
  expect(links[0]?.href).not.toBe(searchHref('issues', query, 'octocat'));
});

test('preloads the repos page from the address', async () => {
  const query = { tab: 'repos', page: '2' };
  const links = await renderAt('/dashboard', query);

  expect(links[0]?.href).toBe(reposHref(query));
});

test('omits the login from issues when the session has none yet', async () => {
  const query = { tab: 'issues' };
  const links = await renderAt('/dashboard', query, null);

  expect(links[0]?.href).toBe(searchHref('issues', query));
  expect(links[0]?.href).not.toContain('involves');
});

test('keeps a locale-prefixed Dashboard Home on the unprefixed list API', async () => {
  const query = { tab: 'notifications' };
  const links = await renderAt('/zh-cn/dashboard', query);

  expect(links[0]?.href).toBe(notificationHref(query));
  expect(links[0]?.href?.startsWith('/api/')).toBe(true);
});

test('does not preload Release Timeline, custom tabs, or todos', async () => {
  expect(await renderAt('/dashboard', { tab: 'release-timeline' })).toEqual([]);
  expect(await renderAt('/dashboard', { tab: 'saved-query' })).toEqual([]);
  expect(await renderAt('/dashboard', { tab: 'todos', f_repo: 'owner/repo' })).toEqual([]);
});

test('does not preload file browsing or a Dashboard child route', async () => {
  expect(
    await renderAt('/dashboard', { tab: 'notifications', repo: 'owner/repo', path: 'README.md' })
  ).toEqual([]);
  expect(await renderAt('/dashboard/profile')).toEqual([]);
  expect(await renderAt('/zh-cn/dashboard/settings', { tab: 'issues' })).toEqual([]);
});

test('preloads only the list behind an open Detail Overlay', async () => {
  const query = {
    tab: 'issues',
    pr: 'owner/repo/7',
    issue: 'owner/repo/4',
  };
  const links = await renderAt('/dashboard', query, 'octocat');

  expect(links).toEqual([
    {
      rel: 'preload',
      as: 'fetch',
      href: searchHref('issues', query, 'octocat'),
      crossorigin: 'anonymous',
    },
  ]);
  expect(links[0]?.href).not.toContain('/pulls/');
  expect(links[0]?.href).not.toContain('/issues/4');
});

test('keeps the cold-load hint when the route later changes', async () => {
  routeState.path = '/dashboard';
  routeState.query = {};
  sessionUser.value = { login: 'octocat' };
  head = createHead();
  const scope = effectScope();
  scope.run(() => {
    renderDashboardHomeListPreload({} as Parameters<typeof renderDashboardHomeListPreload>[0]);
  });
  routeState.query = { tab: 'issues' };
  const links = readFetchPreloads(renderSSRHead(head).headTags);
  scope.stop();

  expect(links).toHaveLength(1);
  expect(links[0]?.href).toBe(notificationHref({}));
});

afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
