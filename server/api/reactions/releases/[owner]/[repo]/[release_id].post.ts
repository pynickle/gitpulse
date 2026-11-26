import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  createReleaseReaction,
  fetchReleaseReactionSummary,
  normalizeReactionMutationBody,
  parseReactionTargetId,
  runReactionMutation,
} from '#server/utils/github-reaction-utils';
import { isReactionForbiddenError } from '#shared/utils/reactions';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, release_id } = event.context.params as {
      owner?: string;
      repo?: string;
      release_id?: string;
    };

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const releaseId = parseReactionTargetId(release_id, 'Release ID');
    const body = normalizeReactionMutationBody(await readBody(event), 'release');
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const options = {
      owner,
      repo,
      targetId: releaseId,
    };

    return await runReactionMutation(octokit, 'release', options, async () => {
      await createReleaseReaction(octokit, options, body.content);
      return await fetchReleaseReactionSummary(octokit, options, userLogin);
    });
  } catch (error: unknown) {
    if (isReactionForbiddenError(error)) {
      throw error;
    }
    console.error('Error creating GitHub release reaction:', error);
    throwGitHubRouteError(error, 'Failed to create release reaction');
  }
});
