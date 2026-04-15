export default defineEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const thread_id = Number(getRouterParam(event, 'thread_id'));

  try {
    const { data } = await octokit.request('PATCH /notifications/threads/{thread_id}', {
      thread_id,
    });
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark notification as read',
    });
  }
});
