import { expect, test } from 'bun:test';

// The engines under test, at the versions Nuxt and Nitro install: importing them
// here is what lets the assertions mirror production instead of a re-implementation.
import { defu } from 'defu';
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3';
import { addRoute, createRouter, findAllRoutes } from 'rou3';

import { appLocales, defaultLocaleCode } from '../shared/utils/app-locales';

/**
 * One `routeRules` object is read by two matchers: Nuxt compiles the keys for
 * rou3 (client and SSR layout selection), Nitro 2 matches them with radix3
 * (headers, prerender, redirects). A key only one of them understands is a
 * silent misconfiguration, so every assertion below runs through both.
 */

type RouteRule = Record<string, unknown>;

const NATIVE_LOGIN_HEADERS = {
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

interface PathCase {
  path: string;
  appLayout: string | undefined;
  prerender: boolean | undefined;
}

/**
 * Signed-out surfaces carry no `appLayout`: Nuxt falls back to the `default`
 * layout, which is the public shell. Only the dashboard needs a rule to leave it.
 */
const PATH_CASES: PathCase[] = [
  { path: '/', appLayout: undefined, prerender: undefined },
  { path: '/zh-cn', appLayout: undefined, prerender: undefined },
  { path: '/open', appLayout: undefined, prerender: undefined },
  { path: '/zh-cn/open', appLayout: undefined, prerender: undefined },
  { path: '/native-login', appLayout: undefined, prerender: false },
  { path: '/zh-cn/native-login', appLayout: undefined, prerender: false },
  { path: '/dashboard', appLayout: 'dashboard', prerender: undefined },
  { path: '/zh-cn/dashboard', appLayout: 'dashboard', prerender: undefined },
  { path: '/dashboard/settings', appLayout: 'dashboard', prerender: undefined },
  { path: '/zh-cn/dashboard/settings', appLayout: 'dashboard', prerender: undefined },
  // No rule, so no layout: an unmatched path renders the error page, and a
  // non-locale prefix never inherits a locale-prefixed rule.
  { path: '/foo', appLayout: undefined, prerender: undefined },
  { path: '/zh-cn/foo', appLayout: undefined, prerender: undefined },
  { path: '/zzz/dashboard', appLayout: undefined, prerender: undefined },
  { path: '/dashboardx', appLayout: undefined, prerender: undefined },
];

async function loadRouteRules(): Promise<Record<string, RouteRule>> {
  const originalDefineConfig = Object.getOwnPropertyDescriptor(globalThis, 'defineNuxtConfig');
  const originalPersonalMode = process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
  Object.assign(globalThis, { defineNuxtConfig: (config: unknown) => config });
  process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = 'true';
  try {
    const { default: config } = await import('../nuxt.config');
    return config.routeRules as Record<string, RouteRule>;
  } finally {
    if (originalDefineConfig)
      Object.defineProperty(globalThis, 'defineNuxtConfig', originalDefineConfig);
    else Reflect.deleteProperty(globalThis, 'defineNuxtConfig');
    if (originalPersonalMode === undefined) delete process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
    else process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = originalPersonalMode;
  }
}

/** The client/SSR lookup Nuxt performs: least specific first, most specific wins. */
function resolveWithRou3(routeRules: Record<string, RouteRule>, path: string): RouteRule {
  const router = createRouter();
  for (const [key, rule] of Object.entries(routeRules)) addRoute(router, '', key, rule);
  const matched = findAllRoutes(router, '', path).map((match) => match.data as RouteRule);
  return defu({}, ...matched.reverse());
}

/** The server lookup Nitro performs, through radix3. */
function resolveWithRadix3(routeRules: Record<string, RouteRule>, path: string): RouteRule {
  const matcher = toRouteMatcher(createRadixRouter({ routes: routeRules }));
  return defu({}, ...matcher.matchAll(path).reverse());
}

test('route-rule keys keep wildcards out of the middle of the path', async () => {
  const routeRules = await loadRouteRules();
  for (const key of Object.keys(routeRules)) {
    const segments = key.split('/').filter(Boolean);
    expect(segments.slice(0, -1), key).not.toContain('**');
  }
});

test('every configured locale is covered by an explicit rule', async () => {
  const routeRules = await loadRouteRules();
  for (const locale of appLocales) {
    const prefix = locale.code === defaultLocaleCode ? '' : `/${locale.code}`;
    expect(routeRules[`${prefix}/dashboard`], locale.code).toBeDefined();
    expect(routeRules[`${prefix}/dashboard/**`], locale.code).toBeDefined();
    expect(routeRules[`${prefix}/native-login`], locale.code).toBeDefined();
  }
});

test('signed-out surfaces resolve the public shell and the dashboard resolves its own', async () => {
  const routeRules = await loadRouteRules();
  // Mirrors Nuxt's layout resolution: a route rule wins only when it names a layout.
  const layoutOf = (path: string) => resolveWithRou3(routeRules, path).appLayout ?? 'default';
  for (const path of [
    '/',
    '/zh-cn',
    '/open',
    '/zh-cn/open',
    '/native-login',
    '/zh-cn/native-login',
  ]) {
    expect(layoutOf(path), path).toBe('default');
  }
  for (const path of ['/dashboard', '/zh-cn/dashboard', '/dashboard/settings']) {
    expect(layoutOf(path), path).toBe('dashboard');
  }
});

test('both matchers resolve the same layout for every path', async () => {
  const routeRules = await loadRouteRules();
  for (const { path, appLayout } of PATH_CASES) {
    expect(resolveWithRou3(routeRules, path).appLayout, `rou3 ${path}`).toBe(appLayout);
    expect(resolveWithRadix3(routeRules, path).appLayout, `radix3 ${path}`).toBe(appLayout);
  }
});

test('both matchers resolve the same prerender decision for every path', async () => {
  const routeRules = await loadRouteRules();
  for (const { path, prerender } of PATH_CASES) {
    expect(resolveWithRou3(routeRules, path).prerender, `rou3 ${path}`).toBe(prerender);
    expect(resolveWithRadix3(routeRules, path).prerender, `radix3 ${path}`).toBe(prerender);
  }
});

test('native approval routes carry their response headers in every locale', async () => {
  const routeRules = await loadRouteRules();
  const approvalPaths = ['/native-login', '/zh-cn/native-login'];
  for (const path of approvalPaths) {
    expect(resolveWithRou3(routeRules, path).headers, `rou3 ${path}`).toEqual(NATIVE_LOGIN_HEADERS);
    expect(resolveWithRadix3(routeRules, path).headers, `radix3 ${path}`).toEqual(
      NATIVE_LOGIN_HEADERS
    );
  }
  for (const path of ['/', '/zh-cn', '/dashboard', '/zh-cn/dashboard']) {
    expect(resolveWithRou3(routeRules, path).headers, `rou3 ${path}`).toBeUndefined();
  }
});
