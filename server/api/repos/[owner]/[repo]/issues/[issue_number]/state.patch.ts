import { executeGitHubRequest, extractIssueRouteParams } from '#server/utils/repo-route-utils';

const VALID_STATES = new Set(['open', 'closed']);
const VALID_CLOSE_REASONS = new Set(['completed', 'not_planned']);

export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const body = await readBody(event).catch(() => null);

  const state = typeof body?.state === 'string' ? body.state : '';
  if (!VALID_STATES.has(state)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid issue state',
    });
  }

  // GitHub sets state_reason itself on reopen; only closing accepts a reason.
  const stateReason =
    state === 'closed' &&
    typeof body?.state_reason === 'string' &&
    VALID_CLOSE_REASONS.has(body.state_reason)
      ? (body.state_reason as 'completed' | 'not_planned')
      : undefined;

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
        state: state as 'open' | 'closed',
        ...(stateReason ? { state_reason: stateReason } : {}),
      });

      return {
        state: data.state,
        stateReason: data.state_reason ?? null,
        closedAt: data.closed_at ?? null,
      };
    },
    'Failed to update issue state'
  );
});
