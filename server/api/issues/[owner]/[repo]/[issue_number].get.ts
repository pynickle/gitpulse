export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };

    const octokit = await getGitHubClient(event);

    const issue = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner,
      repo,
      issue_number: parseInt(issue_number, 10),
    });

    return issue.data;
  } catch (error: unknown) {
    console.error('Error fetching GitHub issue:', error);
    throwGitHubRouteError(error, 'Failed to fetch issue');
  }
});
