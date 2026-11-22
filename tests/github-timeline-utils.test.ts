import { describe, expect, mock, test } from 'bun:test';

const reactions = await import('../shared/utils/reactions');

mock.module('#shared/utils/reactions', () => reactions);
mock.module('#shared/utils/copilot-review', () => import('../shared/utils/copilot-review'));
mock.module('#shared/types/comment-moderation', () => import('../shared/types/comment-moderation'));

const {
  assignCommitCheckRollups,
  applyPRForcePushRefs,
  enrichPRTimelineWithReviewData,
  fetchPRReviewMetadata,
  fetchPRTimelineSupplement,
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

describe('issue timeline REST event normalization', () => {
  test('maps a sub-issue target from repository metadata when REST omits its URL', () => {
    const item = normalizeIssueTimelineEvent(
      {
        event: 'sub_issue_added',
        sub_issue: {
          number: 27,
          title: 'Build setup',
          repository: { name: 'build', full_name: 'acme/build', owner: { login: 'acme' } },
        },
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'event',
      degraded: false,
      subIssue: {
        resourceType: 'issue',
        number: 27,
        title: 'Build setup',
        repository: { name: 'build', nameWithOwner: 'acme/build', owner: { login: 'acme' } },
      },
    });
  });

  test('keeps an incomplete cross-reference without guessing its repository', () => {
    const item = normalizeIssueTimelineEvent(
      { event: 'cross-referenced', source: { issue: { number: 23 } } },
      context
    );

    expect(item.source).toBeUndefined();
    expect(item.displayText).toContain('no longer fully visible');
  });

  test('maps a parent issue from repository metadata when REST omits its URL', () => {
    const item = normalizeIssueTimelineEvent(
      {
        event: 'parent_issue_added',
        parent_issue: {
          number: 1,
          title: 'Spec',
          state: 'open',
          repository: {
            name: 'trial-contracts',
            full_name: 'pynickle/trial-contracts',
            owner: { login: 'pynickle' },
          },
        },
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'event',
      eventType: 'parent_issue_added',
      parent: {
        resourceType: 'issue',
        number: 1,
        title: 'Spec',
        state: 'open',
        repository: {
          name: 'trial-contracts',
          nameWithOwner: 'pynickle/trial-contracts',
          owner: { login: 'pynickle' },
        },
      },
    });
  });

  test('maps a blocked-by issue from repository metadata when REST includes it', () => {
    const item = normalizeIssueTimelineEvent(
      {
        event: 'blocked_by_added',
        blocked_by: {
          number: 17,
          title: 'Settings',
          state: 'open',
          repository: {
            name: 'trial-contracts',
            full_name: 'pynickle/trial-contracts',
            owner: { login: 'pynickle' },
          },
        },
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'event',
      eventType: 'blocked_by_added',
      blockedIssue: {
        resourceType: 'issue',
        number: 17,
        title: 'Settings',
        repository: {
          name: 'trial-contracts',
          nameWithOwner: 'pynickle/trial-contracts',
          owner: { login: 'pynickle' },
        },
      },
    });
  });

  test('marks a blocked-by event unavailable when REST omits the other issue', () => {
    const item = normalizeIssueTimelineEvent({ event: 'blocked_by_removed' }, context);

    expect(item).toMatchObject({
      kind: 'unavailable',
      eventType: 'blocked_by_removed',
      unavailableReasonCode: 'blocking',
    });
    expect(item.blockedIssue).toBeUndefined();
  });

  test('marks a parent issue event unavailable when REST omits the parent', () => {
    const item = normalizeIssueTimelineEvent(
      {
        id: 7,
        event: 'parent_issue_removed',
        actor: user('alice'),
        created_at: '2026-06-01T12:00:00Z',
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'unavailable',
      eventType: 'parent_issue_removed',
      unavailableReasonCode: 'parent',
    });
    expect(item.parent).toBeUndefined();
  });

  test('keeps sub-issue additions visible when REST omits the target issue', () => {
    const item = normalizeIssueTimelineEvent(
      {
        id: 42,
        event: 'sub_issue_added',
        actor: user('alice'),
        created_at: '2026-06-01T12:00:00Z',
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'event',
      eventType: 'sub_issue_added',
      degraded: true,
      displayText: expect.stringContaining('details are unavailable'),
    });
    expect(item.subIssue).toBeUndefined();
  });
});

describe('PR timeline server normalization', () => {
  test('attributes Copilot work to the service and preserves the requesting actor', () => {
    const [item] = normalizePRTimelineEvent(
      {
        id: 1,
        event: 'copilot_work_started',
        actor: user('viadanna'),
        created_at: '2026-11-11T02:56:35Z',
        performed_via_github_app: { id: 946600, slug: 'copilot-pull-request-reviewer' },
      },
      context
    );

    expect(item).toMatchObject({
      kind: 'event',
      eventType: 'copilot_work_started',
      actor: { login: 'viadanna' },
      copilotWorkType: 'review',
    });
  });

  test('attaches the actual Copilot effort to its submitted review', () => {
    const timeline = normalizePRTimelineEvent(
      { id: 2, event: 'reviewed', user: user('Copilot') },
      context
    );
    const [item] = enrichPRTimelineWithReviewData(
      timeline,
      [],
      [],
      [],
      new Map([['2', { isCopilotCodeReview: true, copilotReviewEffort: 'balanced' }]])
    );
    expect(item).toMatchObject({ isCopilotCodeReview: true, copilotReviewEffort: 'balanced' });
  });
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
    } as unknown as Parameters<typeof fetchPRReviewMetadata>[0];

    const teamsByReviewId = await fetchPRReviewMetadata(octokit, 'octo', 'app', 1);

    expect(calls).toEqual([
      { owner: 'octo', repo: 'app', pullNumber: 1, cursor: null },
      { owner: 'octo', repo: 'app', pullNumber: 1, cursor: 'cursor-1' },
    ]);
    expect(teamsByReviewId.get('11')?.onBehalfOf).toEqual([
      {
        name: 'Reviewers',
        slug: 'reviewers',
        url: 'https://github.com/orgs/octo/teams/reviewers',
        organizationLogin: 'octo',
      },
    ]);
    expect(teamsByReviewId.has('12')).toBe(false);
    expect(teamsByReviewId.get('13')?.onBehalfOf).toEqual([
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
      new Map([
        [
          '11',
          { onBehalfOf: [{ name: 'Reviewers', slug: 'reviewers', organizationLogin: 'octo' }] },
        ],
      ])
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

describe('timeline commit verification and check rollups', () => {
  test('keeps a committed event verdict and drops the signature material', () => {
    const [item] = normalizePullTimeline([
      {
        event: 'committed',
        sha: 'abcdef0123456789',
        message: 'feat: sign\n\nbody',
        html_url: 'https://github.com/acme/widgets/commit/abcdef0123456789',
        author: { name: 'Local Dev', date: '2024-01-01T00:00:00Z' },
        verification: {
          verified: false,
          reason: 'bad_email',
          signature: '-----BEGIN PGP SIGNATURE-----\nsecret\n-----END PGP SIGNATURE-----',
          payload: 'tree abc',
          verified_at: null,
        },
      },
    ]);

    expect(item?.kind).toBe('commit');
    expect(item?.commit?.verification).toEqual({
      verified: false,
      reason: 'bad_email',
      verifiedAt: null,
    });
    expect(JSON.stringify(item)).not.toContain('BEGIN PGP');
    expect(JSON.stringify(item)).not.toContain('tree abc');
  });

  test('assigns a rollup by commit SHA and leaves non-commit events alone', () => {
    const rollup = {
      state: 'FAILURE',
      contexts: { totalCount: 1, nodes: [] },
    };
    const items = assignCommitCheckRollups(
      [
        { kind: 'commit', commit: { oid: 'abc' } },
        { kind: 'commit', commit: { oid: 'missing' } },
        { kind: 'event', eventType: 'merged', commit: { oid: 'def' } },
      ],
      new Map([['abc', rollup]])
    );

    expect(items[0]?.commit?.checkRollup).toEqual(rollup);
    expect(items[1]?.commit?.checkRollup).toBeNull();
    expect(items[2]?.commit?.checkRollup).toBeUndefined();
  });
});

describe('force-push events', () => {
  // REST reports a force push with no ref and no commits; GraphQL knows both. The
  // event's own node id is the same in both APIs, which is how they are joined.
  // REST carries both a numeric event id and a node id; the numeric one must not be
  // mistaken for the node id GraphQL keys on.
  const restForcePush = (event: string, nodeId: string, createdAt: string, id = 36907013486) => ({
    event,
    id,
    node_id: nodeId,
    created_at: createdAt,
    actor: user('pynickle'),
    commit_id: null,
    commit_url: null,
  });

  test('fills a force-pushed branch and its commits from the GraphQL refs', () => {
    const timeline = normalizePullTimeline([
      restForcePush('head_ref_force_pushed', 'HRFPE_one', '2026-11-22T05:50:35Z'),
      restForcePush('base_ref_force_pushed', 'BRFPE_two', '2026-11-22T05:49:58Z'),
    ]);

    applyPRForcePushRefs(timeline, [
      {
        id: 'HRFPE_one',
        refName: 'stack/reb-03',
        beforeOid: 'd116a1d33bc23e3ac3556ea782b714eea075babd',
        afterOid: '06e80370cd900edd211dc580a990e3a6b216b3ab',
      },
      {
        id: 'BRFPE_two',
        refName: 'stack/reb-02',
        beforeOid: '11263214ca7ba2be31f06e02a47a40f9cfecec0c',
        afterOid: 'f7076f1615b7308d9680cca8df8b46361c0b22d9',
      },
    ]);

    const head = timeline.find((item) => item.eventType === 'head_ref_force_pushed');
    const base = timeline.find((item) => item.eventType === 'base_ref_force_pushed');
    expect(head?.ref?.name).toBe('stack/reb-03');
    expect(head?.beforeCommit?.oid).toBe('d116a1d33bc23e3ac3556ea782b714eea075babd');
    expect(head?.afterCommit?.oid).toBe('06e80370cd900edd211dc580a990e3a6b216b3ab');
    expect(base?.ref?.name).toBe('stack/reb-02');
    expect(base?.beforeCommit?.oid).toBe('11263214ca7ba2be31f06e02a47a40f9cfecec0c');
  });

  test('leaves a force push alone when GraphQL named no other event', () => {
    const timeline = normalizePullTimeline([
      restForcePush('head_ref_force_pushed', 'HRFPE_unmatched', '2026-11-22T05:50:35Z'),
    ]);

    applyPRForcePushRefs(timeline, []);

    const [item] = timeline;
    // REST named neither, and GraphQL had nothing to add.
    expect(item.ref?.name).toBeUndefined();
    expect(item.beforeCommit).toBeUndefined();
    expect(item.afterCommit).toBeUndefined();
  });
});

describe('timeline supplement', () => {
  const supplementNode = (overrides: Record<string, any> = {}) => ({
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: [
            { id: 'thread-1', isResolved: false, isOutdated: false, comments: { nodes: [] } },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        reviews: {
          nodes: [{ databaseId: 7, isCopilotCodeReview: true, copilotCodeReviewEffort: 'lite' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        timelineItems: {
          nodes: [
            {
              id: 'HRFPE_one',
              ref: { name: 'stack/reb-03' },
              beforeCommit: { oid: 'd116a1d33bc23e3ac3556ea782b714eea075babd' },
              afterCommit: { oid: '06e80370cd900edd211dc580a990e3a6b216b3ab' },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        ...overrides,
      },
    },
  });

  test('reads threads, review provenance and force pushes in one request', async () => {
    const requests: unknown[] = [];
    const octokit = {
      graphql: async (query: string, variables: unknown) => {
        requests.push({ query, variables });
        return supplementNode();
      },
    };

    const supplement = await fetchPRTimelineSupplement(
      octokit as never,
      'pynickle',
      'pynickle',
      16
    );

    expect(requests).toHaveLength(1);
    expect(supplement.reviewThreads.map((thread) => thread.id)).toEqual(['thread-1']);
    expect(supplement.reviewMetadata.get('7')).toEqual({
      isCopilotCodeReview: true,
      copilotReviewEffort: 'lite',
    });
    expect(supplement.forcePushRefs).toEqual([
      {
        id: 'HRFPE_one',
        refName: 'stack/reb-03',
        beforeOid: 'd116a1d33bc23e3ac3556ea782b714eea075babd',
        afterOid: '06e80370cd900edd211dc580a990e3a6b216b3ab',
      },
    ]);
  });

  test('finishes an overflowing connection with its own fetcher', async () => {
    let calls = 0;
    const octokit = {
      graphql: async () => {
        calls += 1;
        if (calls === 1) {
          return supplementNode({
            reviewThreads: {
              nodes: [
                { id: 'thread-1', isResolved: false, isOutdated: false, comments: { nodes: [] } },
              ],
              pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            },
          });
        }
        // The per-connection fetcher, started over from its own first page.
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  { id: 'thread-1', isResolved: false, isOutdated: false, comments: { nodes: [] } },
                  { id: 'thread-2', isResolved: false, isOutdated: false, comments: { nodes: [] } },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        };
      },
    };

    const supplement = await fetchPRTimelineSupplement(
      octokit as never,
      'pynickle',
      'pynickle',
      16
    );

    // The merged page is kept, and the fallback adds only what it did not have.
    expect(supplement.reviewThreads.map((thread) => thread.id)).toEqual(['thread-1', 'thread-2']);
  });
});
