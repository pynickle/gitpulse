import { describe, expect, test } from 'bun:test';

import {
  buildWikiHtmlUrl,
  buildWikiRawUrl,
  extractWikiBodyHtml,
  isValidWikiSlug,
  parseWikiPagesFromHtml,
  splitWikiHtmlSegments,
} from '../shared/utils/github-wiki';

const OWNER = 'PCL-Community';
const REPO = 'PCL-CE';

/** Modeled on the real wiki sidebar markup (`#wiki-pages-box`). */
const buildWikiHtml = (body: string) => `
  <html>
    <body>
      <div class="wiki-body">
        <a href="/${OWNER}/${REPO}/wiki/Linked-From-Content">in-content link outside the box</a>
      </div>
      <div id="wiki-pages-box" class="wiki-pages-box">
        ${body}
      </div>
    </body>
  </html>
`;

describe('parseWikiPagesFromHtml', () => {
  test('extracts pages from the sidebar box, mapping the bare wiki link to Home', () => {
    const html = buildWikiHtml(`
      <li><a class="wiki-page-link" href="/${OWNER}/${REPO}/wiki">Home</a></li>
      <li><a class="wiki-page-link" href="/${OWNER}/${REPO}/wiki/API">API</a></li>
      <li><a class="wiki-page-link" href="/${OWNER}/${REPO}/wiki/Custom-Scripts">Custom Scripts</a></li>
    `);

    expect(parseWikiPagesFromHtml(html, OWNER, REPO)).toEqual([
      { slug: 'Home', title: 'Home' },
      { slug: 'API', title: 'API' },
      { slug: 'Custom-Scripts', title: 'Custom Scripts' },
    ]);
  });

  test('ignores content links before the sidebar box', () => {
    const html = buildWikiHtml(`
      <li><a href="/${OWNER}/${REPO}/wiki">Home</a></li>
    `);

    const slugs = parseWikiPagesFromHtml(html, OWNER, REPO).map((page) => page.slug);
    expect(slugs).not.toContain('Linked-From-Content');
  });

  test('skips section anchors, page actions, and wiki plumbing pages', () => {
    const html = buildWikiHtml(`
      <li><a href="/${OWNER}/${REPO}/wiki">Home</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki#setup">Setup section</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/API#usage">API usage section</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/Home/_history">History</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/_new">New page</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/_Sidebar">Sidebar</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/API?query=1">API with query</a></li>
    `);

    expect(parseWikiPagesFromHtml(html, OWNER, REPO)).toEqual([{ slug: 'Home', title: 'Home' }]);
  });

  test('decodes percent-encoded slugs and HTML entities in titles', () => {
    const html = buildWikiHtml(`
      <li><a href="/${OWNER}/${REPO}/wiki/%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97">开发指南</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/QA">Q&amp;A &lt;FAQ&gt;</a></li>
    `);

    expect(parseWikiPagesFromHtml(html, OWNER, REPO)).toEqual([
      { slug: '开发指南', title: '开发指南' },
      { slug: 'QA', title: 'Q&A <FAQ>' },
    ]);
  });

  test('deduplicates repeated links and strips nested markup from titles', () => {
    const html = buildWikiHtml(`
      <li><a href="/${OWNER}/${REPO}/wiki/API"><strong>API</strong> reference</a></li>
      <li><a href="/${OWNER}/${REPO}/wiki/API">API again</a></li>
      <li><a href="https://github.com/${OWNER}/${REPO}/wiki/Absolute">Absolute link</a></li>
    `);

    expect(parseWikiPagesFromHtml(html, OWNER, REPO)).toEqual([
      { slug: 'API', title: 'API reference' },
      { slug: 'Absolute', title: 'Absolute link' },
    ]);
  });

  test('matches the repo path case-insensitively but keeps slug casing', () => {
    const html = buildWikiHtml(`
      <li><a href="/pcl-community/pcl-ce/wiki/Some-Page">Some Page</a></li>
    `);

    expect(parseWikiPagesFromHtml(html, OWNER, REPO)).toEqual([
      { slug: 'Some-Page', title: 'Some Page' },
    ]);
  });

  test('returns an empty list when the sidebar box has no page links', () => {
    expect(parseWikiPagesFromHtml(buildWikiHtml(''), OWNER, REPO)).toEqual([]);
  });
});

