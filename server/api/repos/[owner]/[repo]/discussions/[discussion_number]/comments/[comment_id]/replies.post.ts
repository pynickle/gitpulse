import {
  addDiscussionReply,
  fetchDiscussionReplyContext,
  validateDiscussionNodeId,
} from '#server/utils/github-discussion-utils';
import {
  executeGitHubRequest,
  extractDiscussionRouteParams,
  normalizeRequestBody,
  validateRequiredString,
} from '#server/utils/repo-route-utils';

interface DiscussionReplyRequestBody {
  body?: unknown;
}

function normalizeReplyBody(body: unknown) {
  const requestBody = normalizeRequestBody<DiscussionReplyRequestBody>(body);
  return typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';
}

export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const { comment_id } = event.context.params as { comment_id?: string };
  const commentId = validateDiscussionNodeId(comment_id, 'Discussion comment ID');
  const replyBody = validateRequiredString(normalizeReplyBody(await readBody(event)), 'Reply body');

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const replyContext = await fetchDiscussionReplyContext(
        octokit,
        owner,
        repo,
        discussionNumber,
        commentId
      );
      const reply = await addDiscussionReply(
        octokit,
        replyContext.discussionId,
        replyContext.replyToId,
        replyBody
      );

      return { reply };
    },
    'Failed to create discussion reply'
  );
});
