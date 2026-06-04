import {
  createEmptyPRReviewerSummary,
  fetchPRReviewerSummary,
  normalizeReviewerRequestBody,
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
      const { data: pullRequest } = await octokit.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
        {
          owner,
          repo,
          pull_number: pullNumber,
          reviewers: body.reviewers,
          team_reviewers: body.teamReviewers,
        }
      );

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
