export default defineEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const octokit = await getGitHubClient(event);
    const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });

    const permissions = repository.permissions || {
      admin: false,
      maintain: false,
      push: false,
      triage: false,
      pull: false,
    };

    return {
      admin: Boolean(permissions.admin),
      maintain: Boolean(permissions.maintain),
      push: Boolean(permissions.push),
      triage: Boolean(permissions.triage),
      pull: Boolean(permissions.pull),
      canEditLabels: Boolean(permissions.admin || permissions.maintain || permissions.push),
      canLockIssue: Boolean(permissions.admin || permissions.maintain || permissions.push),
    };
  } catch (error: any) {
    console.error('Error fetching repository permissions:', error);

    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Failed to fetch repository permissions',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch repository permissions',
    });
  }
});
