export default defineEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);

  try {
    const { data: repos } = await octokit.request('GET /user/repos', {
      type: 'owner',
      sort: 'updated',
      direction: 'desc',
    });
    return repos;
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch repositories',
    });
  }
});
