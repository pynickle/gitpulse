import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { normalizeSearchTotalCount } from '#server/utils/github-issue-search-route-utils';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 20, 100);
  const accessible = query.scope === 'accessible';
  const search = accessible && typeof query.q === 'string' ? query.q.trim() : '';

  try {
    if (search) {
      // GitHub search has no "accessible to me" qualifier; the reader's own account
      // and organizations are the closest scope it can express.
      const { octokit, userLogin } = await getGitHubSessionContext(event);
      const { data: orgs } = await octokit.request('GET /user/orgs', { per_page: 100 });
      const { data, headers } = await octokit.request('GET /search/repositories', {
        q: [
          search,
          'fork:true',
          `user:${userLogin}`,
          ...orgs.map((org) => `org:${org.login}`),
        ].join(' '),
        page,
        per_page: perPage,
      });

      return {
        items: data.items,
        pagination: buildLinkedPaginationMeta({
          page,
          perPage,
          linkHeader: headers.link,
          totalCount: normalizeSearchTotalCount(data.total_count),
        }),
      };
    }

    const octokit = await getGitHubClient(event);
    const { data: repos, headers } = await octokit.request('GET /user/repos', {
      ...(accessible
        ? { affiliation: 'owner,collaborator,organization_member' }
        : { type: 'owner' }),
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
