import {
  buildInvolvesSearchQuery,
  normalizeSearchTotalCount,
} from '#server/utils/github-issue-search-route-utils';
import { translateGitHubSearchError } from '#server/utils/github-search-route-utils';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const page = parsePaginationNumber(getQuery(event).page, 1);
    const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 100);

    const { data, headers } = await octokit.request('GET /search/issues', {
      q: buildInvolvesSearchQuery('issue', userLogin),
      page,
      per_page: perPage,
    });

    const totalCount = normalizeSearchTotalCount(data.total_count);

    return {
      total_count: totalCount,
      items: data.items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount,
      }),
    };
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    translateGitHubSearchError(error, 'Failed to fetch issues');
  }
});
