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

  await octokit.request('DELETE /user/starred/{owner}/{repo}', {
    owner,
    repo,
  });

  return { success: true };
});
