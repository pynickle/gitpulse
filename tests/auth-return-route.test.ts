import { describe, expect, mock, test } from 'bun:test';

const authReturnRoute = await import('../shared/utils/auth-return-route');
mock.module('#shared/utils/auth-return-route', () => authReturnRoute);
const { normalizeAuthReturnTo, withAppBase } = authReturnRoute;

describe('normalizeAuthReturnTo', () => {
  test('keeps an internal open target with its query and hash', () => {
    expect(
      normalizeAuthReturnTo('/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7#diff')
    ).toBe('/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7#diff');
  });

  test('accepts localized internal routes', () => {
    expect(normalizeAuthReturnTo('/zh-cn/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo')).toBe(
      '/zh-cn/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo'
    );
  });

  test('rejects external and protocol-relative URLs', () => {
    expect(normalizeAuthReturnTo('https://evil.example/steal')).toBeNull();
    expect(normalizeAuthReturnTo('//evil.example/steal')).toBeNull();
  });

  test('rejects auth and API paths as return targets', () => {
    expect(normalizeAuthReturnTo('/auth/github')).toBeNull();
    expect(normalizeAuthReturnTo('/api/settings')).toBeNull();
  });

  test('rejects encoded external paths and malformed values without throwing', () => {
    expect(normalizeAuthReturnTo('/%2fexample.com')).toBeNull();
    expect(normalizeAuthReturnTo('/%5cexample.com')).toBeNull();
    expect(normalizeAuthReturnTo('/\ud800')).toBeNull();
    expect(normalizeAuthReturnTo(['/dashboard'])).toBeNull();
  });

  test('keeps configured base paths in OAuth navigation', () => {
    expect(withAppBase('/open?url=target', '/')).toBe('/open?url=target');
    expect(withAppBase('/open?url=target', '/gitpulse/')).toBe('/gitpulse/open?url=target');
    expect(withAppBase('/auth/github', '/gitpulse/')).toBe('/gitpulse/auth/github');
  });

  test('keeps the requested page when the real auth middleware sends a visitor to sign in', async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const replacements = {
      defineNuxtRouteMiddleware: (handler: unknown) => handler,
      useUserSession: () => ({ loggedIn: { value: false } }),
      useLocalePath: () => (path: string) => path,
      navigateTo: (target: unknown) => target,
    };
    const originals = Object.fromEntries(
      Object.keys(replacements).map((key) => [key, globals[key]])
    );

    Object.assign(globals, replacements);
    try {
      const { default: middleware } = await import('../app/middleware/auth.global');
      const fullPath = '/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7';
      const result = await (middleware as unknown as (to: unknown) => unknown)({
        path: '/open',
        fullPath,
      });

      expect(result).toEqual({ path: '/', query: { returnTo: fullPath } });
    } finally {
      Object.assign(globals, originals);
    }
  });
});
