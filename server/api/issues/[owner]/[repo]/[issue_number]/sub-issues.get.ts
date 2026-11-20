import { executeGitHubRequest, extractIssueRouteParams } from '#server/utils/repo-route-utils';
import { fetchSubIssueConnection } from '#server/utils/sub-issue-graphql-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchSubIssueConnection(octokit, owner, repo, issueNumber),
    'Failed to fetch sub-issues'
  );
});
