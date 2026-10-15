import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue';

import type {
  FollowedRepository,
  ReleaseTimeline,
  RepositoryReleaseLookup,
} from '#shared/types/release-follows';
import type { TimelineHistoryAdapter } from '#shared/types/timeline-history';
import { assembleReleaseTimeline, timelineReleaseKey } from '#shared/utils/release-timeline';

import type { ReleaseTimelineFilterState } from '../../utils/filterReleaseTimelineGroups';
import type { getFollowedRepositoryQueries } from '../followed-repositories/queries';
import { createTimelineHistoryState, type TimelineHistoryCache } from './history';

type Cycle = {
  pages: Record<string, RepositoryReleaseLookup>;
  failedIds: string[];
  lower: number | null;
  partial: boolean;
  previousBaseline: string | null;
};
export type ReleaseTimelineSessionEntry = {
  login: string;
  followKey: string;
  timeline: ReleaseTimeline;
  cycle?: Cycle;
  refreshFailed?: boolean;
};
type ReleaseTimelineSessionOptions = {
  login: Readonly<Ref<string | null>>;
  loaded: Readonly<Ref<boolean>>;
  repositories: Readonly<Ref<FollowedRepository[]>>;
  cache: Ref<ReleaseTimelineSessionEntry | null>;
  describeError: (error: unknown) => string;
  lookups: ReturnType<typeof getFollowedRepositoryQueries>;
  history?: TimelineHistoryAdapter;
  historyCache?: Ref<TimelineHistoryCache | null>;
  filter?: Readonly<Ref<ReleaseTimelineFilterState>>;
};
const emptyTimeline = (): ReleaseTimeline => ({ groups: [], unavailableIds: [], transientIds: [] });
const emptyCycle = (): Cycle => ({
  pages: {},
  failedIds: [],
  lower: null,
  partial: false,
  previousBaseline: null,
});

