export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };

    const body = await readBody(event);
    const labels = Array.isArray(body.labels) ? body.labels : body.labels ? [body.labels] : [];

    const octokit = await getGitHubClient(event);

    const { data: updatedLabels } = await octokit.request(
      'PUT /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: parseInt(issue_number),
        labels,
      }
    );

    return updatedLabels;
  } catch (error: any) {
    console.error('Error updating issue labels:', error);

    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Failed to update issue labels',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update issue labels',
    });
  }
});
