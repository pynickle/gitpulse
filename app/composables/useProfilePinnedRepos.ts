import { ref, shallowRef, watch, type Ref } from 'vue';

import type {
  PinnedRepoSource,
  UserPinnedReposResponse,
  UserRepositorySummary,
} from '#shared/types/users';

interface UseProfilePinnedReposState {
  items: Ref<UserRepositorySummary[]>;
  source: Ref<PinnedRepoSource>;
  loading: Ref<boolean>;
  error: Ref<string>;
  refresh: () => Promise<void>;
}

/**
 * Pinned repositories for the profile overview section: GitHub's pinned items,
 * or the most-starred fallback when nothing is pinned. Read-only — GitHub
 * exposes no API to modify profile pins. Stale responses are dropped via a
 * request id when the username changes mid-flight.
 *
 * @param username reactive login; empty string means "no user selected" (no traffic).
 */
export function useProfilePinnedRepos(
  username: Ref<string> | (() => string)
): UseProfilePinnedReposState {
  const apiFetch = useGitPulseApiFetch();

  const resolveUsername = () => (typeof username === 'function' ? username() : username.value);

  const items = shallowRef<UserRepositorySummary[]>([]);
  const source = shallowRef<PinnedRepoSource>('pinned');
  const loading = ref(false);
  const error = ref('');
  let requestId = 0;

  const load = async () => {
    const login = resolveUsername().trim();

    if (!login) {
      requestId += 1;
      items.value = [];
      source.value = 'pinned';
      error.value = '';
      loading.value = false;
      return;
    }

    const nextRequestId = requestId + 1;
    requestId = nextRequestId;
    loading.value = true;
    error.value = '';

    try {
      const data = await apiFetch<UserPinnedReposResponse>(
        `/api/users/${encodeURIComponent(login)}/pinned`
      );

      if (nextRequestId !== requestId) return;

      items.value = Array.isArray(data.items) ? data.items : [];
      source.value = data.source ?? 'pinned';
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      error.value = getFetchErrorMessage(fetchError, 'Failed to load pinned repositories.');
    } finally {
      if (nextRequestId === requestId) {
        loading.value = false;
      }
    }
  };

  watch(resolveUsername, () => void load(), { immediate: true });

  return {
    items,
    source,
    loading,
    error,
    refresh: load,
  };
}
