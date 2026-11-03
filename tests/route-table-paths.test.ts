import { expect, test } from 'bun:test';

import routeTablePaths from '../.nuxt/route-table-paths.mjs';
import { DEFAULT_AUTH_RETURN_PATH } from '../shared/utils/auth-return-route';
import { admitAuthReturnTo } from '../shared/utils/route-admission';
import { createRouteMatcher } from '../shared/utils/route-matcher';

const match = createRouteMatcher(routeTablePaths);

function admit(returnTo: string) {
  return admitAuthReturnTo(returnTo, match, DEFAULT_AUTH_RETURN_PATH);
}

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
