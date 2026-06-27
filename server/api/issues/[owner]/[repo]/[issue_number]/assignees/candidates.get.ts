import { fetchIssueAssigneeCandidates } from '#server/utils/issue-assignees-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

const getSearchQuery = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue.trim() : '';
};

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const query = getQuery(event);
  const searchQuery = getSearchQuery(query.q);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: issue } = await octokit.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}',
        {
          owner,
          repo,
          issue_number: issueNumber,
        }
      );

      const assignees = Array.isArray(issue.assignees) ? issue.assignees : [];
      const candidates = await fetchIssueAssigneeCandidates(
        octokit,
        owner,
        repo,
        assignees,
        searchQuery
      );

      return {
        ...candidates,
        assignees,
      };
    },
    'Failed to fetch issue assignee candidates'
  );
});
