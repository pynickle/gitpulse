import { computed, shallowRef, watch } from 'vue';

import type { FollowedRepository, ReleaseTimeline } from '#shared/types/release-follows';
import { classifyLookups } from '#shared/utils/release-timeline';

export function useReleaseTimeline() {
  const apiFetch = useGitPulseApiFetch();
  const { loaded, followedRepositories } = useReleaseFollows();
  const { applyLookupIds, unavailableIds, transientIds } = useFollowedRepositoryLookups();

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

  const fetchTimeline = async () => {
    if (!loaded.value) {
      return;
    }

    const nextRequestId = requestId.value + 1;
    requestId.value = nextRequestId;

    if (!hasFollows.value) {
      timeline.value = emptyTimeline();
      applyLookupIds([], []);
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
      timeline.value = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        unavailableIds: nextUnavailableIds,
        transientIds: nextTransientIds,
      };
      applyLookupIds(nextUnavailableIds, nextTransientIds);
    } catch (err) {
      if (nextRequestId !== requestId.value) return;
      error.value = getFetchErrorMessage(err, 'An error occurred');
      const failed = classifyLookups(followedRepositories.value, null);
      timeline.value = {
        groups: timeline.value.groups,
        unavailableIds: failed.unavailableIds,
        transientIds: failed.transientIds,
      };
      applyLookupIds(failed.unavailableIds, failed.transientIds);
    } finally {
      if (nextRequestId === requestId.value) {
        loading.value = false;
      }
    }
  };

  watch(
    [loaded, followKey],
    () => {
      void fetchTimeline();
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
