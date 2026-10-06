import {
  computed,
  effectScope,
  onScopeDispose,
  readonly,
  shallowRef,
  watch,
  type App,
  type Ref,
} from 'vue';

import type {
  FollowedRepository,
  LookupClassification,
  ReleaseTimeline,
} from '#shared/types/release-follows';

export interface FollowedRepositoryAdapter {
  identities: () => Promise<LookupClassification & { renamed?: boolean }>;
  timeline: () => Promise<ReleaseTimeline>;
}
interface QueryOptions {
  login: Readonly<Ref<string | null>>;
  loaded: Readonly<Ref<boolean>>;
  repositories: Readonly<Ref<FollowedRepository[]>>;
  loadSettings: (options?: { force?: boolean }) => Promise<unknown>;
  adapter: FollowedRepositoryAdapter;
}

// The app owns both the instance and its detached effects, never the first consumer.
const instances = new WeakMap<App, ReturnType<typeof createQueries>>();
export function getFollowedRepositoryQueries(app: App, options: QueryOptions) {
  const existing = instances.get(app);
  if (existing) return existing;
  const scope = effectScope(true);
  const queries = scope.run(() => createQueries(options))!;
  app.onUnmount(() => scope.stop());
  instances.set(app, queries);
  return queries;
}

function createQueries({ login, loaded, repositories, loadSettings, adapter }: QueryOptions) {
  const classification = shallowRef(new Map<string, 'available' | 'unavailable' | 'transient'>());
  const ids = computed(() => [...new Set(repositories.value.map((repo) => repo.id))].sort());
  const collectionKey = computed(() => JSON.stringify(ids.value));
  let accountGeneration = 0;
  let contextGeneration = 0;
  let disposed = false;
  let latest: {
    context: number;
    wake: () => void;
    changed: Promise<void>;
    done: Promise<void>;
  } | null = null;
  const invalidate = () => {
    contextGeneration += 1;
    latest?.wake();
    latest = null;
  };
  watch(
    login,
    () => {
      accountGeneration += 1;
      invalidate();
      classification.value = new Map();
    },
    { flush: 'sync' }
  );
  watch(
    collectionKey,
    () => {
      invalidate();
      const retained = new Set(ids.value);
      classification.value = new Map([...classification.value].filter(([id]) => retained.has(id)));
    },
    { flush: 'sync' }
  );
  onScopeDispose(() => {
    disposed = true;
    invalidate();
  });
  const canQuery = () => !disposed && !!login.value && loaded.value && ids.value.length > 0;
  const ensureSettings = async () => {
    const account = accountGeneration;
    if (disposed || !login.value) return false;
    try {
      await loadSettings();
    } catch {
      return false;
    }
    return account === accountGeneration && canQuery();
  };
  const dispatch = <T extends LookupClassification | ReleaseTimeline>(
    request: () => Promise<T>,
    identity: boolean
  ): Promise<T> => {
    const requestedIds = [...ids.value];
    latest?.wake();
    let wake!: () => void;
    const ticket = {
      context: contextGeneration,
      changed: new Promise<void>((resolve) => {
        wake = resolve;
      }),
      wake: () => wake(),
      done: Promise.resolve(),
    };
    latest = ticket;
    const isCurrent = () => !disposed && latest === ticket && ticket.context === contextGeneration;
    const commit = (data: T | null) => {
      if (!isCurrent()) return;
      const unavailable = new Set(data?.unavailableIds ?? []);
      const transient = new Set(data?.transientIds ?? []);
      const available = new Set(data && 'availableIds' in data ? data.availableIds : []);
      classification.value = new Map(
        requestedIds.map((id) => [
          id,
          !data
            ? 'transient'
            : unavailable.has(id)
              ? 'unavailable'
              : transient.has(id)
                ? 'transient'
                : !identity || available.has(id)
                  ? 'available'
                  : 'transient',
        ])
      );
    };
    const result = (async () => {
      let data: T;
      try {
        data = await request();
      } catch (error) {
        commit(null);
        throw error;
      }
      commit(data);
      if (identity && isCurrent() && 'renamed' in data && data.renamed)
        await loadSettings({ force: true });
      return data;
    })();
    // Observers consume completion without taking away the Timeline caller's original error.
    ticket.done = result.then(
      () => {},
      () => {}
    );
    return result;
  };
  const fetchIdentities = async () => {
    const account = accountGeneration;
    if (!loaded.value && !(await ensureSettings())) return;
    if (account !== accountGeneration || !canQuery()) return;
    try {
      await dispatch(adapter.identities, true);
    } catch {
      /* Explicit retries remain available. */
    }
  };
  const fetchTimeline = async () => {
    const account = accountGeneration;
    if (!loaded.value && !(await ensureSettings())) return null;
    if (account !== accountGeneration || !canQuery()) return null;
    return dispatch(adapter.timeline, false);
  };
  const ensureClassification = async () => {
    const account = accountGeneration;
    if (!loaded.value && !(await ensureSettings())) return;
    if (account !== accountGeneration || !canQuery()) return;
    const context = contextGeneration;
    while (
      !disposed &&
      context === contextGeneration &&
      ids.value.some((id) => !classification.value.has(id))
    ) {
      if (!latest) void fetchIdentities();
      const current = latest;
      if (!current) return;
      await Promise.race([current.done, current.changed]);
    }
  };
  const unavailableIds = computed(() =>
    [...classification.value].filter(([, status]) => status === 'unavailable').map(([id]) => id)
  );
  const transientIds = computed(() =>
    [...classification.value].filter(([, status]) => status === 'transient').map(([id]) => id)
  );
  return {
    unavailableIds: readonly(unavailableIds),
    transientIds: readonly(transientIds),
    unavailableIdSet: computed(() => readonly(new Set(unavailableIds.value))),
    fetchIdentities,
    fetchTimeline,
    ensureClassification,
  };
}
