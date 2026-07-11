import {
  mapGitHubCommitToLatestCommit,
  type GitHubCommitListItem,
} from '#server/utils/repo-latest-commit-utils';
import {
  executeGitHubRequest,
  extractRepoParams,
  getStringQueryParam,
} from '#server/utils/repo-route-utils';
import type { RepoLatestCommitResponse } from '#shared/types/repos';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const ref = getStringQueryParam(query.ref);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner,
        repo,
        ...(ref ? { sha: ref } : {}),
        page: 1,
        per_page: 1,
      });

      const latest = (Array.isArray(commits) ? commits[0] : null) as GitHubCommitListItem | null;

      return mapGitHubCommitToLatestCommit(latest, {
        owner,
        repo,
        ref,
      }) satisfies RepoLatestCommitResponse;
    },
    'Failed to fetch repository latest commit'
  );
});
