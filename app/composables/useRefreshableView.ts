import {
  computed,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';

export interface RefreshFreshnessSnapshot {
  signature: string;
  pollIntervalMs?: number;
}

interface UseRefreshableViewOptions {
  refresh: () => Promise<unknown>;
  checkFreshness?: () => Promise<RefreshFreshnessSnapshot | string | null | undefined>;
  currentSignature?: MaybeRefOrGetter<string | null | undefined>;
  enabled?: MaybeRefOrGetter<boolean>;
  freshnessKey?: MaybeRefOrGetter<string | number | null | undefined>;
  intervalMs?: MaybeRefOrGetter<number>;
}

const defaultRefreshIntervalMs = 30 * 1000;
const minimumRefreshIntervalMs = 10 * 1000;

const normalizeSnapshot = (
  snapshot: RefreshFreshnessSnapshot | string | null | undefined
): RefreshFreshnessSnapshot | null => {
  if (!snapshot) {
    return null;
  }

  if (typeof snapshot === 'string') {
    return { signature: snapshot };
  }

  return snapshot.signature ? snapshot : null;
};

const resolveIntervalMs = (value: MaybeRefOrGetter<number> | undefined) => {
  const interval = value === undefined ? defaultRefreshIntervalMs : toValue(value);
  return Number.isFinite(interval)
    ? Math.max(interval, minimumRefreshIntervalMs)
    : defaultRefreshIntervalMs;
};

export function useRefreshableView(options: UseRefreshableViewOptions) {
  const refreshing = ref(false);
  const checking = ref(false);
  const hasNewContent = ref(false);
  const error = ref<string | null>(null);
  const lastCheckedAt = ref<Date | null>(null);
  const baselineSignature = ref<string | null>(null);
  const remotePollIntervalMs = ref<number | null>(null);
  const mounted = ref(false);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let activeCheckId = 0;
  const componentInstance = getCurrentInstance();

  const enabled = computed(() => options.enabled === undefined || toValue(options.enabled));
  const canCheckFreshness = computed(() => enabled.value && Boolean(options.checkFreshness));
  const effectiveIntervalMs = computed(
    () => remotePollIntervalMs.value ?? resolveIntervalMs(options.intervalMs)
  );

  const clearTimer = () => {
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    timer = null;
  };

  const syncBaselineFromCurrent = () => {
    if (!options.currentSignature) {
      return false;
    }

    const signature = toValue(options.currentSignature);
    if (!signature) {
      return false;
    }

    baselineSignature.value = signature;
    return true;
  };

  const resetFreshnessState = () => {
    generation += 1;
    activeCheckId += 1;
    checking.value = false;
    hasNewContent.value = false;
    error.value = null;
    remotePollIntervalMs.value = null;
    baselineSignature.value = null;
    syncBaselineFromCurrent();
  };

  const shouldSkipCheck = () => {
    return (
      !canCheckFreshness.value ||
      checking.value ||
      refreshing.value ||
      (import.meta.client && document.visibilityState === 'hidden')
    );
  };

  const scheduleNextCheck = () => {
    clearTimer();
    if (!mounted.value || !canCheckFreshness.value) {
      return;
    }

    timer = setTimeout(() => {
      void checkForFreshness();
    }, effectiveIntervalMs.value);
  };

  const checkForFreshness = async () => {
    if (shouldSkipCheck()) {
      scheduleNextCheck();
      return null;
    }

    const checkGeneration = generation;
    const checkId = ++activeCheckId;
    checking.value = true;
    error.value = null;

    try {
      const snapshot = normalizeSnapshot(await options.checkFreshness?.());
      if (checkGeneration !== generation) {
        return null;
      }

      lastCheckedAt.value = new Date();

      if (!snapshot) {
        return null;
      }

      if (snapshot.pollIntervalMs && Number.isFinite(snapshot.pollIntervalMs)) {
        remotePollIntervalMs.value = Math.max(snapshot.pollIntervalMs, minimumRefreshIntervalMs);
      }

      if (!baselineSignature.value) {
        baselineSignature.value = snapshot.signature;
        return snapshot;
      }

      if (snapshot.signature !== baselineSignature.value) {
        hasNewContent.value = true;
      }

      return snapshot;
    } catch (checkError) {
      if (checkGeneration === generation) {
        error.value = checkError instanceof Error ? checkError.message : 'Unable to check updates';
      }
      return null;
    } finally {
      if (checkId === activeCheckId) {
        checking.value = false;
      }

      if (checkGeneration === generation && checkId === activeCheckId) {
        scheduleNextCheck();
      }
    }
  };

  const refreshNow = async () => {
    if (refreshing.value) {
      return;
    }

    generation += 1;
    activeCheckId += 1;
    checking.value = false;
    refreshing.value = true;
    error.value = null;

    try {
      await options.refresh();
      hasNewContent.value = false;
      baselineSignature.value = null;
      if (!syncBaselineFromCurrent() && options.checkFreshness) {
        const snapshot = normalizeSnapshot(await options.checkFreshness());
        if (snapshot) {
          baselineSignature.value = snapshot.signature;
          if (snapshot.pollIntervalMs && Number.isFinite(snapshot.pollIntervalMs)) {
            remotePollIntervalMs.value = Math.max(
              snapshot.pollIntervalMs,
              minimumRefreshIntervalMs
            );
          }
        }
      }
    } catch (refreshError) {
      error.value = refreshError instanceof Error ? refreshError.message : 'Unable to refresh';
    } finally {
      refreshing.value = false;
      scheduleNextCheck();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void checkForFreshness();
    }
  };

  watch(
    () => [toValue(options.freshnessKey), enabled.value],
    () => {
      resetFreshnessState();
      scheduleNextCheck();
    }
  );

  if (componentInstance) {
    onMounted(() => {
      mounted.value = true;
      resetFreshnessState();
      if (import.meta.client) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
      if (canCheckFreshness.value) {
        scheduleNextCheck();
      }
    });

    onUnmounted(() => {
      mounted.value = false;
      generation += 1;
      clearTimer();
      if (import.meta.client) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    });
  }

  return {
    refreshing,
    checking,
    hasNewContent,
    error,
    lastCheckedAt,
    refreshNow,
    checkForFreshness,
    resetFreshnessState,
  };
}
