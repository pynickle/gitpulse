import { fetchArchivedPullRequestNumbers } from '#server/utils/pr-archive-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchArchivedPullRequestNumbers(octokit, owner, repo),
    'Failed to fetch archived pull requests'
  );
});
