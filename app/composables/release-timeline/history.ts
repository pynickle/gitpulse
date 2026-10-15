import { computed, watch, type Ref } from 'vue';

import type {
  RecoveredRelease,
  TimelineHistoryAdapter,
  TimelineHistorySnapshot,
} from '#shared/types/timeline-history';
import { timelineReleaseKey } from '#shared/utils/release-timeline';

type SaveOperation = 'baseline' | 'read' | 'merge' | 'clear';
export type TimelineHistoryCache = {
  login: string | null;
  context: number;
  snapshot: TimelineHistorySnapshot;
  pending: RecoveredRelease[];
  errors: Partial<Record<SaveOperation, string>>;
  saving: boolean;
  clearing: boolean;
};

// Account-owned state outlives any one Timeline view. A clear or save that finishes
// after navigation still updates the next view, guarded by account and revision.
export function createTimelineHistoryState({
  login,
  cache,
  adapter,
  describeError,
}: {
  login: Readonly<Ref<string | null>>;
  cache: Ref<TimelineHistoryCache | null>;
  adapter?: TimelineHistoryAdapter;
  describeError: (error: unknown) => string;
}) {
  const resetAccount = () => {
    if (cache.value?.login !== login.value)
      cache.value = {
        login: login.value,
        context: (cache.value?.context ?? 0) + 1,
        snapshot: { baseline: null, records: [], revision: -1 },
        pending: [],
        errors: {},
        saving: false,
        clearing: false,
      };
  };
  resetAccount();
  const current = (context: number) =>
    cache.value?.context === context && cache.value.login === login.value;
  const setError = (operation: SaveOperation, message: string | null) => {
    if (!cache.value) return;
    const errors = { ...cache.value.errors };
    if (message) errors[operation] = message;
    else delete errors[operation];
    cache.value = { ...cache.value, errors };
  };
  const accept = (snapshot: TimelineHistorySnapshot) => {
    if (cache.value && snapshot.revision >= cache.value.snapshot.revision)
      cache.value = { ...cache.value, snapshot };
  };
  const load = async () => {
    if (!adapter || !login.value) return;
    const state = cache.value!;
    try {
      const snapshot = await adapter.read();
      if (current(state.context)) {
        accept(snapshot);
        setError('read', null);
      }
    } catch (error) {
      if (current(state.context) && cache.value!.snapshot.revision === state.snapshot.revision)
        setError('read', describeError(error));
    }
  };
  const save = async () => {
    const state = cache.value!;
    if (!adapter || !state.pending.length || state.saving || !login.value) return;
    const records = state.pending.slice(0, 1000);
    cache.value = { ...state, saving: true };
    try {
      const snapshot = await adapter.merge(records);
      if (!current(state.context)) return;
      accept(snapshot);
      const saved = new Set(records.map(timelineReleaseKey));
      cache.value = {
        ...cache.value!,
        pending: cache.value!.pending.filter((record) => !saved.has(timelineReleaseKey(record))),
      };
      setError('merge', null);
    } catch (error) {
      if (current(state.context)) setError('merge', describeError(error));
    } finally {
      if (current(state.context)) {
        cache.value = { ...cache.value!, saving: false };
        if (cache.value.pending.length && !cache.value.errors.merge) void save();
      }
    }
  };
  const clear = async () => {
    const state = cache.value!;
    if (!adapter || state.clearing || !login.value) return;
    cache.value = { ...state, clearing: true };
    try {
      const snapshot = await adapter.clear();
      if (current(state.context)) {
        accept(snapshot);
        setError('clear', null);
      }
    } catch (error) {
      if (current(state.context)) setError('clear', describeError(error));
    } finally {
      if (current(state.context)) cache.value = { ...cache.value!, clearing: false };
    }
  };
  watch(
    login,
    () => {
      resetAccount();
      void load();
    },
    { flush: 'sync' }
  );
  void load();
  return {
    error: computed(() => Object.values(cache.value?.errors ?? {})[0] ?? null),
    records: computed(() => cache.value?.snapshot.records ?? []),
    clearing: computed(() => cache.value?.clearing ?? false),
    saving: computed(() => cache.value?.saving ?? false),
    baselineFailed: computed(() => Boolean(cache.value?.errors.baseline)),
    setBaselineError: (message: string | null) => setError('baseline', message),
    queue(records: RecoveredRelease[]) {
      const pending = new Map(
        cache.value!.pending.map((record) => [timelineReleaseKey(record), record])
      );
      for (const record of records) pending.set(timelineReleaseKey(record), record);
      cache.value = { ...cache.value!, pending: [...pending.values()] };
    },
    save,
    clear,
    async retry() {
      const context = cache.value!.context;
      if (cache.value!.errors.read) await load();
      if (!current(context)) return;
      if (cache.value!.pending.length) await save();
      if (!current(context)) return;
      if (cache.value!.errors.clear) await clear();
    },
  };
}
