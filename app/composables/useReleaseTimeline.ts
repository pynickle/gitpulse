import { computed, shallowRef, watch } from 'vue';

import type { ReleaseTimeline } from '#shared/types/release-follows';

export function useReleaseTimeline() {
  const apiFetch = useGitPulseApiFetch();
  const { loaded, followedRepositories } = useReleaseFollows();

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
  const hasTransientFailures = computed(() => timeline.value.transientIds.length > 0);

  const fetchTimeline = async () => {
    if (!loaded.value) {
      return;
    }

    const nextRequestId = requestId.value + 1;
    requestId.value = nextRequestId;

    if (!hasFollows.value) {
      timeline.value = emptyTimeline();
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

      timeline.value = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        unavailableIds: Array.isArray(data.unavailableIds) ? data.unavailableIds : [],
        transientIds: Array.isArray(data.transientIds) ? data.transientIds : [],
      };
    } catch (err) {
      if (nextRequestId !== requestId.value) return;
      error.value = getFetchErrorMessage(err, 'An error occurred');
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
    hasTransientFailures,
    fetchTimeline,
  };
}
