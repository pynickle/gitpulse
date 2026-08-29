import { computed } from 'vue';

import type { FollowAddResult, FollowedRepository } from '#shared/types/release-follows';
import {
  applyFollowAdd,
  applyFollowClear,
  applyFollowRemove,
  cloneFollowedRepositories,
  getFollowAddBlock,
} from '#shared/utils/release-follows';

export function useReleaseFollows() {
  const { settings, loaded, loadSettings, updateSettings } = useUserSettings();

  if (import.meta.client) {
    void loadSettings();
  }

  const ensureLoaded = async () => {
    if (!loaded.value) {
      await loadSettings();
    }
  };

  const followedRepositories = computed(() => {
    return cloneFollowedRepositories(settings.value.followedRepositories ?? []);
  });

  const followedIds = computed(() => {
    return new Set(followedRepositories.value.map((item) => item.id));
  });

  const addBlock = computed(() => getFollowAddBlock(followedRepositories.value));

  const persist = async (list: FollowedRepository[]) => {
    await updateSettings({ followedRepositories: list });
  };

  const addFollow = async (repo: FollowedRepository): Promise<FollowAddResult> => {
    await ensureLoaded();
    const result = applyFollowAdd(followedRepositories.value, repo);
    if (!result.ok) return result;
    await persist(result.list);
    return result;
  };

  const removeFollow = async (id: string) => {
    await ensureLoaded();
    await persist(applyFollowRemove(followedRepositories.value, id));
  };

  const clearFollows = async () => {
    await ensureLoaded();
    await persist(applyFollowClear());
  };

  const toggleFollow = async (repo: FollowedRepository): Promise<FollowAddResult> => {
    await ensureLoaded();
    if (followedIds.value.has(repo.id)) {
      const next = applyFollowRemove(followedRepositories.value, repo.id);
      await persist(next);
      return { ok: true, list: next };
    }

    return addFollow(repo);
  };

  return {
    loaded,
    followedRepositories,
    followedIds,
    addBlock,
    addFollow,
    removeFollow,
    clearFollows,
    toggleFollow,
  };
}
