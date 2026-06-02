import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        await octokit.request('GET /user/starred/{owner}/{repo}', { owner, repo });
        return { starred: true };
      } catch (error: unknown) {
        if (hasGitHubErrorStatus(error, 404)) {
          return { starred: false };
        }
        throw error;
      }
    },
    'Failed to check star status'
  );
});
