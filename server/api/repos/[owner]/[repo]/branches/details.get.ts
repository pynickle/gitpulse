import { fetchRepoBranchDetails } from '#server/utils/repo-branch-details-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/**
 * Enriched branch list for the dashboard branches page.
 * Uses REST only (list + commit tip + compare + pulls-by-head).
 * The lightweight `/branches` endpoint remains for the file browser selector.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchRepoBranchDetails(octokit, owner, repo),
    'Failed to fetch repository branch details'
  );
});
