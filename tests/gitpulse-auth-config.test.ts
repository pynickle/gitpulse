import { afterEach, describe, expect, test } from 'bun:test';

import {
  AUTH_PERSONAL_MODE_CONFIGURATION_ERROR,
  getGitpulseAuthConfig,
  resolveAuthProviderState,
} from '../server/utils/auth-providers';

const LEGACY_GITHUB_TOKEN = 'NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN';
const LEGACY_PASSWORD = 'NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD';
const LEGACY_COOKIE_SECRET = 'NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET';
const LEGACY_ENV_NAMES = [LEGACY_GITHUB_TOKEN, LEGACY_PASSWORD, LEGACY_COOKIE_SECRET] as const;

const originalRuntimeConfig = globalThis.useRuntimeConfig;
const originalEnv = Object.fromEntries(LEGACY_ENV_NAMES.map((name) => [name, process.env[name]]));

afterEach(() => {
  globalThis.useRuntimeConfig = originalRuntimeConfig;
  for (const name of LEGACY_ENV_NAMES) {
    const original = originalEnv[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

function setRuntimeConfig(gitpulseAuth: Record<string, unknown>) {
  globalThis.useRuntimeConfig = (() => ({ gitpulseAuth })) as typeof useRuntimeConfig;
}

describe('gitpulse auth secrets', () => {
  test('keeps the configured secret when the old GIT_PULSE env name is also set', () => {
    process.env[LEGACY_GITHUB_TOKEN] = 'legacy-token';
    process.env[LEGACY_PASSWORD] = 'legacy-password';
    process.env[LEGACY_COOKIE_SECRET] = 'legacy-cookie-secret';
    setRuntimeConfig({
      githubToken: 'current-token',
      personalPassword: 'current-password',
      personalCookieSecret: 'current-cookie-secret',
    });

    expect(getGitpulseAuthConfig()).toMatchObject({
      githubToken: 'current-token',
      personalPassword: 'current-password',
      personalCookieSecret: 'current-cookie-secret',
    });
  });

  test('fills a blank secret from the old GIT_PULSE env name', () => {
    process.env[LEGACY_GITHUB_TOKEN] = 'legacy-token';
    process.env[LEGACY_PASSWORD] = 'legacy-password';
    process.env[LEGACY_COOKIE_SECRET] = 'legacy-cookie-secret';
    setRuntimeConfig({
      githubToken: ' ',
      personalPassword: '',
    });

    expect(getGitpulseAuthConfig()).toMatchObject({
      githubToken: 'legacy-token',
      personalPassword: 'legacy-password',
      personalCookieSecret: 'legacy-cookie-secret',
    });
  });

  test('starts personal mode from the old GIT_PULSE env names', () => {
    process.env[LEGACY_GITHUB_TOKEN] = 'legacy-token';
    process.env[LEGACY_PASSWORD] = 'legacy-password';
    process.env[LEGACY_COOKIE_SECRET] = 'legacy-cookie-secret';
    setRuntimeConfig({ personalModeEnabled: true });

    expect(resolveAuthProviderState().mode).toBe('personal');
  });

  test('refuses personal mode when neither secret name is set', () => {
    delete process.env[LEGACY_GITHUB_TOKEN];
    delete process.env[LEGACY_PASSWORD];
    delete process.env[LEGACY_COOKIE_SECRET];
    setRuntimeConfig({
      personalModeEnabled: true,
      githubToken: '',
      personalPassword: '',
      personalCookieSecret: '',
    });

    expect(() => resolveAuthProviderState()).toThrow(AUTH_PERSONAL_MODE_CONFIGURATION_ERROR);
  });
});
