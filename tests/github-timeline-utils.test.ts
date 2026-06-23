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

  test('merges adjacent label changes from different actors', () => {
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
        actor: user('Chiloven945'),
        label: { name: 'stale', color: 'ededed' },
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'labels_changed',
      actor: { login: 'SALTWOOD' },
      displayText: 'SALTWOOD added label bug and Chiloven945 removed label stale',
      hasMixedActors: true,
      labelChanges: [
        { actor: { login: 'SALTWOOD' }, action: 'added label', value: 'bug' },
        { actor: { login: 'Chiloven945' }, action: 'removed label', value: 'stale' },
      ],
    });
  });

  test('merges adjacent assignment changes from different actors without self-assignment wording', () => {
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
        event: 'assigned',
        created_at: '2026-06-23T12:00:01Z',
        actor: user('Chiloven945'),
        assignee: user('Chiloven945'),
      },
    ]);

    expect(item).toMatchObject({
      eventType: 'assignees_changed',
      displayText: 'SALTWOOD assigned Chiloven945 and Chiloven945 assigned Chiloven945',
      hasMixedActors: true,
      assigneeChanges: [
        { actor: { login: 'SALTWOOD' }, action: 'assigned', value: 'Chiloven945' },
        { actor: { login: 'Chiloven945' }, action: 'assigned', value: 'Chiloven945' },
      ],
    });
    expect(item.displayText).not.toContain('self-assigned');
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

  test('merges adjacent assignment and label changes on the server', () => {
    const [assignmentItem, labelItem] = normalizeIssueTimeline([
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

    expect(assignmentItem).toMatchObject({
      eventType: 'assignees_changed',
      displayText: 'SALTWOOD assigned Chiloven945 and Chiloven945 unassigned Chiloven945',
      hasMixedActors: true,
    });
    expect(assignmentItem.displayText).not.toContain('self-assigned');

    expect(labelItem).toMatchObject({
      eventType: 'labels_changed',
      displayText: 'SALTWOOD added label bug and Chiloven945 removed label stale',
      hasMixedActors: true,
    });
  });
});
