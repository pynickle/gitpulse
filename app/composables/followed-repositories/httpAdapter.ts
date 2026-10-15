import type { LookupClassification, ReleaseTimeline } from '#shared/types/release-follows';

import type { FollowedRepositoryAdapter } from './queries';

export function createFollowedRepositoryHttpAdapter(
  fetch: <T>(path: string, options?: { method: 'POST' }) => Promise<T>
): FollowedRepositoryAdapter {
  return {
    identities: () =>
      fetch<LookupClassification & { renamed?: boolean }>('/api/release-follows/identities'),
    timeline: (request) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const params = new URLSearchParams({ timeZone });
      if (request?.cursors) {
        params.set('cursors', JSON.stringify(request.cursors));
        return fetch<ReleaseTimeline>(`/api/release-timeline?${params.toString()}`);
      }
      return fetch<ReleaseTimeline>(`/api/release-timeline/refresh?${params.toString()}`, {
        method: 'POST',
      });
    },
  };
}
