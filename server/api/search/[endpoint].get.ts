import {
  buildGitHubSearchRequestParams,
  createEmptyGitHubSearchResponse,
  getGitHubSearchEndpointFromEvent,
  normalizeGenericSearchTotalCount,
  translateGitHubSearchError,
} from '#server/utils/github-search-route-utils';

import { buildLinkedPaginationMeta } from '../../utils/github-pagination';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const endpoint = getGitHubSearchEndpointFromEvent(event);
  const requestParams = buildGitHubSearchRequestParams(event, endpoint);

  if (endpoint === 'labels' && !requestParams.repository_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repository_id is required for GitHub label search',
    });
  }

  if (!requestParams.q) {
    return createEmptyGitHubSearchResponse(requestParams);
  }

  try {
    const { octokit } = await getGitHubSessionContext(event);
    const { endpoint: _endpoint, ...searchParams } = requestParams;
    const { data, headers } = await (async () => {
      switch (endpoint) {
        case 'code':
          return octokit.request('GET /search/code', searchParams);
        case 'commits':
          return octokit.request('GET /search/commits', searchParams);
        case 'labels':
          return octokit.request('GET /search/labels', {
            ...searchParams,
            repository_id: requestParams.repository_id!,
          });
        case 'repositories':
          return octokit.request('GET /search/repositories', searchParams);
        case 'topics':
          return octokit.request('GET /search/topics', searchParams);
        case 'users':
          return octokit.request('GET /search/users', searchParams);
        case 'issues':
          return octokit.request('GET /search/issues', searchParams);
      }
    })();

    const totalCount = normalizeGenericSearchTotalCount(data.total_count);

    return {
      total_count: totalCount,
      incomplete_results: data.incomplete_results ?? false,
      request: requestParams,
      items: data.items,
      pagination: buildLinkedPaginationMeta({
        page: requestParams.page,
        perPage: requestParams.per_page,
        linkHeader: headers.link,
        totalCount,
      }),
    };
  } catch (error) {
    console.error(`Error fetching GitHub ${endpoint} search results:`, error);
    translateGitHubSearchError(error, 'Failed to fetch GitHub search results');
  }
});
