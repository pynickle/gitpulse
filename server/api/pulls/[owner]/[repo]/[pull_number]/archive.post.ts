import { setPullRequestArchived } from '#server/utils/pr-archive-utils';
import { executeGitHubRequest, extractPullRouteParams } from '#server/utils/repo-route-utils';
import type { PullRequestArchiveAction } from '#shared/types/pulls';

const ARCHIVE_ACTIONS = new Set<PullRequestArchiveAction>(['archive', 'unarchive']);

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = await readBody(event).catch(() => null);

  const action = typeof body?.action === 'string' ? body.action : '';
  if (!ARCHIVE_ACTIONS.has(action as PullRequestArchiveAction)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid pull request archive action',
    });
  }

  return executeGitHubRequest(
    event,
    (octokit) =>
      setPullRequestArchived(octokit, owner, repo, pullNumber, action as PullRequestArchiveAction),
    'Failed to archive pull request'
  );
});
