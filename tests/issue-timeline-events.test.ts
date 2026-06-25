import { describe, expect, test } from 'bun:test';

import { normalizeIssueTimelineItems } from '../app/composables/useIssueTimelineEvents';

const context = {
  repoOwner: 'gitpulse',
  repoName: 'gitpulse',
  issueNumber: 42,
};

describe('issue timeline client normalization', () => {
  test('keeps issue type events in the rendered timeline', () => {
    const items = normalizeIssueTimelineItems(
      [
        {
          kind: 'event',
          id: 'ITAE_1',
          eventType: 'issue_type_added',
          createdAt: '2026-06-01T12:06:03Z',
          issueType: {
            id: 26_699_556,
            name: '\u4efb\u52a1',
            color: 'pink',
          },
        },
      ],
      context
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      renderKey: 'ITAE_1',
      eventType: 'issue_type_added',
      issueType: {
        id: 26_699_556,
        name: '\u4efb\u52a1',
        color: 'pink',
      },
    });
  });
});
