import { expect, test } from 'bun:test';

import { createRouter, toRouteMatcher } from 'radix3';

test('native approval routes are excluded from Nitro prerendering for every configured locale', async () => {
  const originalDefineConfig = Object.getOwnPropertyDescriptor(globalThis, 'defineNuxtConfig');
  const originalPersonalMode = process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
  Object.assign(globalThis, { defineNuxtConfig: (config: unknown) => config });
  process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = 'true';
  try {
    const { default: config } = await import('../nuxt.config');
    // Match the actual route-rule matcher used by Nitro 2's prerender crawler.
    const matcher = toRouteMatcher(createRouter({ routes: config.routeRules }));
    const paths = [
      '/native-login',
      ...config.i18n.locales.map((locale) => `/${locale.code}/native-login`),
    ];
    for (const path of paths) {
      expect(
        matcher.matchAll(path).some((rule) => rule.prerender === false),
        path
      ).toBe(true);
    }
    expect(matcher.matchAll('/').some((rule) => rule.prerender === false)).toBe(false);
    expect(matcher.matchAll('/zh-cn').some((rule) => rule.prerender === false)).toBe(false);
  } finally {
    if (originalDefineConfig)
      Object.defineProperty(globalThis, 'defineNuxtConfig', originalDefineConfig);
    else Reflect.deleteProperty(globalThis, 'defineNuxtConfig');
    if (originalPersonalMode === undefined) delete process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED;
    else process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED = originalPersonalMode;
  }
});
