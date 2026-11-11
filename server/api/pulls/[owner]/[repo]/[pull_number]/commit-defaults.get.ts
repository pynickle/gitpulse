import { fetchPRCommitDefaults } from '#server/utils/pr-commit-defaults-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchPRCommitDefaults(octokit, owner, repo, pullNumber),
    'Failed to fetch pull request commit defaults'
  );
});
