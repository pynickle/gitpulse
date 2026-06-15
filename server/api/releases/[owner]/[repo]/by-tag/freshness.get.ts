import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { createFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };
    const query = getQuery(event);
    const tag = typeof query.tag === 'string' ? query.tag.trim() : '';

    if (!owner || !repo || !tag) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);
    const { data: release } = await octokit.request(
      'GET /repos/{owner}/{repo}/releases/tags/{tag}',
      {
        owner,
        repo,
        tag,
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
    console.error('Error checking GitHub release by tag freshness:', error);
    throwGitHubRouteError(error, 'Failed to check release freshness');
  }
});
