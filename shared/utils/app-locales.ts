export const publicSiteName = 'GitPulse';

export const publicSiteDescription =
  'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.';

export const appLocales = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh-cn', language: 'zh-CN', name: '中文', file: 'zh-cn.json' },
] as const;

export const defaultLocaleCode = 'en' satisfies (typeof appLocales)[number]['code'];

export function publicLandingPath(localeCode: string): string {
  return localeCode === defaultLocaleCode ? '/' : `/${localeCode}`;
}
