/**
 * GitHub wiki helpers. Wikis have no REST API: the page list is parsed out of
 * the public wiki HTML sidebar and page bodies are fetched from
 * `raw.githubusercontent.com/wiki/...`, so only public wikis are readable.
 */

import type { WikiPageSummary } from '#shared/types/wiki';

export const WIKI_HOME_SLUG = 'Home';

/** Markdown extensions tried against the raw wiki host, most common first. */
export const WIKI_MARKDOWN_EXTENSIONS = ['md', 'markdown'] as const;

const GITHUB_WEB_ORIGIN = 'https://github.com';
const ANCHOR_PATTERN = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const TAG_PATTERN = /<[^>]*>/g;

export function buildWikiHtmlUrl(owner: string, repo: string, slug?: string) {
  const base = `${GITHUB_WEB_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/wiki`;
  return slug ? `${base}/${encodeURIComponent(slug)}` : base;
}

export function buildWikiRawUrl(owner: string, repo: string, slug: string, extension: string) {
  return `https://raw.githubusercontent.com/wiki/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(slug)}.${extension}`;
}

/** Wiki slugs are single path segments; reject traversal and nested paths. */
export function isValidWikiSlug(slug: string) {
  return (
    slug.length > 0 && slug.length <= 512 && slug !== '.' && slug !== '..' && !/[/\\]/.test(slug)
  );
}

function decodeWikiSlug(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/**
 * Extracts the rendered page body (`#wiki-body` inner HTML) from a wiki page's
 * HTML. This is the fallback content source when the raw markdown fetch
 * misses: wiki URLs are flat, but files pushed via git can live in
 * subdirectories the raw host needs spelled out, and pages can use non-markdown
 * markup — GitHub's rendered body covers both.
 */
export function extractWikiBodyHtml(html: string): string | null {
  const idIndex = html.indexOf('id="wiki-body"');
  if (idIndex === -1) return null;

  const openStart = html.lastIndexOf('<div', idIndex);
  if (openStart === -1) return null;

  const openEnd = html.indexOf('>', idIndex);
  if (openEnd === -1) return null;

  const divToken = /<div\b|<\/div>/gi;
  divToken.lastIndex = openEnd + 1;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = divToken.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return html.slice(openEnd + 1, match.index).trim() || null;
    }
  }

  return null;
}

export type WikiHtmlSegment = { type: 'html'; html: string } | { type: 'mermaid'; code: string };

const ENRICHMENT_SECTION_MARKER = 'js-render-needs-enrichment';
const ENRICHMENT_PLAIN_PATTERN = /data-plain="([^"]*)"/;
const ENRICHMENT_HIDDEN_PATTERN = /<div class="render-plaintext-hidden">([\s\S]*?)<\/div>/;

/**
 * Splits a rendered wiki body into plain HTML chunks and mermaid diagrams.
 * GitHub ships diagram blocks as enrichment `<section>`s whose real source
 * sits in a `data-plain` attribute next to a "Loading" spinner placeholder;
 * each section is replaced wholesale so the placeholder never leaks through.
 */
export function splitWikiHtmlSegments(html: string): WikiHtmlSegment[] {
  const segments: WikiHtmlSegment[] = [];
  let cursor = 0;

  const pushHtml = (chunk: string) => {
    if (chunk.trim()) {
      segments.push({ type: 'html', html: chunk });
    }
  };

  while (cursor < html.length) {
    const markerIndex = html.indexOf(ENRICHMENT_SECTION_MARKER, cursor);
    if (markerIndex === -1) break;

    const sectionStart = html.lastIndexOf('<section', markerIndex);
    const sectionClose = html.indexOf('</section>', markerIndex);
    if (sectionStart === -1 || sectionStart < cursor || sectionClose === -1) {
      cursor = markerIndex + ENRICHMENT_SECTION_MARKER.length;
      continue;
    }

    pushHtml(html.slice(cursor, sectionStart));

    const section = html.slice(sectionStart, sectionClose + '</section>'.length);
    const isMermaid = section.includes('data-type="mermaid"');
    const plainSource = ENRICHMENT_PLAIN_PATTERN.exec(section)?.[1];

    if (isMermaid && plainSource) {
      segments.push({ type: 'mermaid', code: decodeHtmlEntities(plainSource) });
    } else {
      // Other enrichment types (geojson, stl, …) fall back to their hidden
      // plaintext source instead of GitHub's non-functional loader.
      pushHtml(ENRICHMENT_HIDDEN_PATTERN.exec(section)?.[1] ?? '');
    }

    cursor = sectionClose + '</section>'.length;
  }

  pushHtml(html.slice(cursor));

  return segments;
}

/**
 * Extracts the page list from a wiki's HTML. Page links live in the
 * `#wiki-pages-box` sidebar; everything before it (header, rendered wiki body)
 * is skipped so in-content links don't pollute the list.
 */
export function parseWikiPagesFromHtml(
  html: string,
  owner: string,
  repo: string
): WikiPageSummary[] {
  const boxIndex = html.indexOf('id="wiki-pages-box"');
  const scope = boxIndex === -1 ? html : html.slice(boxIndex);
  const basePath = `/${owner}/${repo}/wiki`.toLowerCase();

  const pages: WikiPageSummary[] = [];
  const seenSlugs = new Set<string>();

  for (const match of scope.matchAll(ANCHOR_PATTERN)) {
    const rawHref = match[1] ?? '';
    const href = rawHref.startsWith(GITHUB_WEB_ORIGIN)
      ? rawHref.slice(GITHUB_WEB_ORIGIN.length)
      : rawHref;

    // Fragment links are section anchors inside a page, not pages.
    if (!href || href.includes('#') || href.includes('?')) continue;
    if (!href.toLowerCase().startsWith(basePath)) continue;

    const remainder = href.slice(basePath.length);
    if (remainder && !remainder.startsWith('/')) continue;

    const segment = remainder.slice(1);
    // Nested segments are page actions (`Page/_history`), not pages.
    if (segment.includes('/')) continue;

    // The bare `/owner/repo/wiki` link is the Home page.
    const slug = segment ? decodeWikiSlug(segment) : WIKI_HOME_SLUG;
    // `_Sidebar`/`_Footer` and friends are wiki plumbing, not pages.
    if (slug.startsWith('_')) continue;

    const slugKey = slug.toLowerCase();
    if (seenSlugs.has(slugKey)) continue;
    seenSlugs.add(slugKey);

    const title = decodeHtmlEntities(
      (match[2] ?? '').replaceAll(TAG_PATTERN, '').replaceAll(/\s+/g, ' ').trim()
    );
    pages.push({ slug, title: title || slug });
  }

  return pages;
}
