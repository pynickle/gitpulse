export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };
    const issueNumber = parsePaginationNumber(issue_number, 0);

    if (!owner || !repo || issueNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);

    const issue = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner,
      repo,
      issue_number: issueNumber,
    });

    return issue.data;
  } catch (error: unknown) {
    console.error('Error fetching GitHub issue:', error);
    throwGitHubRouteError(error, 'Failed to fetch issue');
  }
});
