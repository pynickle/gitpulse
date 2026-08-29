import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchFollowedRepositoryReleaseLookups } from '#server/utils/release-timeline-graphql-utils';
import { patchUserSettings, readUserSettings } from '#server/utils/user-settings-utils';
import type { FollowedRepository, RepositoryReleaseLookup } from '#shared/types/release-follows';
import { assembleReleaseTimeline } from '#shared/utils/release-timeline';

const parseTimeZone = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'UTC';
  }

  const timeZone = raw.trim();
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
};

const withFetchedRepositoryNames = (
  follows: FollowedRepository[],
  lookups: Record<string, RepositoryReleaseLookup>
): FollowedRepository[] | null => {
  let changed = false;
  const next = follows.map((follow) => {
    const lookup = lookups[follow.id];
    if (!lookup || lookup.status !== 'available') {
      return follow;
    }

    const owner = lookup.owner.trim();
    const name = lookup.name.trim();
    if (!owner || !name || (owner === follow.owner && name === follow.name)) {
      return follow;
    }

    changed = true;
    return { ...follow, owner, name };
  });

  return changed ? next : null;
};

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const settings = await readUserSettings(userLogin);
    const follows = settings.followedRepositories ?? [];
    const timeZone = parseTimeZone(getQuery(event).timeZone);

    if (follows.length === 0) {
      return assembleReleaseTimeline([], {}, { timeZone });
    }

    const lookups = await fetchFollowedRepositoryReleaseLookups(octokit, follows);
    const renamed = withFetchedRepositoryNames(follows, lookups);
    if (renamed) {
      try {
        await patchUserSettings(userLogin, { followedRepositories: renamed });
      } catch (error: unknown) {
        console.warn('Failed to write back renamed Followed Repositories:', error);
      }
    }

    return assembleReleaseTimeline(follows, lookups, { timeZone });
  } catch (error: unknown) {
    console.error('Error fetching release timeline:', error);
    throwGitHubRouteError(error, 'Failed to fetch release timeline');
  }
});
