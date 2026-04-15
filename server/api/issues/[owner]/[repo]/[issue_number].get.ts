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
  } catch (error: any) {
    console.error('Error fetching GitHub issue:', error);

    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Failed to fetch issue',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch issue',
    });
  }
});
