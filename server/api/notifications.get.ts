import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 20, 50);
  const all = query.all === 'true' || query.all === true;
  const participating = query.participating === 'true' || query.participating === true;
  const since =
    typeof query.since === 'string' && query.since.trim() ? query.since.trim() : undefined;
  const before =
    typeof query.before === 'string' && query.before.trim() ? query.before.trim() : undefined;

  try {
    const { data: notifications, headers } = await octokit.request('GET /notifications', {
      all,
      participating,
      since,
      before,
      page,
      per_page: perPage,
    });

    return {
      items: notifications,
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

    console.error('Error fetching GitHub notifications:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notifications',
    });
  }
});
