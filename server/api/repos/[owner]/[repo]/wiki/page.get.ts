import { getAccessToken } from '#server/utils/github-auth-utils';
import { extractRepoParams, getStringQueryParam } from '#server/utils/repo-route-utils';
import type { WikiPageContentResponse } from '#shared/types/wiki';
import {
  WIKI_MARKDOWN_EXTENSIONS,
  buildWikiHtmlUrl,
  buildWikiRawUrl,
  extractWikiBodyHtml,
  isValidWikiSlug,
} from '#shared/utils/github-wiki';

const WIKI_FETCH_TIMEOUT_MS = 10_000;

const WIKI_RAW_FETCH_HEADERS = {
  accept: 'text/plain',
  'user-agent': 'gitpulse',
};

const WIKI_HTML_FETCH_HEADERS = {
  accept: 'text/html',
  'user-agent': 'gitpulse',
};

export default definePrivateApiCoalescedEventHandler(
  async (event): Promise<WikiPageContentResponse> => {
    // Session-gated like every private API route, though GitHub is fetched anonymously.
    await getAccessToken(event);

    const { owner, repo } = extractRepoParams(event);
    // Page name travels as a query param (never a path segment) because wiki
    // slugs may contain characters like `.` that break route matching.
    const slug = getStringQueryParam(getQuery(event).name)?.trim();

    if (!slug || !isValidWikiSlug(slug)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid wiki page name',
      });
    }

    const htmlUrl = buildWikiHtmlUrl(owner, repo, slug);

    try {
      // Fast path: the raw markdown file at the wiki repo root.
      for (const extension of WIKI_MARKDOWN_EXTENSIONS) {
        const response = await fetch(buildWikiRawUrl(owner, repo, slug, extension), {
          headers: WIKI_RAW_FETCH_HEADERS,
          signal: AbortSignal.timeout(WIKI_FETCH_TIMEOUT_MS),
        });

        if (response.ok) {
          return { slug, content: await response.text(), format: 'markdown', htmlUrl };
        }
      }

      // Fallback: wiki URLs are flat but files pushed via git can live in
      // subdirectories the raw host needs spelled out (and pages can use
      // non-markdown markup). GitHub's rendered body covers both; the client
      // sanitizes it before display.
      const pageResponse = await fetch(htmlUrl, {
        headers: WIKI_HTML_FETCH_HEADERS,
        redirect: 'manual',
        signal: AbortSignal.timeout(WIKI_FETCH_TIMEOUT_MS),
      });

      if (pageResponse.ok) {
        const body = extractWikiBodyHtml(await pageResponse.text());
        if (body) {
          return { slug, content: body, format: 'html', htmlUrl };
        }
      }
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to fetch wiki page',
      });
    }

    return { slug, content: null, format: null, htmlUrl };
  }
);
