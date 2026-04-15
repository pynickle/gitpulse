export default defineEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);

  try {
    const { data: notifications } = await octokit.request('GET /notifications', {
      all: true,
    });
    return notifications;
  } catch (error) {
    console.error('Error fetching GitHub notifications:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notifications',
    });
  }
});
