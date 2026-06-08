import { fetchDiscussion } from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchDiscussion(octokit, owner, repo, discussionNumber),
    'Failed to fetch discussion'
  );
});
