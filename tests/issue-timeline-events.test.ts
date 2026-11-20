import { describe, expect, test } from 'bun:test';

import { normalizeIssueTimelineItems } from '../app/composables/useIssueTimelineEvents';

const context = {
  repoOwner: 'gitpulse',
  repoName: 'gitpulse',
  issueNumber: 42,
};

describe('issue timeline client normalization', () => {
  test('groups adjacent references and sub-issue additions without losing actors or timestamps', () => {
    const items = normalizeIssueTimelineItems(
      [
        {
          kind: 'event',
          id: 'ref-1',
          eventType: 'cross-referenced',
          createdAt: '2026-06-01T12:00:00Z',
          actor: { login: 'alice' },
          source: { number: 23, title: 'First', resourceType: 'issue' },
        },
        {
          kind: 'event',
          id: 'ref-2',
          eventType: 'cross-referenced',
          createdAt: '2026-06-01T12:01:00Z',
          actor: { login: 'alice' },
          source: { number: 24, title: 'Second', resourceType: 'issue' },
        },
        {
          kind: 'event',
          id: 'ref-3',
          eventType: 'cross-referenced',
          createdAt: '2026-06-01T12:01:30Z',
          actor: { login: 'bob' },
          source: { number: 25, title: 'Third', resourceType: 'issue' },
        },
        {
          kind: 'event',
          id: 'sub-1',
          eventType: 'sub_issue_added',
          createdAt: '2026-06-01T12:02:00Z',
          actor: { login: 'alice' },
          subIssue: { number: 27, title: 'Third', resourceType: 'issue' },
        },
        {
          kind: 'event',
          id: 'sub-2',
          eventType: 'sub_issue_added',
          createdAt: '2026-06-01T12:03:00Z',
          actor: { login: 'alice' },
          subIssue: { number: 28, title: 'Fourth', resourceType: 'issue' },
        },
      ],
      context
    );

    expect(items).toHaveLength(3);
    expect(
      items[0]?.groupedEvents?.map(({ id, actor, createdAt, source }) => ({
        id,
        actor: actor?.login,
        createdAt,
        number: source?.number,
      }))
    ).toEqual([
      { id: 'ref-1', actor: 'alice', createdAt: '2026-06-01T12:00:00Z', number: 23 },
      { id: 'ref-2', actor: 'alice', createdAt: '2026-06-01T12:01:00Z', number: 24 },
    ]);
    expect(items[1]?.id).toBe('ref-3');
    expect(items[1]?.groupedEvents).toBeUndefined();
    expect(
      items[2]?.groupedEvents?.map(({ id, createdAt, subIssue }) => ({
        id,
        createdAt,
        number: subIssue?.number,
      }))
    ).toEqual([
      { id: 'sub-1', createdAt: '2026-06-01T12:02:00Z', number: 27 },
      { id: 'sub-2', createdAt: '2026-06-01T12:03:00Z', number: 28 },
    ]);
  });

  test('does not group same-type references across an intervening event', () => {
    const items = normalizeIssueTimelineItems(
      [
        { kind: 'event', id: 'ref-1', eventType: 'cross-referenced', actor: { login: 'alice' } },
        { kind: 'event', id: 'label', eventType: 'labeled' },
        { kind: 'event', id: 'ref-2', eventType: 'cross-referenced', actor: { login: 'alice' } },
      ],
      context
    );

    expect(items.map(({ id, groupedEvents }) => [id, groupedEvents?.length])).toEqual([
      ['ref-1', undefined],
      ['label', undefined],
      ['ref-2', undefined],
    ]);
  });

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
