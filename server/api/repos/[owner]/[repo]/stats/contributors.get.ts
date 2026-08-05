import { normalizeContributorStatsResponse } from '#server/utils/repo-contributors-utils';
import { executeGitHubRequest, extractRepoParams } from '#server/utils/repo-route-utils';
import type { RepoContributorStatsResponse } from '#shared/types/repos';

/**
 * Proxy GitHub's contributor commit-activity stats. The upstream endpoint is
 * computed asynchronously: 202 means "still computing" (mapped to
 * `status: 'computing'`). Clients should poll until `ready` or `empty`.
 *
 * @see https://docs.github.com/en/rest/metrics/statistics#get-all-contributor-commit-activity
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const response = await octokit.request('GET /repos/{owner}/{repo}/stats/contributors', {
        owner,
        repo,
      });

      return normalizeContributorStatsResponse({
        status: response.status,
        data: response.data,
      }) satisfies RepoContributorStatsResponse;
    },
    'Failed to fetch repository contributor stats'
  );
});
