import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
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
    },
    'Failed to fetch repository permissions'
  );
});
