import { describe, expect, test } from 'bun:test';

import {
  hasAuthReturnQuery,
  landingAuthReturnHead,
  landingCanonicalHref,
  notFoundRobots,
} from '../app/utils/publicSurfaceHead';
import {
  resolveDiscoveryDocuments,
  withDiscoverySitemap,
} from '../shared/utils/discovery-documents';

const origin = 'https://example.com';

describe('resolveDiscoveryDocuments', () => {
  test('publishes landing pages only when the deployment is indexable and has an origin', () => {
    const documents = resolveDiscoveryDocuments({ indexable: true, origin });

    expect(documents?.origin).toBe(origin);
    expect(documents?.sitemapXml).toContain('<loc>https://example.com/</loc>');
    expect(documents?.sitemapXml).toContain('<loc>https://example.com/zh-cn</loc>');
    expect(documents?.sitemapXml).toContain('hreflang="zh-CN"');
    expect(documents?.sitemapXml).toContain('hreflang="x-default"');
    expect(documents?.sitemapXml).not.toContain('/dashboard');
    expect(documents?.sitemapXml).not.toContain('/open');
    expect(documents?.llmsTxt).toMatch(/^# GitPulse/m);
    expect(documents?.llmsTxt).toContain('[English](https://example.com/)');
    expect(documents?.llmsTxt).toContain('[中文](https://example.com/zh-cn)');
    expect(documents?.llmsTxt.length).toBeGreaterThan(50);
  });

  test('omits discovery documents when the deployment is not indexable or has no origin', () => {
    expect(resolveDiscoveryDocuments({ indexable: false, origin })).toBeNull();
    expect(resolveDiscoveryDocuments({ indexable: true, origin: undefined })).toBeNull();
  });
});

describe('withDiscoverySitemap', () => {
  test('advertises the canonical sitemap inside the robots block', () => {
    const robots = `# START nuxt-robots (indexable)
User-Agent: *
Disallow: /dashboard

# END nuxt-robots
`;

    expect(withDiscoverySitemap(robots, 'https://example.com/sitemap.xml')).toContain(
      'Sitemap: https://example.com/sitemap.xml\n# END nuxt-robots'
    );
  });

  test('leaves robots unchanged when there is no sitemap', () => {
    const robots = 'User-Agent: *\nDisallow: /\n';
    expect(withDiscoverySitemap(robots, null)).toBe(robots);
  });
});

describe('public surface head', () => {
  test('marks a 404 noindex and leaves other statuses alone', () => {
    expect(notFoundRobots(404)).toBe('noindex, nofollow');
    expect(notFoundRobots(500)).toBeUndefined();
  });

  test('marks a landing URL that carries returnTo noindex and canonicalizes it without the query', () => {
    expect(hasAuthReturnQuery({ returnTo: '/xyz-nope' })).toBe(true);
    expect(hasAuthReturnQuery({})).toBe(false);

    const href = landingCanonicalHref({
      localePath: '/zh-cn',
      canonicalOrigin: origin,
      requestOrigin: 'https://request.example',
    });
    expect(href).toBe('https://example.com/zh-cn');
    expect(landingAuthReturnHead({ hasReturnTo: true, canonicalHref: href })).toEqual({
      robots: 'noindex, nofollow',
      canonicalHref: href,
    });
    expect(landingAuthReturnHead({ hasReturnTo: false, canonicalHref: href })).toBeNull();
  });
});
