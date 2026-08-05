import { executeGitHubRequest, extractRepoParams } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      if (repository.owner.type !== 'Organization') return [];

      const { data } = await octokit.request('GET /orgs/{org}/issue-types', {
        org: repository.owner.login,
      });
      return data;
    },
    'Failed to fetch issue types'
  );
});
