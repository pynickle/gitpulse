import { deletePullHeadBranch } from '#server/utils/pr-head-branch-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => ({
      head_branch: await deletePullHeadBranch(octokit, owner, repo, pullNumber),
    }),
    'Failed to delete pull request head branch'
  );
});
