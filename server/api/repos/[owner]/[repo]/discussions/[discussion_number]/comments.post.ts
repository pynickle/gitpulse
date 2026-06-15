import { addDiscussionComment, fetchDiscussionNodeId } from '#server/utils/github-discussion-utils';
import { parseRequiredBodyText } from '#server/utils/repo-request-validation-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const commentBody = parseRequiredBodyText(await readBody(event), 'Invalid comment request body');

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const discussionId = await fetchDiscussionNodeId(octokit, owner, repo, discussionNumber);
      const comment = await addDiscussionComment(octokit, discussionId, commentBody);

      return { comment };
    },
    'Failed to create discussion comment'
  );
});
