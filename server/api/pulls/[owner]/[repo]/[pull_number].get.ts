export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const octokit = await getGitHubClient(event);

    const pullRequest = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: parseInt(pull_number, 10),
    });

    return pullRequest.data;
  } catch (error: any) {
    console.error('Error fetching GitHub pull request:', error);

    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Failed to fetch pull request',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch pull request',
    });
  }
});
