export default defineEventHandler(async (event) => {
  const { owner, repo, issue_number } = event.context.params as {
    owner: string;
    repo: string;
    issue_number: string;
  };

  const body = await readBody(event);
  const { lock_reason } = body;

  // Validate required parameters
  if (!owner || !repo || !issue_number) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  // Validate lock reason if provided
  const validLockReasons = ['off-topic', 'too heated', 'resolved', 'spam'];
  if (lock_reason && !validLockReasons.includes(lock_reason)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid lock reason. Must be one of: ${validLockReasons.join(', ')}`,
    });
  }

  // Get GitHub client
  const octokit = await getGitHubClient(event);

  // Lock the issue
  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/lock', {
    owner,
    repo,
    issue_number: parseInt(issue_number),
    lock_reason,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  return data;
});
