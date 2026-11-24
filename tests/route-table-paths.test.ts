import { expect, test } from 'bun:test';

import routeTablePaths from '../.nuxt/route-table-paths.mjs';
import { isDashboardRouteShapeAdmissible } from '../app/utils/navigationEntryRouting';
import { DEFAULT_AUTH_RETURN_PATH } from '../shared/utils/auth-return-route';
import { admitAuthReturnTo } from '../shared/utils/route-admission';
import { createRouteMatcher } from '../shared/utils/route-matcher';
import { normalizeQuery } from './helpers/normalize-query';

const match = createRouteMatcher(routeTablePaths);

function admit(returnTo: string) {
  return admitAuthReturnTo(returnTo, match, DEFAULT_AUTH_RETURN_PATH);
}

test('staticRoutes leaves unknown paths unmatched and dashboard children for the shape check', async () => {
  const originalDefineConfig = Object.getOwnPropertyDescriptor(globalThis, 'defineNuxtConfig');
  const originalPersonalMode = process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
  Object.assign(globalThis, { defineNuxtConfig: (config: unknown) => config });
  process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = 'true';
  try {
    const { default: config } = await import('../nuxt.config');
    expect(config.experimental?.staticRoutes).toBe(true);
  } finally {
    if (originalDefineConfig) {
      Object.defineProperty(globalThis, 'defineNuxtConfig', originalDefineConfig);
    } else {
      Reflect.deleteProperty(globalThis, 'defineNuxtConfig');
    }
    if (originalPersonalMode === undefined) delete process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
    else process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = originalPersonalMode;
  }

  // A root catch-all would disable early404, so every path would load the app.
  for (const path of routeTablePaths) {
    expect(path).not.toContain(':');
    expect(path).not.toContain('*');
  }

  expect(match('/xyz-nope').matchedCount).toBe(0);
  expect(match('/dashboard/wiki').matchedCount).toBeGreaterThan(0);
  expect(
    isDashboardRouteShapeAdmissible({
      path: '/dashboard/wiki',
      query: normalizeQuery(),
    })
  ).toBe(false);
  expect(
    isDashboardRouteShapeAdmissible({
      path: '/dashboard/wiki',
      query: normalizeQuery({ repo: 'octo/repo' }),
    })
  ).toBe(true);
});

test('the prepared page table admits localized session surfaces and rejects unknown paths', () => {
  expect(routeTablePaths.length).toBeGreaterThan(0);
  expect(admit('/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo')).toBe(
    '/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo'
  );
  expect(admit('/zh-cn/dashboard')).toBe('/zh-cn/dashboard');
  expect(admit('/dashboard/wiki')).toBe('/dashboard/wiki');
  expect(admit('/xyz-nope')).toBe('/dashboard');
  expect(admit('/zh-cn')).toBe('/dashboard');
  expect(admit('/sitemap.xml')).toBe('/dashboard');
});
