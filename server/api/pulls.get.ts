import { getOneYearAgoSearchDate } from '#shared/utils/github-search-query';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

const SEARCH_TOTAL_COUNT_LIMIT = 1000;

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const createdDate = getOneYearAgoSearchDate();
    const page = parsePaginationNumber(getQuery(event).page, 1);
    const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 100);

    const q = [
      'is:pr',
      'is:open',
      'archived:false',
      `created:>=${createdDate}`,
      `involves:${userLogin}`,
      'sort:updated-desc',
    ].join(' ');

    const { data, headers } = await octokit.request('GET /search/issues', {
      q,
      page,
      per_page: perPage,
    });

    const totalCount = Math.min(data.total_count ?? 0, SEARCH_TOTAL_COUNT_LIMIT);

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
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Error fetching GitHub pull requests:', error);

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch pull requests',
    });
  }
});
