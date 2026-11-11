import {
  createEmptyPRReviewerSummary,
  fetchPRReviewerSummary,
  normalizeReviewerRequestBody,
  requestPRReviewers,
} from '#server/utils/pr-reviewers-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

const getReviewerSummaryRefreshMessage = (error: unknown) =>
  (error as { message?: string })?.message || 'Failed to refresh pull request reviewer summary';

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = normalizeReviewerRequestBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const pullRequest = await requestPRReviewers(octokit, owner, repo, pullNumber, body);

      let reviewers: Awaited<ReturnType<typeof fetchPRReviewerSummary>>;
      try {
        reviewers = await fetchPRReviewerSummary(octokit, owner, repo, pullNumber);
      } catch (error: unknown) {
        console.error('Error refreshing pull request reviewer summary after request:', error);
        reviewers = createEmptyPRReviewerSummary([
          {
            source: 'reviewer-summary',
            message: getReviewerSummaryRefreshMessage(error),
          },
        ]);
      }

      return {
        pullRequest,
        reviewers,
      };
    },
    'Failed to request pull request reviewers'
  );
});
