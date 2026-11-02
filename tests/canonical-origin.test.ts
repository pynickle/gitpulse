import { afterEach, describe, expect, test } from 'bun:test';

import {
  CANONICAL_ORIGIN_ENV,
  installCanonicalOrigin,
  parseCanonicalOrigin,
  RETIRED_CANONICAL_ORIGIN_ENV,
  type CanonicalOriginEnv,
  type CanonicalOriginRuntimeConfig,
} from '../server/utils/canonical-origin';

const originalWarn = console.warn;

afterEach(() => {
  console.warn = originalWarn;
});

function productionEnv(overrides: CanonicalOriginEnv = {}): CanonicalOriginEnv {
  return { NODE_ENV: 'production', ...overrides };
}

function runtimeConfig(baseUrl = ''): CanonicalOriginRuntimeConfig {
  return { public: { i18n: { baseUrl } } };
}

describe('parseCanonicalOrigin', () => {
  test('normalizes a trailing slash and host case to the origin', () => {
    expect(parseCanonicalOrigin(' https://Example.COM:8443/ ')).toEqual({
      ok: true,
      origin: 'https://example.com:8443',
    });
  });

  test('accepts http and drops a default port', () => {
    expect(parseCanonicalOrigin('http://example.com:80')).toEqual({
      ok: true,
      origin: 'http://example.com',
    });
  });

  test.each([
    { label: 'missing', value: undefined, reason: /missing/ },
    { label: 'empty', value: '   ', reason: /empty/ },
    { label: 'not a url', value: 'example.com', reason: /absolute URL/ },
    { label: 'a path', value: 'https://example.com/docs', reason: /path/ },
    { label: 'a query', value: 'https://example.com/?q=1', reason: /query/ },
    { label: 'a hash', value: 'https://example.com/#top', reason: /hash/ },
    { label: 'credentials', value: 'https://user:secret@example.com', reason: /credentials/ },
    { label: 'a non-http protocol', value: 'ftp://example.com', reason: /http or https/ },
  ])('rejects an origin that is $label', ({ value, reason }) => {
    const parsed = parseCanonicalOrigin(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(reason);
  });
});

describe('installCanonicalOrigin', () => {
  test('copies a normalized origin onto the i18n base URL', () => {
    const config = runtimeConfig();

    expect(
      installCanonicalOrigin(config, productionEnv({ NUXT_SITE_URL: 'https://example.com/' }))
    ).toBe('https://example.com');
    expect(config.public.i18n?.baseUrl).toBe('https://example.com');
  });

  test.each([
    { label: 'missing', env: productionEnv() },
    { label: 'empty', env: productionEnv({ NUXT_SITE_URL: ' ' }) },
    { label: 'a path', env: productionEnv({ NUXT_SITE_URL: 'https://example.com/app' }) },
  ])('fails a production start when NUXT_SITE_URL is $label', ({ env }) => {
    expect(() => installCanonicalOrigin(runtimeConfig(), env)).toThrow(
      new RegExp(CANONICAL_ORIGIN_ENV)
    );
  });

  test('fails a production start when the retired site URL name is set', () => {
    expect(() =>
      installCanonicalOrigin(
        runtimeConfig(),
        productionEnv({
          NUXT_SITE_URL: 'https://example.com',
          NUXT_PUBLIC_SITE_URL: 'https://retired.example',
        })
      )
    ).toThrow(new RegExp(RETIRED_CANONICAL_ORIGIN_ENV));
  });

  test('only warns outside production', () => {
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    const config = runtimeConfig('unchanged');

    expect(
      installCanonicalOrigin(config, {
        NODE_ENV: 'development',
        NUXT_SITE_URL: '',
      })
    ).toBeUndefined();
    expect(config.public.i18n?.baseUrl).toBe('unchanged');
    expect(warnings.join(' ')).toContain(CANONICAL_ORIGIN_ENV);
  });

  test('refuses to install an origin when i18n runtime config is missing', () => {
    expect(() =>
      installCanonicalOrigin(
        { public: {} },
        productionEnv({ NUXT_SITE_URL: 'https://example.com' })
      )
    ).toThrow(/i18n runtime config is missing/);
  });
});
