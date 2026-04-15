export default defineEventHandler(async (event) => {
  const { owner, repo, username } = event.context.params as {
    owner: string;
    repo: string;
    username: string;
  };

  const octokit = await getGitHubClient(event);

  const { data: permission } = await octokit.request(
    'GET /repos/{owner}/{repo}/collaborators/{username}/permission',
    {
      owner,
      repo,
      username,
    }
  );

  return permission;
});
