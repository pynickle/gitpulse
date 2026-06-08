import { fetchDiscussionComments } from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const cursor = getStringQueryParam(getQuery(event).cursor);

  return executeGitHubRequest(
    event,
    (octokit) => fetchDiscussionComments(octokit, owner, repo, discussionNumber, cursor),
    'Failed to fetch discussion comments'
  );
});
