export const publicSiteName = 'GitPulse';

export const publicSiteDescription =
  'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.';

export const appLocales = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh-cn', language: 'zh-CN', name: '中文', file: 'zh-cn.json' },
] as const;

export const defaultLocaleCode = 'en' satisfies (typeof appLocales)[number]['code'];

/**
 * One route as a single locale spells it. The default locale is unprefixed, so
 * it keeps the path unchanged; every other locale gets a leading segment.
 */
export function localeVariantPath(localeCode: string, path: string): string {
  if (localeCode === defaultLocaleCode) return path;
  return path === '/' ? `/${localeCode}` : `/${localeCode}${path}`;
}

/**
 * Every configured spelling of one route, e.g. `['/dashboard', '/zh-cn/dashboard']`.
 * Route-rule keys are matched by two engines that do not agree on wildcard
 * placement, so locale prefixes are expanded here instead of written as `/**`.
 */
export function localeVariants(path: string): string[] {
  return appLocales.map((locale) => localeVariantPath(locale.code, path));
}

export function publicLandingPath(localeCode: string): string {
  return localeVariantPath(localeCode, '/');
}
