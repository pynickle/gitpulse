import type {
  NotificationSubjectEnrichmentResult,
  NotificationSubjectEnrichmentTarget,
} from '#shared/types/notifications';

interface NotificationSubjectEnrichmentFetchOptions {
  method: 'POST';
  body: {
    targets: NotificationSubjectEnrichmentTarget[];
  };
}

type NotificationSubjectEnrichmentFetch = (
  url: string,
  options: NotificationSubjectEnrichmentFetchOptions
) => Promise<unknown>;

const isSubjectEnrichmentResponse = (
  value: unknown
): value is { items: NotificationSubjectEnrichmentResult[] } => {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray(Reflect.get(value, 'items'));
};

export function createNotificationSubjectEnrichmentHttpAdapter(
  apiFetch: NotificationSubjectEnrichmentFetch
) {
  return {
    load: async (targets: NotificationSubjectEnrichmentTarget[]) => {
      try {
        const response = await apiFetch('/api/notifications/subject-states', {
          method: 'POST',
          body: { targets },
        });

        if (!isSubjectEnrichmentResponse(response)) {
          throw new Error('Invalid response');
        }

        return response.items;
      } catch {
        throw new Error('Notification Subject Enrichment request failed');
      }
    },
  };
}
