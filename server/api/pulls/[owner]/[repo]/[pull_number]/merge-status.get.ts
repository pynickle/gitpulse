import { fetchPRMergeStatus } from '#server/utils/pr-merge-status-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchPRMergeStatus(octokit, owner, repo, pullNumber),
    'Failed to fetch pull request merge status'
  );
});
