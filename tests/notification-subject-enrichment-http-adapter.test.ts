import { describe, expect, test } from 'bun:test';

import { createNotificationSubjectEnrichmentHttpAdapter } from '../app/composables/notification-subject-enrichment/httpAdapter';
import type { NotificationSubjectEnrichmentTarget } from '../shared/types/notifications';

const target: NotificationSubjectEnrichmentTarget = {
  key: 'acme/widgets/issues/1',
  owner: 'acme',
  repo: 'widgets',
  type: 'issues',
  number: 1,
};

describe('Notification Subject Enrichment HTTP adapter', () => {
  test('uses the CSRF-aware fetch dependency and normalizes the endpoint response', async () => {
    const requests: Array<{ url: string; options: Record<string, unknown> }> = [];
    const apiFetch = async (url: string, options: Record<string, unknown>) => {
      requests.push({ url, options });
      return {
        items: [{ key: target.key, title: 'Loaded title', state: 'open' }],
      };
    };
    const adapter = createNotificationSubjectEnrichmentHttpAdapter(apiFetch);

    const results = await adapter.load([target]);

    expect(requests).toEqual([
      {
        url: '/api/notifications/subject-states',
        options: {
          method: 'POST',
          body: { targets: [target] },
        },
      },
    ]);
    expect(results).toEqual([{ key: target.key, title: 'Loaded title', state: 'open' }]);
  });

  test('hides transport details behind an adapter failure', async () => {
    const adapter = createNotificationSubjectEnrichmentHttpAdapter(async () => {
      throw new Error('GraphQL 502: private transport detail');
    });

    await expect(adapter.load([target])).rejects.toThrow(
      'Notification Subject Enrichment request failed'
    );
    await expect(adapter.load([target])).rejects.not.toThrow('GraphQL 502');
  });
});
