import {
  enrichCommentModeration,
  restCommentModeration,
} from '#server/utils/comment-moderation-utils';
import { parseRequiredBodyText } from '#server/utils/repo-request-validation-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const commentBody = parseRequiredBodyText(await readBody(event), 'Invalid comment request body');

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: comment } = await octokit.request(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
        { owner, repo, issue_number: issueNumber, body: commentBody }
      );
      const item = { ...comment, moderation: restCommentModeration('IssueComment', comment) };
      await enrichCommentModeration(octokit, [item]);
      return item;
    },
    'Failed to create comment'
  );
});
