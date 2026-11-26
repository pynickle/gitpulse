import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  deleteReactionByContent,
  deleteIssueReaction,
  fetchIssueReactionSummary,
  normalizeReactionMutationBody,
  parseReactionTargetId,
  runReactionMutation,
} from '#server/utils/github-reaction-utils';
import { isReactionForbiddenError } from '#shared/utils/reactions';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner?: string;
      repo?: string;
      issue_number?: string;
    };

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const issueNumber = parseReactionTargetId(issue_number, 'Issue number');
    const body = normalizeReactionMutationBody(await readBody(event), 'issue');
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const options = {
      owner,
      repo,
      targetId: issueNumber,
    };
    const fetchSummary = () => fetchIssueReactionSummary(octokit, options, userLogin);

    return await runReactionMutation(octokit, 'issue', options, async () => {
      await deleteReactionByContent(
        fetchSummary,
        (reactionId) => deleteIssueReaction(octokit, options, reactionId),
        body.content
      );
      return await fetchSummary();
    });
  } catch (error: unknown) {
    if (isReactionForbiddenError(error)) {
      throw error;
    }
    console.error('Error deleting GitHub issue reaction:', error);
    throwGitHubRouteError(error, 'Failed to delete issue reaction');
  }
});
