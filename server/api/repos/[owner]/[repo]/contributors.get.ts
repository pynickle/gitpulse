import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import {
  emptyContributorListResponse,
  mapGitHubContributorListItem,
  type GitHubContributorListItem,
} from '#server/utils/repo-contributors-utils';
import { executeGitHubRequest, extractRepoParams } from '#server/utils/repo-route-utils';
import type { RepoContributorListResponse, RepoContributorSummary } from '#shared/types/repos';

const DEFAULT_CONTRIBUTORS_PER_PAGE = 30;
const MAX_CONTRIBUTORS_PER_PAGE = 100;

/**
 * Proxy GitHub's list-contributors endpoint for the repo sidebar preview and
 * the full contributors page fallback. Sorted by commit count descending.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(
    query.per_page,
    DEFAULT_CONTRIBUTORS_PER_PAGE,
    MAX_CONTRIBUTORS_PER_PAGE
  );

  return executeGitHubRequest(
    event,
    async (octokit) => {
      // Octokit's typed response only models 200; empty repos can answer 204.
      const response = await octokit.request('GET /repos/{owner}/{repo}/contributors', {
        owner,
        repo,
        page,
        per_page: perPage,
      });

      const status = Number(response.status);
      const data: unknown = response.data;

      // Empty repositories answer 204 with no body.
      if (status === 204 || data == null || data === '') {
        return emptyContributorListResponse(page, perPage) satisfies RepoContributorListResponse;
      }

      const rawItems = Array.isArray(data) ? (data as GitHubContributorListItem[]) : [];

      const items = rawItems
        .map((entry) => mapGitHubContributorListItem(entry))
        .filter((entry): entry is RepoContributorSummary => entry !== null);

      return {
        items,
        pagination: buildLinkedPaginationMeta({
          page,
          perPage,
          linkHeader: typeof response.headers.link === 'string' ? response.headers.link : undefined,
        }),
      } satisfies RepoContributorListResponse;
    },
    'Failed to fetch repository contributors'
  );
});
