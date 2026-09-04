import { computed, shallowRef, watch } from 'vue';

import type { FollowedRepository, ReleaseTimeline } from '#shared/types/release-follows';
import { classifyLookups } from '#shared/utils/release-timeline';

type ReleaseTimelineSessionEntry = {
  followKey: string;
  timeline: ReleaseTimeline;
};

export function useReleaseTimeline() {
  const apiFetch = useGitPulseApiFetch();
  const { loaded, followedRepositories } = useReleaseFollows();
  const { applyLookupIds, unavailableIds, transientIds } = useFollowedRepositoryLookups();
  const sessionCache = useState<ReleaseTimelineSessionEntry | null>(
    'release-timeline-session',
    () => null
  );

  const emptyTimeline = (): ReleaseTimeline => ({
    groups: [],
    unavailableIds: [],
    transientIds: [],
  });

  const timeline = shallowRef<ReleaseTimeline>(emptyTimeline());
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const requestId = shallowRef(0);

  const followKey = computed(() => followedRepositories.value.map((item) => item.id).join('\0'));
  const hasFollows = computed(() => followedRepositories.value.length > 0);
  const groups = computed(() => timeline.value.groups);
  const reposForIds = (ids: readonly string[]) => {
    const byId = new Map(followedRepositories.value.map((item) => [item.id, item]));
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is FollowedRepository => Boolean(item));
  };
  const unavailableRepos = computed(() => reposForIds(unavailableIds.value));
  const transientRepos = computed(() => reposForIds(transientIds.value));
  const hasLookupFailures = computed(
    () => unavailableRepos.value.length > 0 || transientRepos.value.length > 0
  );

  const applyTimeline = (next: ReleaseTimeline) => {
    timeline.value = next;
    applyLookupIds(next.unavailableIds, next.transientIds);
  };

  const fetchTimeline = async () => {
    if (!loaded.value) {
      return;
    }

    const nextRequestId = requestId.value + 1;
    requestId.value = nextRequestId;
    const requestedFollowKey = followKey.value;

    if (!hasFollows.value) {
      applyTimeline(emptyTimeline());
      error.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const params = new URLSearchParams({ timeZone });
      const data = await apiFetch<ReleaseTimeline>(`/api/release-timeline?${params.toString()}`);
      if (nextRequestId !== requestId.value) return;

      const nextUnavailableIds = Array.isArray(data.unavailableIds) ? data.unavailableIds : [];
      const nextTransientIds = Array.isArray(data.transientIds) ? data.transientIds : [];
      const nextTimeline: ReleaseTimeline = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        unavailableIds: nextUnavailableIds,
        transientIds: nextTransientIds,
      };
      applyTimeline(nextTimeline);
      sessionCache.value = {
        followKey: requestedFollowKey,
        timeline: nextTimeline,
      };
    } catch (err) {
      if (nextRequestId !== requestId.value) return;
      error.value = getFetchErrorMessage(err, 'An error occurred');
      const failed = classifyLookups(followedRepositories.value, null);
      applyTimeline({
        groups: timeline.value.groups,
        unavailableIds: failed.unavailableIds,
        transientIds: failed.transientIds,
      });
    } finally {
      if (nextRequestId === requestId.value) {
        loading.value = false;
      }
    }
  };

  watch(
    [loaded, followKey],
    () => {
      if (!loaded.value) {
        return;
      }

      const decision = resolveReleaseTimelineSessionLoad({
        hasFollows: hasFollows.value,
        followKey: followKey.value,
        cache: sessionCache.value,
      });
      applyTimeline(decision.timeline);
      error.value = null;

      if (decision.shouldFetch) {
        void fetchTimeline();
        return;
      }

      loading.value = false;
    },
    { immediate: true }
  );

  return {
    loaded,
    groups,
    loading,
    error,
    hasFollows,
    hasLookupFailures,
    unavailableRepos,
    transientRepos,
    fetchTimeline,
  };
}
