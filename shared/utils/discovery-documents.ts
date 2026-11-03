import {
  appLocales,
  defaultLocaleCode,
  publicLandingPath,
  publicSiteDescription,
  publicSiteName,
} from './app-locales';

const SITEMAP_END_MARKER = '# END nuxt-robots';

export interface DiscoveryDocuments {
  origin: string;
  sitemapXml: string;
  llmsTxt: string;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function landingUrls(origin: string): { code: string; language: string; href: string }[] {
  return appLocales.map((locale) => ({
    code: locale.code,
    language: locale.language,
    href: new URL(publicLandingPath(locale.code), origin).href,
  }));
}

export function buildSitemapXml(origin: string): string {
  const pages = landingUrls(origin);
  const defaultHref =
    pages.find((page) => page.code === defaultLocaleCode)?.href ?? new URL('/', origin).href;
  const alternates = [
    ...pages.map(
      (page) =>
        `    <xhtml:link rel="alternate" hreflang="${xmlEscape(page.language)}" href="${xmlEscape(page.href)}"/>`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(defaultHref)}"/>`,
  ].join('\n');
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${xmlEscape(page.href)}</loc>
${alternates}
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

export function buildLlmsTxt(origin: string): string {
  const links = appLocales
    .map((locale) => {
      const href = new URL(publicLandingPath(locale.code), origin).href;
      return `- [${locale.name}](${href})`;
    })
    .join('\n');

  return `# ${publicSiteName}

> ${publicSiteDescription}

The dashboard requires a session. These pages are public.

## Pages

${links}
`;
}

/** Indexable deployments with a canonical origin publish sitemap.xml and llms.txt. */
export function resolveDiscoveryDocuments(input: {
  indexable: boolean;
  origin: string | undefined;
}): DiscoveryDocuments | null {
  if (!input.indexable || !input.origin) return null;
  return {
    origin: input.origin,
    sitemapXml: buildSitemapXml(input.origin),
    llmsTxt: buildLlmsTxt(input.origin),
  };
}

export function withDiscoverySitemap(robotsTxt: string, sitemapUrl: string | null): string {
  if (!sitemapUrl) return robotsTxt;
  const line = `Sitemap: ${sitemapUrl}`;
  if (robotsTxt.includes(line)) return robotsTxt;
  if (robotsTxt.includes(SITEMAP_END_MARKER)) {
    return robotsTxt.replace(SITEMAP_END_MARKER, `${line}\n${SITEMAP_END_MARKER}`);
  }
  return `${robotsTxt.trimEnd()}\n${line}\n`;
}
