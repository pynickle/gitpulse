import { getAccessToken } from '#server/utils/github-auth-utils';
import { extractRepoParams } from '#server/utils/repo-route-utils';
import type { WikiPageListResponse } from '#shared/types/wiki';
import { buildWikiHtmlUrl, parseWikiPagesFromHtml } from '#shared/utils/github-wiki';

const WIKI_FETCH_TIMEOUT_MS = 10_000;

/** Wikis have no REST API; the page list only exists in the public wiki HTML. */
const WIKI_FETCH_HEADERS = {
  accept: 'text/html',
  'user-agent': 'gitpulse',
};

export default definePrivateApiCoalescedEventHandler(
  async (event): Promise<WikiPageListResponse> => {
    // Session-gated like every private API route, though GitHub is fetched anonymously.
    await getAccessToken(event);

    const { owner, repo } = extractRepoParams(event);
    const htmlUrl = buildWikiHtmlUrl(owner, repo);

    let response: Response;
    try {
      response = await fetch(htmlUrl, {
        headers: WIKI_FETCH_HEADERS,
        redirect: 'manual',
        signal: AbortSignal.timeout(WIKI_FETCH_TIMEOUT_MS),
      });
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to fetch wiki pages',
      });
    }

    // Repos without a wiki redirect to the repo root; private/missing ones 404.
    if (!response.ok) {
      return { available: false, pages: [], htmlUrl };
    }

    const html = await response.text();

    return {
      available: true,
      pages: parseWikiPagesFromHtml(html, owner, repo),
      htmlUrl,
    };
  }
);
