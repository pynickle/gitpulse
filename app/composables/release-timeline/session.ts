import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue';

import type { FollowedRepository, ReleaseTimeline } from '#shared/types/release-follows';

import type { getFollowedRepositoryQueries } from '../followed-repositories/queries';

export type ReleaseTimelineSessionEntry = {
  login: string;
  followKey: string;
  timeline: ReleaseTimeline;
};

type ReleaseTimelineSessionOptions = {
  login: Readonly<Ref<string | null>>;
  loaded: Readonly<Ref<boolean>>;
  repositories: Readonly<Ref<FollowedRepository[]>>;
  cache: Ref<ReleaseTimelineSessionEntry | null>;
  describeError: (error: unknown) => string;
  lookups: ReturnType<typeof getFollowedRepositoryQueries>;
};

const emptyTimeline = (): ReleaseTimeline => ({
  groups: [],
  unavailableIds: [],
  transientIds: [],
});

export function createReleaseTimelineSession({
  login,
  loaded,
  repositories,
  cache,
  lookups,
  describeError,
}: ReleaseTimelineSessionOptions) {
  const timeline = shallowRef<ReleaseTimeline>(emptyTimeline());
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  let requestId = 0;
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
    requestId += 1;
  });

  const followKey = computed(() =>
    repositories.value
      .map((item) => item.id)
      .sort()
      .join('\0')
  );
  const hasFollows = computed(() => repositories.value.length > 0);
  const groups = computed(() => timeline.value.groups);
  const reposForIds = (ids: readonly string[]) => {
    const byId = new Map(repositories.value.map((item) => [item.id, item]));
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is FollowedRepository => Boolean(item));
  };
  const unavailableRepos = computed(() => reposForIds(lookups.unavailableIds.value));
  const transientRepos = computed(() => reposForIds(lookups.transientIds.value));
  const hasLookupFailures = computed(
    () => unavailableRepos.value.length > 0 || transientRepos.value.length > 0
  );

  const fetchTimeline = async () => {
    if (disposed || !loaded.value || !login.value) return;
    const nextRequestId = ++requestId;
    const requestedLogin = login.value;
    const requestedFollowKey = followKey.value;
    if (!hasFollows.value) {
      timeline.value = emptyTimeline();
      error.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const data = await lookups.fetchTimeline();
      if (nextRequestId !== requestId || !data) return;
      const nextTimeline: ReleaseTimeline = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        unavailableIds: Array.isArray(data.unavailableIds) ? data.unavailableIds : [],
        transientIds: Array.isArray(data.transientIds) ? data.transientIds : [],
      };
      timeline.value = nextTimeline;
      cache.value = {
        login: requestedLogin,
        followKey: requestedFollowKey,
        timeline: nextTimeline,
      };
    } catch (err) {
      if (nextRequestId !== requestId) return;
      error.value = describeError(err);
    } finally {
      if (nextRequestId === requestId) loading.value = false;
    }
  };

  // Invalidate synchronously: a settled response can run before Vue's queued watcher.
  // Keep loading batched so a settings update starts only one request for its final context.
  const contextRevision = shallowRef(0);
  watch(
    [login, loaded, followKey],
    () => {
      requestId += 1;
      contextRevision.value += 1;
    },
    { flush: 'sync' }
  );

  watch(
    contextRevision,
    () => {
      if (cache.value?.login !== login.value) cache.value = null;
      error.value = null;
      loading.value = false;
      if (!login.value || !loaded.value) {
        timeline.value = emptyTimeline();
        return;
      }
      timeline.value = hasFollows.value
        ? (cache.value?.timeline ?? emptyTimeline())
        : emptyTimeline();
      if (hasFollows.value && cache.value?.followKey !== followKey.value) {
        void fetchTimeline();
      } else if (hasFollows.value) {
        void lookups.ensureClassification();
      }
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
