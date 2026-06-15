import { parseIssueLockBody } from '#server/utils/repo-request-validation-utils';
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const lockReason = parseIssueLockBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request(
        'PUT /repos/{owner}/{repo}/issues/{issue_number}/lock',
        {
          owner,
          repo,
          issue_number: issueNumber,
          lock_reason: lockReason,
        }
      );
      return data;
    },
    'Failed to lock issue'
  );
});
