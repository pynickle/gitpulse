import { throwGitHubRouteError } from '#server/utils/github-auth-utils';

export default defineEventHandler(async (event) => {
  const threadIdParam = getRouterParam(event, 'thread_id') ?? '';
  const threadId = parsePaginationNumber(threadIdParam, 0);

  if (threadId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification thread id',
    });
  }

  const octokit = await getGitHubClient(event);

  try {
    const { data } = await octokit.request('PATCH /notifications/threads/{thread_id}', {
      thread_id: threadId,
    });
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throwGitHubRouteError(error, 'Failed to mark notification as read');
  }
});
