import { expect, test } from 'bun:test';

import { localeAlternateHead } from '../app/utils/localeAlternateHead';

test('keeps locale alternates and leaves the single canonical to site config', () => {
  const head = localeAlternateHead({
    link: [
      { id: 'i18n-xd', rel: 'alternate', href: 'https://example.com/', hreflang: 'x-default' },
      { id: 'i18n-alt-en-US', rel: 'alternate', href: 'https://example.com/', hreflang: 'en-US' },
      {
        id: 'i18n-alt-zh-CN',
        rel: 'alternate',
        href: 'https://example.com/zh-cn',
        hreflang: 'zh-CN',
      },
      { id: 'i18n-can', rel: 'canonical', href: 'https://example.com/' },
    ],
    meta: [
      { id: 'i18n-og-url', property: 'og:url', content: 'https://example.com/' },
      { id: 'i18n-og', property: 'og:locale', content: 'en_US' },
      { id: 'i18n-og-alt-zh-CN', property: 'og:locale:alternate', content: 'zh_CN' },
    ],
  });

  expect(head.link.map((link) => link.hreflang)).toEqual(['x-default', 'en-US', 'zh-CN']);
  expect(head.link.some((link) => link.rel === 'canonical')).toBe(false);
  expect(head.meta).toEqual([
    { id: 'i18n-og-alt-zh-CN', property: 'og:locale:alternate', content: 'zh_CN' },
  ]);
});
