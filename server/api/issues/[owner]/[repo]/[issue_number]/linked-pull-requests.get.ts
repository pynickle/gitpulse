import { fetchLinkedPullRequestPickerConnection } from '#server/utils/linked-pull-request-graphql-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const connection = await fetchLinkedPullRequestPickerConnection(
        octokit,
        owner,
        repo,
        issueNumber
      );

      return {
        owner,
        repo,
        number: issueNumber,
        totalCount: connection.totalCount ?? 0,
        nodes: connection.nodes,
      };
    },
    'Failed to fetch linked pull requests'
  );
});
