import { fetchPRReviewerSummary } from '#server/utils/pr-reviewers-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchPRReviewerSummary(octokit, owner, repo, pullNumber),
    'Failed to fetch pull request reviewers'
  );
});
