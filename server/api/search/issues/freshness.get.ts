import { getLatestUpdatedAt, type FreshnessResponse } from '#server/utils/freshness-response-utils';
import {
  buildIssueSearchRequestParams,
  getGitHubErrorHeader,
  normalizeSearchTotalCount,
} from '#server/utils/github-issue-search-route-utils';
import { createCollectionFreshnessSignature } from '#shared/utils/freshness';

import { getGitHubErrorStatusCode } from '../../../utils/github-auth-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit } = await getGitHubSessionContext(event);
    const requestParams = buildIssueSearchRequestParams(event, {
      defaultPerPage: 5,
      maxPerPage: 10,
    });

    const { data } = await octokit.request('GET /search/issues', {
      ...requestParams,
      page: 1,
    });
    const totalCount = normalizeSearchTotalCount(data.total_count);

    return {
      signature: createCollectionFreshnessSignature(data.items, {
        totalCount,
        q: requestParams.q,
        sort: requestParams.sort,
        order: requestParams.order,
      }),
      itemCount: data.items.length,
      totalCount,
      latestUpdatedAt: getLatestUpdatedAt(data.items),
    } satisfies FreshnessResponse;
  } catch (error) {
    console.error('Error checking GitHub issue search freshness:', error);

    const status = getGitHubErrorStatusCode(error);

    if (status === 422) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Invalid GitHub search query',
      });
    }

    const remainingSearchRequests = getGitHubErrorHeader(error, 'x-ratelimit-remaining');
    const rateLimitResource = getGitHubErrorHeader(error, 'x-ratelimit-resource');

    if (status === 403 && remainingSearchRequests === '0' && rateLimitResource === 'search') {
      throw createError({
        statusCode: 429,
        statusMessage: 'GitHub search rate limit exceeded',
      });
    }

    if (status === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: 'GitHub search request forbidden',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check GitHub search freshness',
    });
  }
});
