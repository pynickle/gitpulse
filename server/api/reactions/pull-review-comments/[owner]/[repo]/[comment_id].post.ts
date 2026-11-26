import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  createPullReviewCommentReaction,
  fetchPullReviewCommentReactionSummary,
  normalizeReactionMutationBody,
  parseReactionTargetId,
  runReactionMutation,
} from '#server/utils/github-reaction-utils';
import { isReactionForbiddenError } from '#shared/utils/reactions';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, comment_id } = event.context.params as {
      owner?: string;
      repo?: string;
      comment_id?: string;
    };

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const commentId = parseReactionTargetId(comment_id, 'Comment ID');
    const body = normalizeReactionMutationBody(await readBody(event), 'pull-review-comment');
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const options = {
      owner,
      repo,
      targetId: commentId,
    };

    return await runReactionMutation(octokit, 'pull-review-comment', options, async () => {
      await createPullReviewCommentReaction(octokit, options, body.content);
      return await fetchPullReviewCommentReactionSummary(octokit, options, userLogin);
    });
  } catch (error: unknown) {
    if (isReactionForbiddenError(error)) {
      throw error;
    }
    console.error('Error creating GitHub pull request review comment reaction:', error);
    throwGitHubRouteError(error, 'Failed to create review comment reaction');
  }
});
