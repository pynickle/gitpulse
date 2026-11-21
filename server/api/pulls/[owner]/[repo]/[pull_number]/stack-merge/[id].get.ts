import { readPullRequestStackMerge } from '#server/utils/pr-stack-merge-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

const STACK_MERGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const id = event.context.params?.id;
  if (typeof id !== 'string' || !STACK_MERGE_ID.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stack merge request' });
  }

  return executeGitHubRequest(
    event,
    (octokit) => readPullRequestStackMerge(octokit, owner, repo, pullNumber, id),
    'Failed to read stack merge'
  );
});
