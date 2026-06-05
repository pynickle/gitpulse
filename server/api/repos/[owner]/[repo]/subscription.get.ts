import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/subscription', {
          owner,
          repo,
        });
        return { subscribed: data.subscribed, ignored: data.ignored };
      } catch (error: unknown) {
        if (hasGitHubErrorStatus(error, 404)) {
          return { subscribed: false, ignored: false };
        }
        throw error;
      }
    },
    'Failed to get subscription status'
  );
});
