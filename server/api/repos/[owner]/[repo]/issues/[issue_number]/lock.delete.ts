export default defineEventHandler(async (event) => {
  const { owner, repo, issue_number } = event.context.params as {
    owner: string;
    repo: string;
    issue_number: string;
  };

  // Validate required parameters
  if (!owner || !repo || !issue_number) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  // Get GitHub client
  const octokit = await getGitHubClient(event);

  // Unlock the issue
  const { data } = await octokit.request(
    'DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock',
    {
      owner,
      repo,
      issue_number: parseInt(issue_number),
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  return data;
});
