import { fetchReviewerCandidates } from '#server/utils/pr-reviewers-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

const getSearchQuery = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue.trim() : '';
};

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const query = getQuery(event);
  const searchQuery = getSearchQuery(query.q);

  return executeGitHubRequest(
    event,
    (octokit) => fetchReviewerCandidates(octokit, owner, repo, pullNumber, searchQuery),
    'Failed to fetch pull request reviewer candidates'
  );
});
