import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  extractUsername,
  mapGitHubUserToProfile,
  type GitHubUserResponse,
} from '#server/utils/github-user-utils';
import type { UserProfilePayload } from '#shared/types/users';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);

  try {
    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /users/{username}', {
      username,
    });

    return mapGitHubUserToProfile(data as GitHubUserResponse) satisfies UserProfilePayload;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch user profile');
  }
});
