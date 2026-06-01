import { throwGitHubRouteError } from '../../../../utils/github-auth-utils';

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
  } catch (error: unknown) {
    console.error('Error fetching repository permissions:', error);

    throwGitHubRouteError(error, 'Failed to fetch repository permissions');
  }
});
