import { describe, expect, test } from 'bun:test';

import { DEFAULT_AUTH_RETURN_PATH } from '../shared/utils/auth-return-route';
import { admitAuthReturnTo } from '../shared/utils/route-admission';
import { createRouteMatcher } from '../shared/utils/route-matcher';

const match = createRouteMatcher([
  '/',
  '/zh-cn',
  '/native-login',
  '/zh-cn/native-login',
  '/open',
  '/zh-cn/open',
  '/dashboard',
  '/zh-cn/dashboard',
  '/dashboard/wiki',
  '/zh-cn/dashboard/wiki',
]);

function admit(returnTo: string | null) {
  return admitAuthReturnTo(returnTo, match, DEFAULT_AUTH_RETURN_PATH);
}

describe('admitAuthReturnTo', () => {
  test('keeps a session surface, including its query and hash', () => {
    expect(admit('/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7#diff')).toBe(
      '/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7#diff'
    );
    expect(admit('/zh-cn/dashboard/wiki?repo=octo/repo')).toBe(
      '/zh-cn/dashboard/wiki?repo=octo/repo'
    );
  });

  test('drops unknown paths and public pages', () => {
    expect(admit(null)).toBe('/dashboard');
    expect(admit('/xyz-nope')).toBe('/dashboard');
    expect(admit('/')).toBe('/dashboard');
    expect(admit('/zh-cn')).toBe('/dashboard');
    expect(admit('/native-login?id=1')).toBe('/dashboard');
    expect(admit('/zh-cn/native-login')).toBe('/dashboard');
  });
});
