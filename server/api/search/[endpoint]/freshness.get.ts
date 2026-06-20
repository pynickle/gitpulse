import { getLatestUpdatedAt, type FreshnessResponse } from '#server/utils/freshness-response-utils';
import {
  buildGitHubSearchRequestParams,
  getGitHubSearchEndpointFromEvent,
  translateGitHubSearchError,
} from '#server/utils/github-search-route-utils';
import {
  createCollectionFreshnessSignature,
  type FreshnessMarkerInput,
} from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const endpoint = getGitHubSearchEndpointFromEvent(event);
  const requestParams = buildGitHubSearchRequestParams(event, endpoint, {
    defaultPerPage: 5,
    maxPerPage: 10,
  });

  if (endpoint === 'labels' && !requestParams.repository_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repository_id is required for GitHub label search',
    });
  }

  if (!requestParams.q) {
    return {
      signature: createCollectionFreshnessSignature([], {
        totalCount: 0,
        q: '',
        endpoint,
      }),
      itemCount: 0,
      totalCount: 0,
      latestUpdatedAt: null,
    } satisfies FreshnessResponse;
  }

  try {
    const { octokit } = await getGitHubSessionContext(event);
    const { endpoint: _endpoint, ...searchParams } = requestParams;
    const { data } = await (async () => {
      switch (endpoint) {
        case 'code':
          return octokit.request('GET /search/code', { ...searchParams, page: 1 });
        case 'commits':
          return octokit.request('GET /search/commits', { ...searchParams, page: 1 });
        case 'labels':
          return octokit.request('GET /search/labels', {
            ...searchParams,
            repository_id: requestParams.repository_id!,
            page: 1,
          });
        case 'repositories':
          return octokit.request('GET /search/repositories', { ...searchParams, page: 1 });
        case 'topics':
          return octokit.request('GET /search/topics', { ...searchParams, page: 1 });
        case 'users':
          return octokit.request('GET /search/users', { ...searchParams, page: 1 });
        case 'issues':
          return octokit.request('GET /search/issues', { ...searchParams, page: 1 });
      }
    })();
    const totalCount = Math.min(data.total_count ?? 0, 1000);
    const items = data.items as FreshnessMarkerInput[];

    return {
      signature: createCollectionFreshnessSignature(items, {
        totalCount,
        q: requestParams.q,
        endpoint,
        repositoryId: String(requestParams.repository_id ?? ''),
      }),
      itemCount: items.length,
      totalCount,
      latestUpdatedAt: getLatestUpdatedAt(items),
    } satisfies FreshnessResponse;
  } catch (error) {
    console.error(`Error checking GitHub ${endpoint} search freshness:`, error);
    translateGitHubSearchError(error, 'Failed to check GitHub search freshness');
  }
});