export function createReleaseTimelineSession({
  login,
  loaded,
  repositories,
  cache,
  lookups,
  describeError,
  history,
  historyCache = shallowRef<TimelineHistoryCache | null>(null),
  filter,
}: ReleaseTimelineSessionOptions) {
  const timeline = shallowRef<ReleaseTimeline>(emptyTimeline());
  const cycle = shallowRef<Cycle>(emptyCycle());
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const historyState = createTimelineHistoryState({
    login,
    cache: historyCache,
    adapter: history,
    describeError,
  });
  let requestId = 0;
  const refreshFailed = shallowRef(false);
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
  const visibleGroups = computed(() =>
    filter ? filterReleaseTimelineGroups(groups.value, filter.value) : groups.value
  );
  const previousBaseline = computed(() => cycle.value.previousBaseline);
  const loadedNewCount = computed(() =>
    previousBaseline.value
      ? new Set(
          visibleGroups.value
            .flatMap((group) => group.items)
            .filter((item) => Date.parse(item.publishedAt) > Date.parse(previousBaseline.value!))
            .map(timelineReleaseKey)
        ).size
      : 0
  );
  const baselineExposed = computed(
    () =>
      previousBaseline.value !== null &&
      cycle.value.lower !== null &&
      Date.parse(previousBaseline.value) >= cycle.value.lower
  );
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
  const hasMore = computed(() =>
    Object.values(cycle.value.pages).some(
      (page) => page.status === 'available' && page.hasOlderReleases
    )
  );
  const canRetry = computed(() => refreshFailed.value || cycle.value.failedIds.length > 0);
  const partial = computed(() => cycle.value.partial || hasLookupFailures.value);
  const remember = () => {
    cache.value = {
      login: login.value!,
      followKey: followKey.value,
      timeline: timeline.value,
      cycle: cycle.value,
      refreshFailed: refreshFailed.value,
    };
  };
  const mergeRound = (data: ReleaseTimeline, requestedIds: string[], refresh: boolean) => {
    const before = refresh ? emptyCycle() : cycle.value;
    const pages = { ...before.pages };
    const failed = new Set(before.failedIds);
    const known = new Set(
      Object.entries(pages).flatMap(([id, page]) =>
        page.status === 'available' ? page.releases.map((item) => `${id}:${item.id}`) : []
      )
    );
    for (const id of requestedIds) {
      const page = data.pages?.[id];
      if (!page || page.status !== 'available') {
        failed.add(id);
        continue;
      }
      if (page.incomplete) failed.add(id);
      else failed.delete(id);
      const previous = pages[id];
      const records = new Map(
        (previous?.status === 'available' ? previous.releases : []).map((item) => [item.id, item])
      );
      for (const item of page.releases) records.set(item.id, item);
      pages[id] = {
        ...page,
        releases: [...records.values()],
        ...(page.incomplete
          ? {
              endCursor: previous?.status === 'available' ? previous.endCursor : null,
              hasOlderReleases: true,
            }
          : {}),
      };
    }
    if (!refresh && before.lower !== null) {
      const recovered = data.groups
        .flatMap((group) => group.items)
        .filter(
          (item) =>
            !known.has(timelineReleaseKey(item)) && Date.parse(item.publishedAt) >= before.lower!
        );
      historyState.queue(
        recovered.map((item) => ({ ...item, discoveredAt: new Date().toISOString() }))
      );
    }
    const assembled = assembleReleaseTimeline(repositories.value, pages, {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
    const items = assembled.groups.flatMap((group) => group.items);
    const earliest = new Map<string, number>();
    for (const item of items)
      earliest.set(
        item.repository.id,
        Math.min(earliest.get(item.repository.id) ?? Infinity, Date.parse(item.publishedAt))
      );
    const constraints = Object.entries(pages).flatMap(([id, page]) =>
      page.status === 'available' && page.hasOlderReleases && !failed.has(id) && earliest.has(id)
        ? [earliest.get(id)!]
        : []
    );
    const candidate = constraints.length
      ? Math.max(...constraints)
      : items.length
        ? Math.min(...items.map((item) => Date.parse(item.publishedAt)))
        : null;
    const lower =
      before.lower === null
        ? candidate
        : candidate === null
          ? before.lower
          : Math.min(before.lower, candidate);
    const incomplete = repositories.value.some(({ id }) => {
      const page = pages[id];
      return (
        failed.has(id) ||
        !page ||
        (page.status === 'available' &&
          page.hasOlderReleases &&
          (!earliest.has(id) || (lower !== null && earliest.get(id)! > lower)))
      );
    });
    timeline.value = {
      ...assembled,
      groups: assembled.groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => lower === null || Date.parse(item.publishedAt) >= lower
          ),
        }))
        .filter((group) => group.items.length),
    };
    cycle.value = {
      pages,
      failedIds: [...failed],
      lower,
      partial: incomplete,
      previousBaseline: refresh
        ? (data.refresh?.previousBaseline ?? null)
        : before.previousBaseline,
    };
  };
  const run = async (mode: 'refresh' | 'older' | 'retry') => {
    if (disposed || !loaded.value || !login.value || (mode !== 'refresh' && loading.value)) return;
    if (!hasFollows.value) {
      timeline.value = emptyTimeline();
      loading.value = false;
      error.value = null;
      return;
    }
    const refresh =
      mode === 'refresh' || refreshFailed.value || Object.keys(cycle.value.pages).length === 0;
    const requestedIds = refresh
      ? repositories.value.map((repo) => repo.id)
      : mode === 'retry'
        ? cycle.value.failedIds
        : repositories.value
            .filter(({ id }) => {
              const page = cycle.value.pages[id];
              return !page || page.status !== 'available' || page.hasOlderReleases;
            })
            .map((repo) => repo.id);
    if (!requestedIds.length) return;
    const ticket = ++requestId;
    loading.value = true;
    error.value = null;
    try {
      const data = await lookups.fetchTimeline(
        refresh
          ? undefined
          : {
              cursors: Object.fromEntries(
                requestedIds.map((id) => {
                  const page = cycle.value.pages[id];
                  return [id, page?.status === 'available' ? (page.endCursor ?? null) : null];
                })
              ),
            }
      );
      if (ticket !== requestId || !data) return;
      const usable = data.pages
        ? Object.entries(data.pages).some(
            ([id, page]) =>
              page.status === 'available' &&
              (!page.incomplete ||
                data.groups.some((group) => group.items.some((item) => item.repository.id === id)))
          )
        : requestedIds.some(
            (id) => !data.unavailableIds.includes(id) && !data.transientIds.includes(id)
          );
      if (!usable) {
        refreshFailed.value = refresh;
        cycle.value = {
          ...cycle.value,
          failedIds: [...new Set([...cycle.value.failedIds, ...requestedIds])],
          partial: true,
        };
        error.value = 'No repository history could be loaded.';
        if (cache.value?.followKey === followKey.value) remember();
        return;
      }
      refreshFailed.value = false;
      if (data.pages) mergeRound(data, requestedIds, refresh);
      else timeline.value = data;
      if (refresh) historyState.setBaselineError(data.persistenceError ?? null);
      remember();
      await historyState.save();
    } catch (err) {
      if (ticket !== requestId) return;
      refreshFailed.value = refresh;
      cycle.value = {
        ...cycle.value,
        failedIds: [...new Set([...cycle.value.failedIds, ...requestedIds])],
        partial: true,
      };
      error.value = describeError(err);
      if (cache.value?.followKey === followKey.value) remember();
    } finally {
      if (ticket === requestId) loading.value = false;
    }
  };
  const fetchTimeline = () => run('refresh');
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
      refreshFailed.value = cache.value?.refreshFailed ?? false;
      cycle.value =
        cache.value?.followKey === followKey.value
          ? (cache.value.cycle ?? emptyCycle())
          : emptyCycle();
      if (!login.value || !loaded.value) {
        timeline.value = emptyTimeline();
        return;
      }
      timeline.value = hasFollows.value
        ? (cache.value?.timeline ?? emptyTimeline())
        : emptyTimeline();
      if (hasFollows.value && cache.value?.followKey !== followKey.value) void fetchTimeline();
      else if (hasFollows.value) void lookups.ensureClassification();
    },
    { immediate: true }
  );
  const retryPersistence = async () => {
    const requestedLogin = login.value;
    await historyState.retry();
    if (
      !disposed &&
      login.value === requestedLogin &&
      historyState.baselineFailed.value &&
      hasFollows.value
    )
      await fetchTimeline();
  };
  return {
    loaded,
    groups,
    visibleGroups,
    loading,
    error,
    persistenceError: historyState.error,
    hasFollows,
    hasLookupFailures,
    unavailableRepos,
    transientRepos,
    hasMore,
    canRetry,
    partial,
    previousBaseline,
    baselineExposed,
    loadedNewCount,
    recoveredRecords: historyState.records,
    savingHistory: historyState.saving,
    clearingHistory: historyState.clearing,
    fetchTimeline,
    loadOlder: () => run('older'),
    retryFailed: () => run('retry'),
    clearRecovered: historyState.clear,
    retryPersistence,
  };
}
