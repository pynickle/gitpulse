import { executeGitHubRequest, extractPullRouteParams } from '#server/utils/repo-route-utils';

const VALID_STATES = new Set(['open', 'closed']);

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = await readBody(event).catch(() => null);

  const state = typeof body?.state === 'string' ? body.state : '';
  if (!VALID_STATES.has(state)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid pull request state',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner,
        repo,
        pull_number: pullNumber,
        state: state as 'open' | 'closed',
      });

      return {
        state: data.state,
        closedAt: data.closed_at ?? null,
        merged: Boolean(data.merged),
      };
    },
    'Failed to update pull request state'
  );
});
