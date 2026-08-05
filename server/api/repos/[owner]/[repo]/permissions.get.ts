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
      const canPush = Boolean(permissions.admin || permissions.maintain || permissions.push);

      return {
        admin: Boolean(permissions.admin),
        maintain: Boolean(permissions.maintain),
        push: Boolean(permissions.push),
        triage: Boolean(permissions.triage),
        pull: Boolean(permissions.pull),
        canEditLabels: canPush,
        canEditIssueType: repository.owner.type === 'Organization' && canPush,
        canLockIssue: canPush,
        canEditAssignees: canPush,
        canManageItemState: Boolean(
          permissions.admin || permissions.maintain || permissions.push || permissions.triage
        ),
      };
    },
    'Failed to fetch repository permissions'
  );
});
