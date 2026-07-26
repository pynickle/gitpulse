import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import {
  extractUsername,
  mapGitHubRepositoryToSummary,
  type GitHubRepositoryResponse,
} from '#server/utils/github-user-utils';
import type { UserRepositoryListResponse, UserRepositorySummary } from '#shared/types/users';

/**
 * Public repositories for the profile "Repositories" tab. Works for both
 * users and organizations, most recently updated first.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 30, 100);

  try {
    const octokit = await getGitHubClient(event);
    const { data, headers } = await octokit.request('GET /users/{username}/repos', {
      username,
      sort: 'updated',
      direction: 'desc',
      page,
      per_page: perPage,
    });

    const items = (Array.isArray(data) ? (data as GitHubRepositoryResponse[]) : [])
      .map((repo) => mapGitHubRepositoryToSummary(repo))
      .filter((repo): repo is UserRepositorySummary => repo !== null);

    return {
      items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
      }),
    } satisfies UserRepositoryListResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch user repositories');
  }
});
