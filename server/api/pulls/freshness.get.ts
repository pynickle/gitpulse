import { getLatestUpdatedAt, type FreshnessResponse } from '#server/utils/freshness-response-utils';
import {
  buildInvolvesSearchQuery,
  normalizeSearchTotalCount,
} from '#server/utils/github-issue-search-route-utils';
import { translateGitHubSearchError } from '#server/utils/github-search-route-utils';
import { createCollectionFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const q = buildInvolvesSearchQuery('pr', userLogin);

    const { data } = await octokit.request('GET /search/issues', {
      q,
      page: 1,
      per_page: 5,
    });

    const totalCount = normalizeSearchTotalCount(data.total_count);

    return {
      signature: createCollectionFreshnessSignature(data.items, { totalCount, q }),
      itemCount: data.items.length,
      totalCount,
      latestUpdatedAt: getLatestUpdatedAt(data.items),
    } satisfies FreshnessResponse;
  } catch (error) {
    console.error('Error checking GitHub pull request freshness:', error);
    translateGitHubSearchError(error, 'Failed to check pull request freshness');
  }
});
