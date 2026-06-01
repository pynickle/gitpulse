export default defineEventHandler(async (event) => {
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

  const { data } = await octokit.request(
    'DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock',
    {
      owner,
      repo,
      issue_number: issueNumber,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  return data;
});
