import {
  setPullRequestReviewThreadResolved,
  validateReviewThreadId,
} from '#server/utils/github-timeline-utils';
import { parseReviewThreadResolveBody } from '#server/utils/repo-request-validation-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  extractPullRouteParams(event);

  const { thread_id } = event.context.params as { thread_id?: string };
  const threadId = validateReviewThreadId(thread_id);
  const resolved = parseReviewThreadResolveBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const thread = await setPullRequestReviewThreadResolved(octokit, threadId, resolved);

      return { thread };
    },
    resolved ? 'Failed to resolve review thread' : 'Failed to unresolve review thread'
  );
});
