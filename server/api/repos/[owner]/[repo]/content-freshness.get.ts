import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import {
  executeGitHubRequest,
  extractRepoParams,
  getStringQueryParam,
} from '#server/utils/repo-route-utils';
import { createFreshnessSignature } from '#shared/utils/freshness';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const path = getStringQueryParam(query.path);
  const ref = getStringQueryParam(query.ref);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner,
        repo,
        ...(path ? { path } : {}),
        ...(ref ? { sha: ref } : {}),
        page: 1,
        per_page: 1,
      });
      const latestCommit = commits[0] ?? null;
      const latestUpdatedAt = latestCommit?.commit?.committer?.date ?? null;

      return {
        signature: createFreshnessSignature({
          owner,
          repo,
          path,
          ref,
          sha: latestCommit?.sha ?? null,
          updated: latestUpdatedAt,
        }),
        itemCount: latestCommit ? 1 : 0,
        latestUpdatedAt,
      } satisfies FreshnessResponse;
    },
    'Failed to check repository content freshness'
  );
});
