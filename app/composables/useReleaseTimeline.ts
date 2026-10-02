import { computed } from 'vue';

import type { ReleaseTimeline } from '#shared/types/release-follows';

import {
  createReleaseTimelineSession,
  type ReleaseTimelineSessionEntry,
} from './release-timeline/session';

export function useReleaseTimeline() {
  const apiFetch = useGitPulseApiFetch();
  const { user } = useUserSession();
  const { loaded, followedRepositories } = useReleaseFollows();
  const lookups = useFollowedRepositoryLookups();
  const cache = useState<ReleaseTimelineSessionEntry | null>(
    'release-timeline-session',
    () => null
  );

  return createReleaseTimelineSession({
    login: computed(() => user.value?.login?.trim().toLowerCase() || null),
    loaded,
    repositories: followedRepositories,
    cache,
    lookups,
    describeError: (error) => getFetchErrorMessage(error, 'An error occurred'),
    load: () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const params = new URLSearchParams({ timeZone });
      return apiFetch<ReleaseTimeline>(`/api/release-timeline?${params.toString()}`);
    },
  });
}
