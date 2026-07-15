import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { parsePaginationNumber } from '#server/utils/github-pagination';
import { extractUsername, fetchUserConnectionPage } from '#server/utils/github-user-utils';
import type { UserConnectionListResponse } from '#shared/types/users';

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, DEFAULT_PER_PAGE, MAX_PER_PAGE);

  try {
    return (await fetchUserConnectionPage(event, {
      username,
      relation: 'following',
      page,
      perPage,
    })) satisfies UserConnectionListResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch following');
  }
});
