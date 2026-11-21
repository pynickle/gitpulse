import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  normalizeUpdatePullRequestBranchBody,
  updatePullRequestBranch,
} from '#server/utils/pr-merge-status-utils';
import { extractPullRouteParams } from '#server/utils/repo-route-utils';

function isHeadOidMismatch(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const data = error.data;
  return Boolean(
    data && typeof data === 'object' && 'code' in data && data.code === 'head_oid_mismatch'
  );
}

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = normalizeUpdatePullRequestBranchBody(await readBody(event));

  try {
    const octokit = await getGitHubClient(event);
    return await updatePullRequestBranch(octokit, owner, repo, pullNumber, body);
  } catch (error: unknown) {
    if (isHeadOidMismatch(error)) throw error;
    console.error('Failed to update pull request branch', error);
    throwGitHubRouteError(error, 'Failed to update pull request branch');
  }
});
