import {
  fetchDiscussionCommentReplies,
  validateDiscussionNodeId,
} from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);

  const { comment_id } = event.context.params as { comment_id?: string };
  const commentId = validateDiscussionNodeId(comment_id, 'Discussion comment ID');
  const cursor = getStringQueryParam(getQuery(event).cursor);

  return executeGitHubRequest(
    event,
    (octokit) =>
      fetchDiscussionCommentReplies(octokit, owner, repo, discussionNumber, commentId, cursor),
    'Failed to fetch discussion replies'
  );
});
