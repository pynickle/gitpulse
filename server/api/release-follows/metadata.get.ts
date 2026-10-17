import { loadFollowedRepositoryMetadata } from '#server/utils/followed-repository-metadata';
import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { readUserSettings, renameFollowedRepositories } from '#server/utils/user-settings-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    return await loadFollowedRepositoryMetadata({
      octokit,
      readSettings: () => readUserSettings(userLogin),
      renameFollows: (lookups) => renameFollowedRepositories(userLogin, lookups),
    });
  } catch (error: unknown) {
    console.error('Error fetching Followed Repository metadata:', error);
    throwGitHubRouteError(error, 'Failed to fetch Followed Repository metadata');
  }
});
