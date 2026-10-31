import { afterEach, describe, expect, test } from 'bun:test';

import { assertAppSecretStrength, MIN_APP_SECRET_LENGTH } from '../server/utils/app-secret-utils';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('app secret startup validation', () => {
  test.each([
    { label: 'unset', value: undefined },
    { label: 'empty', value: '' },
    { label: 'too short', value: 'a'.repeat(MIN_APP_SECRET_LENGTH - 1) },
  ])('fails a production start when NUXT_APP_SECRET is $label', ({ value }) => {
    process.env.NODE_ENV = 'production';
    expect(() => assertAppSecretStrength(value)).toThrow(/NUXT_APP_SECRET/);
  });

  test('accepts a secret at the minimum length', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertAppSecretStrength('a'.repeat(MIN_APP_SECRET_LENGTH))).not.toThrow();
  });

  test('ignores a non-string appSecret instead of trusting it', () => {
    process.env.NODE_ENV = 'production';
    // Nitro parses environment overrides, so a quoted value can arrive as an array.
    expect(() => assertAppSecretStrength(['a'.repeat(64)])).toThrow(/NUXT_APP_SECRET/);
  });

  test('only warns outside production, where Nuxt generates a dev secret', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertAppSecretStrength('')).not.toThrow();
  });
});
