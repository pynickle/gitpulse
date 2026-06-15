import { parseIssueLabelsBody } from '#server/utils/repo-request-validation-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const labels = parseIssueLabelsBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: updatedLabels } = await octokit.request(
        'PUT /repos/{owner}/{repo}/issues/{issue_number}/labels',
        { owner, repo, issue_number: issueNumber, labels }
      );
      return updatedLabels;
    },
    'Failed to update issue labels'
  );
});
