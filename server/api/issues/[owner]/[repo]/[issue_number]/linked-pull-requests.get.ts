import { fetchLinkedPullRequestConnection } from '#server/utils/linked-pull-request-graphql-utils';
import {
  extractIssueRouteParams,
  executeGitHubRequest,
  getStringQueryParam,
} from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const after = getStringQueryParam(getQuery(event).after);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const connection = await fetchLinkedPullRequestConnection(
        octokit,
        owner,
        repo,
        issueNumber,
        after
      );

      return {
        owner,
        repo,
        number: issueNumber,
        totalCount: connection.totalCount ?? 0,
        nodes: connection.nodes,
        pageInfo: connection.pageInfo,
      };
    },
    'Failed to fetch linked pull requests'
  );
});
