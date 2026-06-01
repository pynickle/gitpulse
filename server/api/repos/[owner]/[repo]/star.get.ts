export default defineEventHandler(async (event) => {
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  const octokit = await getGitHubClient(event);

  try {
    await octokit.request('GET /user/starred/{owner}/{repo}', {
      owner,
      repo,
    });
    return { starred: true };
  } catch (error: any) {
    if (error.status === 404) {
      return { starred: false };
    }
    throwGitHubRouteError(error, 'Failed to check star status');
  }
});
