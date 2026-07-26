import { throwGitHubRouteError } from '#server/utils/github-auth-utils';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const page = parsePaginationNumber(getQuery(event).page, 1);
  const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 100);

  try {
    const { data: repos, headers } = await octokit.request('GET /user/repos', {
      type: 'owner',
      sort: 'updated',
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
    console.error('Error fetching GitHub repositories:', error);
    throwGitHubRouteError(error, 'Failed to fetch repositories');
  }
});
