import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';
import { parseOptionalGitHubUsername } from '../utils/github-user-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 20, 100);
  const username = parseOptionalGitHubUsername(query.user);

  try {
    const { data: repos, headers } = username
      ? await octokit.request('GET /users/{username}/starred', {
          username,
          sort: 'created',
          direction: 'desc',
          page,
          per_page: perPage,
        })
      : await octokit.request('GET /user/starred', {
          sort: 'created',
          direction: 'desc',
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
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Error fetching starred repositories:', error);

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch starred repositories',
    });
  }
});
