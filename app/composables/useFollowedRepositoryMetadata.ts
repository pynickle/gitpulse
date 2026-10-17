import { computed } from 'vue';

import type { FollowedRepositoryMetadataResult } from '#shared/types/release-follows';

import { createFollowedRepositoryMetadata } from './followed-repositories/metadata';

export function useFollowedRepositoryMetadata() {
  const { user } = useUserSession();
  const { settings, loadSettings } = useUserSettings();
  const { followedRepositories } = useReleaseFollows();
  const apiFetch = useGitPulseApiFetch();

  return createFollowedRepositoryMetadata({
    login: computed(() => user.value?.login?.trim().toLowerCase() || null),
    repositories: followedRepositories,
    enabled: computed(() => settings.value.releaseFollows.view === 'detailed'),
    load: () => apiFetch<FollowedRepositoryMetadataResult>('/api/release-follows/metadata'),
    onRenamed: () => loadSettings({ force: true }),
  });
}
