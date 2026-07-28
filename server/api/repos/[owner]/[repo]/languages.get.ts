import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
import type { RepoLanguagesPayload } from '#shared/types/repos';

/**
 * Proxy GitHub's language-bytes map for the repository detail language bar.
 * Response shape matches GitHub: `{ "TypeScript": 12345, "Vue": 678 }`.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/languages', {
        owner,
        repo,
      });

      return data as RepoLanguagesPayload;
    },
    'Failed to fetch repository languages'
  );
});
