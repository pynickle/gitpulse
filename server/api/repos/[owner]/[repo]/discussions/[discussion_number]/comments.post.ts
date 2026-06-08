import { addDiscussionComment, fetchDiscussionNodeId } from '#server/utils/github-discussion-utils';
import {
  executeGitHubRequest,
  extractDiscussionRouteParams,
  normalizeRequestBody,
  validateRequiredString,
} from '#server/utils/repo-route-utils';

interface DiscussionCommentRequestBody {
  body?: unknown;
}

function normalizeCommentBody(body: unknown) {
  const requestBody = normalizeRequestBody<DiscussionCommentRequestBody>(body);
  return typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';
}

export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const commentBody = validateRequiredString(
    normalizeCommentBody(await readBody(event)),
    'Comment body'
  );

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
