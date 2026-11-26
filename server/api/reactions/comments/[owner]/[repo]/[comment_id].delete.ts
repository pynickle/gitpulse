import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  deleteReactionByContent,
  deleteIssueCommentReaction,
  fetchIssueCommentReactionSummary,
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
    const body = normalizeReactionMutationBody(await readBody(event), 'issue-comment');
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const options = {
      owner,
      repo,
      targetId: commentId,
    };
    const fetchSummary = () => fetchIssueCommentReactionSummary(octokit, options, userLogin);

    return await runReactionMutation(octokit, 'issue-comment', options, async () => {
      await deleteReactionByContent(
        fetchSummary,
        (reactionId) => deleteIssueCommentReaction(octokit, options, reactionId),
        body.content
      );
      return await fetchSummary();
    });
  } catch (error: unknown) {
    if (isReactionForbiddenError(error)) {
      throw error;
    }
    console.error('Error deleting GitHub issue comment reaction:', error);
    throwGitHubRouteError(error, 'Failed to delete comment reaction');
  }
});
