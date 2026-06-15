import {
  addDiscussionReply,
  fetchDiscussionReplyContext,
  validateDiscussionNodeId,
} from '#server/utils/github-discussion-utils';
import { parseRequiredBodyText } from '#server/utils/repo-request-validation-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const { comment_id } = event.context.params as { comment_id?: string };
  const commentId = validateDiscussionNodeId(comment_id, 'Discussion comment ID');
  const replyBody = parseRequiredBodyText(
    await readBody(event),
    'Invalid discussion reply request body'
  );

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
