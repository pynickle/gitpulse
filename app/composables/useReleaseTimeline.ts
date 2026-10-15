import { computed, type Ref } from 'vue';

import {
  createReleaseTimelineSession,
  type ReleaseTimelineSessionEntry,
} from './release-timeline/session';

const RELEASE_TIMELINE_SESSION_KEY = 'release-timeline-session';

function useReleaseTimelineSessionCache() {
  return useState<ReleaseTimelineSessionEntry | null>(RELEASE_TIMELINE_SESSION_KEY, () => null);
}

export function useReleaseTimelinePreviousBaseline() {
  const cache = useReleaseTimelineSessionCache();
  return computed(() => cache.value?.cycle?.previousBaseline ?? null);
}

export function useReleaseTimeline(
  filter?: Readonly<Ref<import('../utils/filterReleaseTimelineGroups').ReleaseTimelineFilterState>>
) {
  const { user } = useUserSession();
  const { loaded, followedRepositories } = useReleaseFollows();
  const lookups = useFollowedRepositoryLookups();
  const cache = useReleaseTimelineSessionCache();

  const fetch = useGitPulseApiFetch();
  return createReleaseTimelineSession({
    filter,
    historyCache: useState<import('./release-timeline/history').TimelineHistoryCache | null>(
      'release-timeline-history',
      () => null
    ),
    history: {
      read: () => fetch('/api/release-timeline/history'),
      merge: (records) =>
        fetch('/api/release-timeline/history', {
          method: 'POST',
          body: { action: 'merge', records },
        }),
      clear: () =>
        fetch('/api/release-timeline/history', { method: 'POST', body: { action: 'clear' } }),
    },
    login: computed(() => user.value?.login?.trim().toLowerCase() || null),
    loaded,
    repositories: followedRepositories,
    cache,
    lookups,
    describeError: (error) => getFetchErrorMessage(error, 'An error occurred'),
  });
}
