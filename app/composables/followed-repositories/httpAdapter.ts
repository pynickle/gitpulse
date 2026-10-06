import type { LookupClassification, ReleaseTimeline } from '#shared/types/release-follows';

import type { FollowedRepositoryAdapter } from './queries';

export function createFollowedRepositoryHttpAdapter(
  fetch: <T>(path: string) => Promise<T>
): FollowedRepositoryAdapter {
  return {
    identities: () =>
      fetch<LookupClassification & { renamed?: boolean }>('/api/release-follows/identities'),
    timeline: () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const params = new URLSearchParams({ timeZone });
      return fetch<ReleaseTimeline>(`/api/release-timeline?${params.toString()}`);
    },
  };
}
