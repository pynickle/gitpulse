import { describe, expect, mock, test } from 'bun:test';

mock.module(
  '~/utils/groupAdjacentTimelineItems',
  () => import('../app/utils/groupAdjacentTimelineItems')
);
mock.module('~/utils/parseGitHubMarkdownTarget', () => ({
  parseGitHubMarkdownTarget: () => null,
}));
mock.module('~/utils/parseGitHubRepoPath', () => ({
  parseGitHubRepoPath: () => null,
}));

const { normalizePRTimelineItems } = await import('../app/composables/usePRTimelineEvents');

describe('pull request timeline client normalization', () => {
  test('groups adjacent references and preserves each actor, target, and timestamp', () => {
    const items = normalizePRTimelineItems([
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
      { kind: 'event', id: 'label', eventType: 'labeled' },
      {
        kind: 'event',
        id: 'ref-3',
        eventType: 'cross-referenced',
        createdAt: '2026-06-01T12:02:00Z',
        source: { number: 25, title: 'Third', resourceType: 'issue' },
      },
    ]);

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
    expect(items[2]?.id).toBe('ref-3');
    expect(items[2]?.groupedEvents).toBeUndefined();
  });

  test('does not group adjacent references with different or missing usernames', () => {
    const items = normalizePRTimelineItems([
      { kind: 'event', id: 'ref-1', eventType: 'cross-referenced', actor: { login: 'alice' } },
      { kind: 'event', id: 'ref-2', eventType: 'cross-referenced', actor: { login: 'bob' } },
      { kind: 'event', id: 'ref-3', eventType: 'cross-referenced' },
      { kind: 'event', id: 'ref-4', eventType: 'cross-referenced' },
    ]);

    expect(items).toHaveLength(4);
    expect(items.every(({ groupedEvents }) => groupedEvents === undefined)).toBe(true);
  });

  test('groups adjacent sub-issue additions separately from other reference events', () => {
    const items = normalizePRTimelineItems([
      {
        kind: 'event',
        id: 'sub-1',
        eventType: 'sub_issue_added',
        createdAt: 'first',
        actor: { login: 'alice' },
      },
      {
        kind: 'event',
        id: 'sub-2',
        eventType: 'sub_issue_added',
        createdAt: 'second',
        actor: { login: 'alice' },
      },
      {
        kind: 'event',
        id: 'sub-3',
        eventType: 'sub_issue_added',
        createdAt: 'third',
        actor: { login: 'alice' },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.groupedEvents?.map(({ id, createdAt }) => ({ id, createdAt }))).toEqual([
      { id: 'sub-1', createdAt: 'first' },
      { id: 'sub-2', createdAt: 'second' },
      { id: 'sub-3', createdAt: 'third' },
    ]);
  });
});
