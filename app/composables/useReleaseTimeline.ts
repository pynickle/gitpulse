import { computed, type Ref } from 'vue';

import {
  createReleaseTimelineSession,
  type ReleaseTimelineSessionEntry,
} from './release-timeline/session';

export function useReleaseTimeline(
  filter?: Readonly<Ref<import('../utils/filterReleaseTimelineGroups').ReleaseTimelineFilterState>>
) {
  const { user } = useUserSession();
  const { loaded, followedRepositories } = useReleaseFollows();
  const lookups = useFollowedRepositoryLookups();
  const cache = useState<ReleaseTimelineSessionEntry | null>(
    'release-timeline-session',
    () => null
  );

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
