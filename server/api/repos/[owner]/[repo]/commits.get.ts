import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import {
  mapGitHubCommitToCommitListItem,
  type GitHubCommitListItem,
} from '#server/utils/repo-latest-commit-utils';
import {
  executeGitHubRequest,
  extractRepoParams,
  getStringQueryParam,
} from '#server/utils/repo-route-utils';
import type { RepoCommitListItemPayload, RepoCommitListResponse } from '#shared/types/repos';

const DEFAULT_COMMITS_PER_PAGE = 20;
const MAX_COMMITS_PER_PAGE = 100;

/** GitHub answers 409 for commit listings on repositories without any commits. */
function isEmptyRepositoryError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 409
  );
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const ref = getStringQueryParam(query.ref);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(
    query.per_page,
    DEFAULT_COMMITS_PER_PAGE,
    MAX_COMMITS_PER_PAGE
  );

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        const { data: commits, headers } = await octokit.request(
          'GET /repos/{owner}/{repo}/commits',
          {
            owner,
            repo,
            ...(ref ? { sha: ref } : {}),
            page,
            per_page: perPage,
          }
        );

        const items = (Array.isArray(commits) ? (commits as GitHubCommitListItem[]) : [])
          .map((commit) => mapGitHubCommitToCommitListItem(commit))
          .filter((item): item is RepoCommitListItemPayload => item !== null);

        return {
          items,
          pagination: buildLinkedPaginationMeta({
            page,
            perPage,
            linkHeader: headers.link,
          }),
        } satisfies RepoCommitListResponse;
      } catch (error) {
        if (isEmptyRepositoryError(error)) {
          return {
            items: [],
            pagination: buildLinkedPaginationMeta({ page: 1, perPage }),
          } satisfies RepoCommitListResponse;
        }

        throw error;
      }
    },
    'Failed to fetch repository commits'
  );
});
