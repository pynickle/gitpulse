import { normalizeMergePullRequestBody } from '#server/utils/pr-merge-status-utils';
import { requestPullRequestStackMerge } from '#server/utils/pr-stack-merge-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = normalizeMergePullRequestBody(await readBody(event));

  return executeGitHubRequest(
    event,
    (octokit) => requestPullRequestStackMerge(octokit, owner, repo, pullNumber, body),
    'Failed to merge stack'
  );
});
