import { normalizeMergePullRequestBody } from '#server/utils/pr-merge-status-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = normalizeMergePullRequestBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request(
        'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
        {
          owner,
          repo,
          pull_number: pullNumber,
          merge_method: body.method,
          commit_title: body.commitTitle,
          commit_message: body.commitMessage,
        }
      );

      return {
        merged: Boolean(data.merged),
        sha: data.sha ?? null,
        message: data.message,
      };
    },
    'Failed to merge pull request'
  );
});
