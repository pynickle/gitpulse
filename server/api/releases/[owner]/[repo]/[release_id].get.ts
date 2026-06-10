export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, release_id } = event.context.params as {
      owner: string;
      repo: string;
      release_id: string;
    };
    const releaseId = parsePaginationNumber(release_id, 0);

    if (!owner || !repo || releaseId < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);

    const release = await octokit.request('GET /repos/{owner}/{repo}/releases/{release_id}', {
      owner,
      repo,
      release_id: releaseId,
    });

    return {
      ...release.data,
      repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub release:', error);
    throwGitHubRouteError(error, 'Failed to fetch release');
  }
});
