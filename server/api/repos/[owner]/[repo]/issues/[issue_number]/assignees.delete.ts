import { parseIssueAssigneesBody } from '#server/utils/repo-request-validation-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const assignees = parseIssueAssigneesBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: issue } = await octokit.request(
        'DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees',
        {
          owner,
          repo,
          issue_number: issueNumber,
          assignees,
        }
      );
      return issue;
    },
    'Failed to remove issue assignees'
  );
});
