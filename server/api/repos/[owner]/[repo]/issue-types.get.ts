import { executeGitHubRequest, extractRepoParams } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('GET /orgs/{org}/issue-types', {
        org: owner,
      });
      return data;
    },
    'Failed to fetch issue types'
  );
});
