import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface RepoBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const branches: RepoBranch[] = [];
      const perPage = 100;
      let page = 1;

      while (true) {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
          owner,
          repo,
          page,
          per_page: perPage,
        });

        branches.push(
          ...data.map(
            (branch): RepoBranch => ({
              name: branch.name,
              sha: branch.commit.sha,
              protected: branch.protected,
            })
          )
        );

        if (data.length < perPage) {
          return branches;
        }

        page += 1;
      }
    },
    'Failed to fetch repository branches'
  );
});
