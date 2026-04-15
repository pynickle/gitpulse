import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

export default defineEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const page = parsePaginationNumber(getQuery(event).page, 1);
  const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 50);

  try {
    const { data: notifications, headers } = await octokit.request('GET /notifications', {
      all: true,
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
    console.error('Error fetching GitHub notifications:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notifications',
    });
  }
});
