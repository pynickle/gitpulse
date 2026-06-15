import { getLatestUpdatedAt, type FreshnessResponse } from '#server/utils/freshness-response-utils';
import { createCollectionFreshnessSignature } from '#shared/utils/freshness';
import { getOneYearAgoSearchDate } from '#shared/utils/github-search-query';

const SEARCH_TOTAL_COUNT_LIMIT = 1000;

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const createdDate = getOneYearAgoSearchDate();
    const q = [
      'is:pr',
      'is:open',
      'archived:false',
      `created:>=${createdDate}`,
      `involves:${userLogin}`,
      'sort:updated-desc',
    ].join(' ');

    const { data } = await octokit.request('GET /search/issues', {
      q,
      page: 1,
      per_page: 5,
    });

    const totalCount = Math.min(data.total_count ?? 0, SEARCH_TOTAL_COUNT_LIMIT);

    return {
      signature: createCollectionFreshnessSignature(data.items, { totalCount, q }),
      itemCount: data.items.length,
      totalCount,
      latestUpdatedAt: getLatestUpdatedAt(data.items),
    } satisfies FreshnessResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Error checking GitHub pull request freshness:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check pull request freshness',
    });
  }
});
