import { describe, expect, mock, test } from 'bun:test';

const reactions = await import('../shared/utils/reactions');

mock.module('#shared/utils/reactions', () => reactions);

const {
  normalizeIssueTimelineEvent,
  normalizePRTimelineEvent,
  normalizeTimelineStateItems,
  sortTimelineItems,
} = await import('../server/utils/github-timeline-utils');

const context = { owner: 'gitpulse', repo: 'gitpulse' };

const user = (login: string) => ({
  login,
  avatar_url: `https://avatars.githubusercontent.com/${login}`,
  html_url: `https://github.com/${login}`,
});

const normalizePullTimeline = (rawEvents: Record<string, any>[]) =>
  normalizeTimelineStateItems(
    sortTimelineItems(rawEvents.flatMap((rawEvent) => normalizePRTimelineEvent(rawEvent, context)))
  );

const normalizeIssueTimeline = (rawEvents: Record<string, any>[]) =>
  normalizeTimelineStateItems(
    sortTimelineItems(rawEvents.map((rawEvent) => normalizeIssueTimelineEvent(rawEvent, context)))
  );

describe('PR timeline server normalization', () => {
  test('adds server display text for a single assignment', () => {
    const [item] = normalizePullTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('Chiloven945'),
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'assigned',
      actor: { login: 'SALTWOOD' },
      assignee: { login: 'Chiloven945' },
      displayText: 'assigned Chiloven945',
    });
  });

  test('marks a single self-assignment as self-assigned', () => {
    const [item] = normalizePullTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('SALTWOOD'),
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'assigned',
      actor: { login: 'SALTWOOD' },
      assignee: { login: 'SALTWOOD' },
      displayText: 'self-assigned this',
    });
  });

  test('merges adjacent assignment changes without self-assignment wording', () => {
    const [item] = normalizePullTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('Chiloven945'),
      },
      {
        id: 2,
        event: 'unassigned',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('SALTWOOD'),
        assignee: user('SALTWOOD'),
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'assignees_changed',
      actor: { login: 'SALTWOOD' },
      displayText: 'assigned Chiloven945 and unassigned SALTWOOD',
    });
    expect(item.displayText).not.toContain('self-assigned');
  });

  test('merges adjacent label changes into one server-provided display text', () => {
    const [item] = normalizePullTimeline([
      {
        id: 1,
        event: 'labeled',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        label: { name: 'bug', color: 'd73a4a' },
      },
      {
        id: 2,
        event: 'unlabeled',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('SALTWOOD'),
        label: { name: 'stale', color: 'ededed' },
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'labels_changed',
      actor: { login: 'SALTWOOD' },
      displayText: 'added label bug and removed label stale',
      hasMixedActors: false,
    });
  });

  test('does not merge adjacent label changes from different actors', () => {
    const items = normalizePullTimeline([
      {
        id: 1,
        event: 'labeled',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        label: { name: 'bug', color: 'd73a4a' },
      },
      {
        id: 2,
        event: 'unlabeled',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('Chiloven945'),
        label: { name: 'stale', color: 'ededed' },
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      eventType: 'labeled',
      actor: { login: 'SALTWOOD' },
      label: { name: 'bug' },
    });
    expect(items[1]).toMatchObject({
      eventType: 'unlabeled',
      actor: { login: 'Chiloven945' },
      label: { name: 'stale' },
    });
  });

  test('does not merge adjacent assignment changes from different actors', () => {
    const items = normalizePullTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('Chiloven945'),
      },
      {
        id: 2,
        event: 'assigned',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('Chiloven945'),
        assignee: user('Chiloven945'),
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      eventType: 'assigned',
      actor: { login: 'SALTWOOD' },
      assignee: { login: 'Chiloven945' },
      displayText: 'assigned Chiloven945',
    });
    expect(items[1]).toMatchObject({
      eventType: 'assigned',
      actor: { login: 'Chiloven945' },
      assignee: { login: 'Chiloven945' },
      displayText: 'self-assigned this',
    });
  });
});

describe('issue timeline server normalization', () => {
  test('marks a single self-assignment as self-assigned', () => {
    const [item] = normalizeIssueTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('SALTWOOD'),
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'assigned',
      actor: { login: 'SALTWOOD' },
      assignee: { login: 'SALTWOOD' },
      displayText: 'self-assigned this',
    });
  });

  test('does not merge adjacent assignment and label changes across different actors', () => {
    const items = normalizeIssueTimeline([
      {
        id: 1,
        event: 'assigned',
        created_at: '2026-06-23T12:00:00Z',
        actor: user('SALTWOOD'),
        assignee: user('Chiloven945'),
      },
      {
        id: 2,
        event: 'unassigned',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('Chiloven945'),
        assignee: user('Chiloven945'),
      },
      {
        id: 3,
        event: 'labeled',
        created_at: '2026-06-23T12:00:02Z',
        actor: user('SALTWOOD'),
        label: { name: 'bug', color: 'd73a4a' },
      },
      {
        id: 4,
        event: 'unlabeled',
        created_at: '2026-06-23T12:00:03Z',
        actor: user('Chiloven945'),
        label: { name: 'stale', color: 'ededed' },
      },
    ]);

    expect(items).toHaveLength(4);
    expect(items.map((item) => item.eventType)).toEqual([
      'assigned',
      'unassigned',
      'labeled',
      'unlabeled',
    ]);
    expect(items.map((item) => item.actor?.login)).toEqual([
      'SALTWOOD',
      'Chiloven945',
      'SALTWOOD',
      'Chiloven945',
    ]);
  });
});
