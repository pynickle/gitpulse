import { describe, expect, mock, test } from 'bun:test';

const reactions = await import('../shared/utils/reactions');

mock.module('#shared/utils/reactions', () => reactions);

const {
  enrichPRTimelineWithReviewData,
  fetchPRReviewOnBehalfOf,
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

  test('maps review on-behalf-of teams from every GraphQL review page', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const octokit = {
      graphql: async (_query: string, variables: Record<string, unknown>) => {
        calls.push(variables);

        if (!variables.cursor) {
          return {
            repository: {
              pullRequest: {
                reviews: {
                  nodes: [
                    {
                      databaseId: 11,
                      onBehalfOf: {
                        nodes: [
                          {
                            name: 'Reviewers',
                            slug: 'reviewers',
                            url: 'https://github.com/orgs/octo/teams/reviewers',
                            organization: { login: 'octo' },
                          },
                        ],
                      },
                    },
                    { databaseId: 12, onBehalfOf: { nodes: [] } },
                  ],
                  pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
                },
              },
            },
          };
        }

        return {
          repository: {
            pullRequest: {
              reviews: {
                nodes: [
                  {
                    databaseId: 13,
                    onBehalfOf: {
                      nodes: [
                        {
                          name: 'Core',
                          slug: 'core',
                          url: 'https://github.com/orgs/octo/teams/core',
                          organization: { login: 'octo' },
                        },
                      ],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        };
      },
    } as unknown as Parameters<typeof fetchPRReviewOnBehalfOf>[0];

    const teamsByReviewId = await fetchPRReviewOnBehalfOf(octokit, 'octo', 'app', 1);

    expect(calls).toEqual([
      { owner: 'octo', repo: 'app', pullNumber: 1, cursor: null },
      { owner: 'octo', repo: 'app', pullNumber: 1, cursor: 'cursor-1' },
    ]);
    expect(teamsByReviewId.get('11')).toEqual([
      {
        name: 'Reviewers',
        slug: 'reviewers',
        url: 'https://github.com/orgs/octo/teams/reviewers',
        organizationLogin: 'octo',
      },
    ]);
    expect(teamsByReviewId.has('12')).toBe(false);
    expect(teamsByReviewId.get('13')).toEqual([
      {
        name: 'Core',
        slug: 'core',
        url: 'https://github.com/orgs/octo/teams/core',
        organizationLogin: 'octo',
      },
    ]);
  });

  test('attaches on-behalf-of teams to the review they belong to', () => {
    const timeline = normalizePullTimeline([
      {
        id: 11,
        event: 'reviewed',
        state: 'approved',
        created_at: '2026-11-07T00:00:00Z',
        user: user('octo'),
        body: 'LGTM',
      },
    ]);
    const reviews = [
      {
        id: 11,
        state: 'APPROVED',
        body: 'LGTM',
        submitted_at: '2026-11-07T00:00:00Z',
        user: user('octo'),
      },
    ];

    const [enriched] = enrichPRTimelineWithReviewData(
      timeline,
      reviews,
      [],
      [],
      new Map([['11', [{ name: 'Reviewers', slug: 'reviewers', organizationLogin: 'octo' }]]])
    );

    expect(enriched).toMatchObject({
      kind: 'review',
      state: 'approved',
      onBehalfOf: [{ name: 'Reviewers', slug: 'reviewers', organizationLogin: 'octo' }],
    });
  });

  test('omits on-behalf-of when the review has no team attribution', () => {
    const timeline = normalizePullTimeline([
      {
        id: 11,
        event: 'reviewed',
        state: 'approved',
        created_at: '2026-11-07T00:00:00Z',
        user: user('octo'),
        body: 'LGTM',
      },
    ]);
    const reviews = [
      {
        id: 11,
        state: 'APPROVED',
        body: 'LGTM',
        submitted_at: '2026-11-07T00:00:00Z',
        user: user('octo'),
      },
    ];

    const [enriched] = enrichPRTimelineWithReviewData(timeline, reviews, [], [], new Map());

    expect(enriched).toMatchObject({ kind: 'review', state: 'approved' });
    expect(enriched).not.toHaveProperty('onBehalfOf');
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

  test('normalizes REST issue type events', () => {
    const items = normalizeIssueTimeline([
      {
        id: 26_186_149_713,
        event: 'issue_type_added',
        created_at: '2026-06-01T12:06:03Z',
        actor: user('SALTWOOD'),
        issue_type: {
          id: 26_699_556,
          name: '\u4efb\u52a1',
          color: 'pink',
        },
      },
      {
        id: 26_186_149_714,
        event: 'issue_type_changed',
        created_at: '2026-06-01T12:07:03Z',
        actor: user('SALTWOOD'),
        prev_issue_type: {
          id: 26_699_555,
          name: 'Bug',
          color: 'red',
        },
        issue_type: {
          id: 26_699_556,
          name: 'Task',
          color: 'blue',
        },
      },
      {
        id: 26_186_149_715,
        event: 'issue_type_removed',
        created_at: '2026-06-01T12:08:03Z',
        actor: user('SALTWOOD'),
        issue_type: {
          id: 26_699_556,
          name: 'Task',
          color: 'blue',
        },
      },
    ]);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      kind: 'event',
      eventType: 'issue_type_added',
      id: '26186149713',
      actor: { login: 'SALTWOOD' },
      issueType: {
        id: 26_699_556,
        name: '\u4efb\u52a1',
        color: 'pink',
      },
    });
    expect(items[1]).toMatchObject({
      eventType: 'issue_type_changed',
      prevIssueType: {
        id: 26_699_555,
        name: 'Bug',
        color: 'red',
      },
      issueType: {
        id: 26_699_556,
        name: 'Task',
        color: 'blue',
      },
    });
    expect(items[2]).toMatchObject({
      eventType: 'issue_type_removed',
      issueType: {
        id: 26_699_556,
        name: 'Task',
        color: 'blue',
      },
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
