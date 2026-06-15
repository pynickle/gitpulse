import { parseRepoSubscriptionBody } from '#server/utils/repo-request-validation-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const body = parseRepoSubscriptionBody(await readBody(event));

  const { subscribed, ignored } = body;

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('PUT /repos/{owner}/{repo}/subscription', {
        owner,
        repo,
        subscribed,
        ignored,
      });
      return { subscribed: data.subscribed, ignored: data.ignored };
    },
    'Failed to update subscription'
  );
});
