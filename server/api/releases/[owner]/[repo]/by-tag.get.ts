export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };
    const query = getQuery(event);
    const tag = typeof query.tag === 'string' ? query.tag.trim() : '';

    if (!owner || !repo || !tag) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);

    const release = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
      owner,
      repo,
      tag,
    });

    return {
      ...release.data,
      repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub release by tag:', error);
    throwGitHubRouteError(error, 'Failed to fetch release');
  }
});
