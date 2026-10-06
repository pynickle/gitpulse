import { computed } from 'vue';

import { createFollowedRepositoryHttpAdapter } from './followed-repositories/httpAdapter';
import { getFollowedRepositoryQueries } from './followed-repositories/queries';

export function useFollowedRepositoryLookups() {
  const app = useNuxtApp();
  const { user } = useUserSession();
  const { settings, loaded, loadSettings } = useUserSettings();
  return getFollowedRepositoryQueries(app.vueApp, {
    login: computed(() => user.value?.login?.trim().toLowerCase() || null),
    repositories: computed(() => settings.value.followedRepositories ?? []),
    loaded,
    loadSettings,
    adapter: createFollowedRepositoryHttpAdapter(useGitPulseApiFetch()),
  });
}
