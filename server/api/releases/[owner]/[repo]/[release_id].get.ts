import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  fetchNodeViewerCanReact,
  fetchReleaseReactionSummary,
} from '#server/utils/github-reaction-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, release_id } = event.context.params as {
      owner?: string;
      repo?: string;
      release_id?: string;
    };
    const releaseId = parsePaginationNumber(release_id, 0);

    if (!owner || !repo || releaseId < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const { octokit, userLogin } = await getGitHubSessionContext(event);

    const [release, reactionSummary] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/releases/{release_id}', {
        owner,
        repo,
        release_id: releaseId,
      }),
      fetchReleaseReactionSummary(
        octokit,
        {
          owner,
          repo,
          targetId: releaseId,
        },
        userLogin,
        { includeEligibility: false }
      ).catch((error: unknown) => {
        console.warn('Failed to fetch GitHub release reactions:', error);
        return { items: [] };
      }),
    ]);

    const canReact = await fetchNodeViewerCanReact(octokit, release.data.node_id);

    return {
      ...release.data,
      repository_url: `https://api.github.com/repos/${owner}/${repo}`,
      reactions: reactionSummary.items,
      ...(typeof canReact === 'boolean' ? { canReact } : {}),
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub release:', error);
    throwGitHubRouteError(error, 'Failed to fetch release');
  }
});
