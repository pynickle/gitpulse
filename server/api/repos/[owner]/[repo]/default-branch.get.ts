import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface DefaultBranch {
  default_branch: string;
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit): Promise<DefaultBranch> => {
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });

      return {
        default_branch: repository.default_branch,
      };
    },
    'Failed to fetch repository default branch'
  );
});
