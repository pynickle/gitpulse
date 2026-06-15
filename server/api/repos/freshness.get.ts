import { getLatestUpdatedAt, type FreshnessResponse } from '#server/utils/freshness-response-utils';
import { createCollectionFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);

  try {
    const { data: repos } = await octokit.request('GET /user/repos', {
      type: 'owner',
      sort: 'updated',
      direction: 'desc',
      page: 1,
      per_page: 5,
    });

    return {
      signature: createCollectionFreshnessSignature(repos),
      itemCount: repos.length,
      latestUpdatedAt: getLatestUpdatedAt(repos),
    } satisfies FreshnessResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Error checking GitHub repository freshness:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check repository freshness',
    });
  }
});
