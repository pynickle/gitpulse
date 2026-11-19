import { parseIssueDuplicateTarget } from '#server/utils/repo-request-validation-utils';
import { executeGitHubRequest, extractIssueRouteParams } from '#server/utils/repo-route-utils';

const VALID_STATES = new Set(['open', 'closed']);
const VALID_CLOSE_REASONS = new Set(['completed', 'not_planned', 'duplicate']);

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
      ? (body.state_reason as 'completed' | 'not_planned' | 'duplicate')
      : undefined;

  const duplicateTarget =
    stateReason === 'duplicate' ? parseIssueDuplicateTarget(body?.duplicate_of) : undefined;

  if (
    duplicateTarget &&
    duplicateTarget.owner.toLowerCase() === owner.toLowerCase() &&
    duplicateTarget.repo.toLowerCase() === repo.toLowerCase() &&
    duplicateTarget.number === issueNumber
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'An issue cannot duplicate itself',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      // Resolve the target with the reader's own token, so only an Issue they can
      // read becomes the duplicate relationship GitHub records.
      const target = duplicateTarget
        ? (
            await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
              owner: duplicateTarget.owner,
              repo: duplicateTarget.repo,
              issue_number: duplicateTarget.number,
            })
          ).data
        : undefined;

      if (target?.pull_request) {
        throw createError({
          statusCode: 400,
          statusMessage: 'A pull request cannot be a duplicate target',
        });
      }

      const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
        state: state as 'open' | 'closed',
        ...(stateReason ? { state_reason: stateReason } : {}),
        ...(target ? { duplicate_issue_id: Number(target.id) } : {}),
      });

      return {
        state: data.state,
        stateReason: data.state_reason ?? null,
        closedAt: data.closed_at ?? null,
        duplicateOf:
          target && duplicateTarget
            ? {
                resourceType: 'issue' as const,
                number: target.number,
                title: target.title,
                url: target.html_url,
                state: target.state,
                repository: {
                  name: duplicateTarget.repo,
                  nameWithOwner: `${duplicateTarget.owner}/${duplicateTarget.repo}`,
                  owner: { login: duplicateTarget.owner },
                },
              }
            : null,
      };
    },
    'Failed to update issue state'
  );
});
