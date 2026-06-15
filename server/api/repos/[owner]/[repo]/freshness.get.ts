import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
import { createFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      const latestUpdatedAt = repository.updated_at ?? repository.pushed_at ?? null;

      return {
        signature: createFreshnessSignature({
          id: repository.id,
          full_name: repository.full_name,
          default_branch: repository.default_branch,
          pushed_at: repository.pushed_at,
          updated_at: repository.updated_at,
          stargazers_count: repository.stargazers_count,
          subscribers_count: repository.subscribers_count,
        }),
        itemCount: 1,
        latestUpdatedAt,
      } satisfies FreshnessResponse;
    },
    'Failed to check repository freshness'
  );
});
