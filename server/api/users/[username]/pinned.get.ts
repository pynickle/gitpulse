import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchDefaultPinnedRepositories } from '#server/utils/github-pinned-repo-utils';
import { extractUsername } from '#server/utils/github-user-utils';
import type { UserPinnedReposResponse } from '#shared/types/users';

/**
 * Pinned repositories for the profile "Overview" tab: GitHub's pinned items,
 * falling back to the most-starred public repos. Read-only — GitHub exposes
 * no API to modify profile pins.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);

  try {
    const octokit = await getGitHubClient(event);

    return (await fetchDefaultPinnedRepositories(
      octokit,
      username
    )) satisfies UserPinnedReposResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch pinned repositories');
  }
});
