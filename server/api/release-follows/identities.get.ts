import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchFollowedRepositoryIdentityLookups } from '#server/utils/release-timeline-graphql-utils';
import { patchUserSettings, readUserSettings } from '#server/utils/user-settings-utils';
import { applyFollowRenames } from '#shared/utils/release-follows';
import { classifyLookups } from '#shared/utils/release-timeline';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const settings = await readUserSettings(userLogin);
    const follows = settings.followedRepositories ?? [];

    if (follows.length === 0) {
      return { ...classifyLookups([], {}), renamed: false };
    }

    const lookups = await fetchFollowedRepositoryIdentityLookups(octokit, follows);
    const renamed = applyFollowRenames(follows, lookups);
    if (renamed) {
      try {
        await patchUserSettings(userLogin, { followedRepositories: renamed });
      } catch (error: unknown) {
        console.warn('Failed to write back renamed Followed Repositories:', error);
      }
    }

    return {
      ...classifyLookups(follows, lookups),
      renamed: Boolean(renamed),
    };
  } catch (error: unknown) {
    console.error('Error fetching Followed Repository identities:', error);
    throwGitHubRouteError(error, 'Failed to fetch Followed Repository identities');
  }
});
