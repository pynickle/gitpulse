import { throwGitHubRouteError } from '#server/utils/github-auth-utils';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';
import { parseOptionalGitHubUsername } from '../utils/github-user-utils';
import {
  parseStarredDirection,
  parseStarredSort,
  STARRED_DEFAULT_PER_PAGE,
  STARRED_MAX_PER_PAGE,
} from '../utils/starred-query-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(
    query.per_page,
    STARRED_DEFAULT_PER_PAGE,
    STARRED_MAX_PER_PAGE
  );
  const sort = parseStarredSort(query.sort);
  const direction = parseStarredDirection(query.direction);
  const username = parseOptionalGitHubUsername(query.user);

  try {
    const { data: repos, headers } = username
      ? await octokit.request('GET /users/{username}/starred', {
          username,
          sort,
          direction,
          page,
          per_page: perPage,
        })
      : await octokit.request('GET /user/starred', {
          sort,
          direction,
          page,
          per_page: perPage,
        });

    return {
      items: repos,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
      }),
      sort,
      direction,
    };
  } catch (error) {
    console.error('Error fetching starred repositories:', error);
    throwGitHubRouteError(error, 'Failed to fetch starred repositories');
  }
});
