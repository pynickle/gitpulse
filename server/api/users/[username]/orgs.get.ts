import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  extractUsername,
  mapGitHubOrganizationToSummary,
  type GitHubOrganizationResponse,
} from '#server/utils/github-user-utils';
import type { UserOrganizationsResponse, UserOrganizationSummary } from '#shared/types/users';

/** GitHub caps this endpoint at 100 per page; one page covers the profile sidebar. */
const ORGANIZATIONS_PER_PAGE = 100;

/**
 * Public organization memberships, mirroring the "Organizations" section on
 * GitHub's own profile page (private memberships are never included).
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);

  try {
    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /users/{username}/orgs', {
      username,
      per_page: ORGANIZATIONS_PER_PAGE,
    });

    const items = (Array.isArray(data) ? (data as GitHubOrganizationResponse[]) : [])
      .map((org) => mapGitHubOrganizationToSummary(org))
      .filter((org): org is UserOrganizationSummary => org !== null);

    return { items } satisfies UserOrganizationsResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch user organizations');
  }
});
