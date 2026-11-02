/**
 * Locale alternates from `useLocaleHead`. Canonical and `og:url` stay with
 * site config, which already publishes one absolute URL per route.
 */
export function localeAlternateHead<
  TLink extends { rel?: string },
  TMeta extends { property?: string },
>(head: { link?: readonly TLink[]; meta?: readonly TMeta[] }) {
  return {
    link: (head.link ?? []).filter((link) => link.rel === 'alternate'),
    meta: (head.meta ?? []).filter((tag) => tag.property === 'og:locale:alternate'),
  };
}
