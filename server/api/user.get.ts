export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);

  try {
    const { data: user } = await octokit.request('GET /user');
    return user;
  } catch (error) {
    console.error('Error fetching GitHub user:', error);

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user information',
    });
  }
});
