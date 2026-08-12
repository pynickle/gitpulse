import { ref, shallowRef, type Ref, type ShallowRef } from 'vue';

export interface RepoDetailResourceOptions<T> {
  /** Value applied when a request fails (and initial value after `clear`). */
  fallback: () => T;
  /**
   * Negative caching: remember the fallback for failed keys so they are not
   * retried within the session. Leave off when failures should surface an
   * error and stay retryable.
   */
  cacheFallbackOnError?: boolean;
  /** Message assigned to `error` when a request fails. */
  errorMessage?: () => string;
}

export interface RepoDetailResource<T> {
  data: ShallowRef<T>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  /** Load `key`, serving the session cache unless `force` is set. */
  load: (key: string, options?: { force?: boolean }) => Promise<void>;
  /** Drop the session cache and reset state (repository switch). */
  clear: () => void;
}

/**
 * Session-cached, stale-response-guarded fetch state for one repo detail
 * resource (readme, license, latest commit, languages). One instance lives as
 * long as the repo detail session; `clear()` is the repo-switch boundary.
 */
export function createRepoDetailResource<T>(
  fetchValue: (key: string) => Promise<T>,
  options: RepoDetailResourceOptions<T>
): RepoDetailResource<T> {
  const cache = new Map<string, T>();
  const data = shallowRef(options.fallback()) as ShallowRef<T>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  let requestId = 0;

  const applyValue = (value: T) => {
    data.value = value;
    error.value = null;
    loading.value = false;
  };

  const load = async (key: string, loadOptions: { force?: boolean } = {}) => {
    if (loadOptions.force) {
      cache.delete(key);
    } else if (cache.has(key)) {
      // Invalidate any in-flight request so its late response is ignored.
      requestId += 1;
      applyValue(cache.get(key) as T);
      return;
    }

    const currentRequestId = requestId + 1;
    requestId = currentRequestId;
    loading.value = true;
    error.value = null;

    try {
      const value = await fetchValue(key);
      if (currentRequestId !== requestId) return;

      cache.set(key, value);
      applyValue(value);
    } catch {
      if (currentRequestId !== requestId) return;

      const fallback = options.fallback();
      if (options.cacheFallbackOnError) {
        cache.set(key, fallback);
      }
      data.value = fallback;
      error.value = options.errorMessage ? options.errorMessage() : null;
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false;
      }
    }
  };

  const clear = () => {
    requestId += 1;
    cache.clear();
    data.value = options.fallback();
    error.value = null;
    loading.value = false;
  };

  return {
    data,
    loading,
    error,
    load,
    clear,
  };
}
