import { parseIssueTypeBody } from '#server/utils/repo-request-validation-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const type = parseIssueTypeBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
        type,
      });
      return data.type ?? null;
    },
    'Failed to update issue type'
  );
});
