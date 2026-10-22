import { afterEach, describe, expect, mock, test } from 'bun:test';

import { createApp, getHeader, toWebHandler, type H3Event } from 'h3';

import * as authReturn from '../shared/utils/auth-return-route';
import * as env from '../shared/utils/user-settings-storage-env';
mock.module('#shared/utils/auth-return-route', () => authReturn);
mock.module('#shared/utils/user-settings-storage-env', () => env);

const originalRuntimeConfig = globalThis.useRuntimeConfig;
afterEach(() => {
  globalThis.useRuntimeConfig = originalRuntimeConfig;
});

function configureProviders(personal: boolean, pat = true, oauth = true) {
  globalThis.useRuntimeConfig = (() => ({
    gitPulseAuth: {
      personalModeEnabled: personal,
      tokenEnabled: pat,
      githubOAuthEnabled: oauth,
      githubToken: 'server-only-token',
      personalPassword: 'server-only-password',
      personalCookieSecret: 'server-only-secret',
    },
    session: { password: 'native-capabilities-session-password-32-characters' },
  })) as typeof useRuntimeConfig;
}

async function getPublicResponse(path: 'native/capabilities' | 'auth/providers') {
  const handler =
    path === 'native/capabilities'
      ? (await import('../server/api/native/capabilities.get')).default
      : (await import('../server/api/auth/providers.get')).default;
  const app = createApp();
  app.use(`/api/${path}`, handler);
  const response = await toWebHandler(app)(new Request(`https://gitpulse.test/api/${path}`));
  expect(response.status).toBe(200);
  return response.json();
}

describe('public native connection contract', () => {
  test('provider discovery uses the current request runtime config', async () => {
    globalThis.useRuntimeConfig = ((event?: H3Event) => ({
      gitPulseAuth: {
        personalModeEnabled: false,
        tokenEnabled: getHeader(event!, 'x-test-provider') === 'pat',
        githubOAuthEnabled: getHeader(event!, 'x-test-provider') === 'oauth',
      },
      session: { password: 'request-scoped-session-password-32-characters' },
    })) as typeof useRuntimeConfig;
    const handler = (await import('../server/api/native/capabilities.get')).default;
    const app = createApp().use('/api/native/capabilities', handler);
    const request = toWebHandler(app);

    for (const provider of ['pat', 'oauth']) {
      const response = await request(
        new Request('https://gitpulse.test/api/native/capabilities', {
          headers: { 'x-test-provider': provider },
        })
      );
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.providers.mode).toBe(`${provider}-only`);
      expect(result.capabilities.includes('native-login-handoff')).toBe(provider === 'oauth');
    }
  });

  test('personal mode advertises only password unlock, discovery, and timeline reading', async () => {
    configureProviders(true);
    expect(await getPublicResponse('native/capabilities')).toEqual({
      protocolVersion: 1,
      capabilities: ['provider-discovery', 'release-timeline', 'timeline-retention'],
      providers: { personalMode: true, patEnabled: false, oauthEnabled: false, mode: 'personal' },
    });
    const providers = await getPublicResponse('auth/providers');
    expect(providers.personalMode).toBe(true);
    expect(providers.patEnabled).toBe(false);
    expect(providers.oauthEnabled).toBe(false);
  });

  test.each([
    [true, false, 'pat-only'],
    [false, true, 'oauth-only'],
    [true, true, 'hybrid'],
  ] as const)(
    'discovers PAT=%s OAuth=%s as %s without authentication',
    async (pat, oauth, mode) => {
      configureProviders(false, pat, oauth);
      const result = await getPublicResponse('native/capabilities');
      expect(result.providers).toEqual({
        personalMode: false,
        patEnabled: pat,
        oauthEnabled: oauth,
        mode,
      });
      expect(result.capabilities).toEqual([
        'provider-discovery',
        'release-timeline',
        'timeline-retention',
        ...(oauth ? ['native-login-handoff'] : []),
      ]);
      expect(await getPublicResponse('auth/providers')).toMatchObject(result.providers);
      expect(JSON.stringify(result)).not.toContain('server-only');
    }
  );
});
