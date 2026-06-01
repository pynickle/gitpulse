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
  } catch (error: unknown) {
    console.error('Error fetching GitHub pull request:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request');
  }
});
