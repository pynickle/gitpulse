import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { parsePaginationNumber } from '#server/utils/github-pagination';
import { createFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, release_id } = event.context.params as {
      owner: string;
      repo: string;
      release_id: string;
    };
    const releaseId = parsePaginationNumber(release_id, 0);

    if (!owner || !repo || releaseId < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);
    const { data: release } = await octokit.request(
      'GET /repos/{owner}/{repo}/releases/{release_id}',
      {
        owner,
        repo,
        release_id: releaseId,
      }
    );

    return {
      signature: createFreshnessSignature({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name,
        draft: release.draft,
        prerelease: release.prerelease,
        target_commitish: release.target_commitish,
        published_at: release.published_at,
        updated_at: release.updated_at,
      }),
      itemCount: 1,
      latestUpdatedAt: release.updated_at ?? release.published_at ?? null,
    } satisfies FreshnessResponse;
  } catch (error: unknown) {
    console.error('Error checking GitHub release freshness:', error);
    throwGitHubRouteError(error, 'Failed to check release freshness');
  }
});
