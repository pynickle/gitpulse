export default defineEventHandler(async (event) => {
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const body = await readBody(event);
  const { subscribed, ignored } = body;

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  const octokit = await getGitHubClient(event);

  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/subscription', {
    owner,
    repo,
    subscribed: subscribed ?? true,
    ignored: ignored ?? false,
  });

  return {
    subscribed: data.subscribed,
    ignored: data.ignored,
  };
});
