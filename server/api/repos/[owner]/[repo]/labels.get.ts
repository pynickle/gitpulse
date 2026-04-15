export default defineEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const octokit = await getGitHubClient(event);

    const { data: labels } = await octokit.request('GET /repos/{owner}/{repo}/labels', {
      owner,
      repo,
    });

    return labels;
  } catch (error: any) {
    console.error('Error fetching repository labels:', error);

    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Failed to fetch repository labels',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch repository labels',
    });
  }
});