describe('wiki url builders', () => {
  test('builds wiki html urls with and without a page slug', () => {
    expect(buildWikiHtmlUrl(OWNER, REPO)).toBe(`https://github.com/${OWNER}/${REPO}/wiki`);
    expect(buildWikiHtmlUrl(OWNER, REPO, '开发指南')).toBe(
      `https://github.com/${OWNER}/${REPO}/wiki/%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97`
    );
  });

  test('builds raw urls with the requested extension and encoded slug', () => {
    expect(buildWikiRawUrl(OWNER, REPO, 'C++ Guide', 'md')).toBe(
      `https://raw.githubusercontent.com/wiki/${OWNER}/${REPO}/C%2B%2B%20Guide.md`
    );
  });
});

describe('extractWikiBodyHtml', () => {
  test('extracts the balanced inner HTML of the wiki body container', () => {
    const html = `
      <div class="Layout-main">
        <div id="wiki-body" class="gollum-markdown-content">
          <div class="markdown-body">
            <h1>Title</h1>
            <div class="markdown-alert"><p>Note</p></div>
          </div>
        </div>
        <div id="wiki-rightbar">sidebar</div>
      </div>
    `;

    const body = extractWikiBodyHtml(html);
    expect(body).toContain('<h1>Title</h1>');
    expect(body).toContain('markdown-alert');
    expect(body).not.toContain('wiki-rightbar');
  });

  test('returns null when there is no wiki body container', () => {
    expect(extractWikiBodyHtml('<div class="markdown-body">x</div>')).toBeNull();
  });

  test('returns null for an empty wiki body', () => {
    expect(extractWikiBodyHtml('<div id="wiki-body"></div>')).toBeNull();
  });
});

describe('splitWikiHtmlSegments', () => {
  /** Modeled on GitHub's real mermaid enrichment section markup. */
  const mermaidSection = `<section class="js-render-needs-enrichment render-needs-enrichment position-relative" data-type="mermaid" aria-label="mermaid rendered output container">
  <div class="js-render-enrichment-target" data-json="{}" data-plain="flowchart LR
    P[Publisher] --&gt;|PublishAsync| C{Channel}
">
    <div class="render-plaintext-hidden"><pre lang="mermaid">flowchart LR</pre></div>
  </div>
  <span class="js-render-enrichment-loader">Loading</span>
</section>`;

  test('replaces mermaid enrichment sections with decoded diagram source', () => {
    const segments = splitWikiHtmlSegments(`<p>before</p>${mermaidSection}<p>after</p>`);

    expect(segments).toEqual([
      { type: 'html', html: '<p>before</p>' },
      { type: 'mermaid', code: 'flowchart LR\n    P[Publisher] -->|PublishAsync| C{Channel}\n' },
      { type: 'html', html: '<p>after</p>' },
    ]);
  });

  test('never leaks the enrichment loader placeholder', () => {
    const segments = splitWikiHtmlSegments(`<p>intro</p>${mermaidSection}`);
    const htmlChunks = segments.filter((segment) => segment.type === 'html');

    for (const chunk of htmlChunks) {
      expect(chunk.html).not.toContain('Loading');
      expect(chunk.html).not.toContain('js-render-enrichment-loader');
    }
  });

  test('returns the whole body as one chunk when there are no enrichment sections', () => {
    expect(splitWikiHtmlSegments('<h1>Title</h1><p>Body</p>')).toEqual([
      { type: 'html', html: '<h1>Title</h1><p>Body</p>' },
    ]);
  });

  test('falls back to the hidden plaintext source for non-mermaid enrichments', () => {
    const geojsonSection = `<section class="js-render-needs-enrichment" data-type="geojson">
  <div class="js-render-enrichment-target" data-json="{}">
    <div class="render-plaintext-hidden"><pre lang="geojson">{"type":"Point"}</pre></div>
  </div>
  <span class="js-render-enrichment-loader">Loading</span>
</section>`;

    const segments = splitWikiHtmlSegments(geojsonSection);
    expect(segments).toEqual([
      { type: 'html', html: '<pre lang="geojson">{"type":"Point"}</pre>' },
    ]);
  });
});

describe('isValidWikiSlug', () => {
  test('accepts single-segment names including unicode', () => {
    expect(isValidWikiSlug('Home')).toBe(true);
    expect(isValidWikiSlug('开发指南')).toBe(true);
    expect(isValidWikiSlug('FAQ-v1.2')).toBe(true);
  });

  test('rejects traversal and nested paths', () => {
    expect(isValidWikiSlug('')).toBe(false);
    expect(isValidWikiSlug('.')).toBe(false);
    expect(isValidWikiSlug('..')).toBe(false);
    expect(isValidWikiSlug('a/b')).toBe(false);
    expect(isValidWikiSlug('a\\b')).toBe(false);
  });
});
