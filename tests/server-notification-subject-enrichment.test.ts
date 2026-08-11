import { describe, expect, mock, test } from 'bun:test';

const validationUtils = await import('../server/utils/notification-subject-state-validation-utils');

let requestBody: unknown;
let graphQLRequest: (query: string, variables: Record<string, unknown>) => Promise<unknown>;
let routedError: unknown;

(
  globalThis as unknown as {
    defineEventHandler: typeof defineEventHandler;
  }
).defineEventHandler = ((handler: unknown) => handler) as typeof defineEventHandler;
(
  globalThis as unknown as {
    readBody: typeof readBody;
  }
).readBody = (async () => requestBody) as typeof readBody;
(
  globalThis as unknown as {
    getGitHubClient: typeof getGitHubClient;
  }
).getGitHubClient = (async () => ({
  graphql: (query: string, variables: Record<string, unknown>) => graphQLRequest(query, variables),
})) as unknown as typeof getGitHubClient;

mock.module('#server/utils/notification-subject-state-validation-utils', () => validationUtils);
mock.module('#server/utils/github-auth-utils', () => ({
  throwGitHubRouteError: (error: unknown) => {
    routedError = error;
    throw new Error('Notification Subject Enrichment route failed');
  },
}));

const handler = (await import('../server/api/notifications/subject-states.post')).default as (
  event: unknown
) => Promise<{ items: Array<Record<string, unknown>> }>;

const targets = [
  {
    key: 'acme/widgets/issues/1',
    owner: 'acme',
    repo: 'widgets',
    type: 'issues',
    number: 1,
  },
  {
    key: 'acme/widgets/pulls/2',
    owner: 'acme',
    repo: 'widgets',
    type: 'pulls',
    number: 2,
  },
  {
    key: 'acme/widgets/discussions/3',
    owner: 'acme',
    repo: 'widgets',
    type: 'discussions',
    number: 3,
  },
  {
    key: 'acme/widgets/issues/4',
    owner: 'acme',
    repo: 'widgets',
    type: 'issues',
    number: 4,
  },
] as const;

describe('Notification Subject Enrichment server endpoint', () => {
  test('returns an empty result without calling GitHub for an empty target list', async () => {
    requestBody = { targets: [] };
    let called = false;
    graphQLRequest = async () => {
      called = true;
      return {};
    };

    expect(await handler({})).toEqual({ items: [] });
    expect(called).toBe(false);
  });

  test('normalizes issues, pull requests, discussions, and inaccessible subjects', async () => {
    requestBody = { targets };
    graphQLRequest = async (query, variables) => {
      expect(query).toContain('issue(number: $number0)');
      expect(query).toContain('pullRequest(number: $number1)');
      expect(query).toContain('discussion(number: $number2)');
      expect(variables).toMatchObject({
        owner0: 'acme',
        repo0: 'widgets',
        number0: 1,
        number3: 4,
      });

      return {
        subject0: {
          issue: {
            title: 'Issue title',
            updatedAt: '2026-08-12T01:00:00.000Z',
            state: 'CLOSED',
            issueType: { name: 'Bug', color: 'FF0000' },
            labels: { nodes: [{ name: 'priority', color: '00AA00' }, { name: 'invalid' }] },
            comments: { totalCount: 4 },
            author: { login: 'issue-author', avatarUrl: 'https://avatars.example/issue' },
          },
        },
        subject1: {
          pullRequest: {
            title: 'Pull title',
            updatedAt: '2026-08-12T02:00:00.000Z',
            state: 'CLOSED',
            mergedAt: '2026-08-12T02:00:00.000Z',
            isDraft: true,
            comments: { totalCount: 6 },
            author: { login: 'pull-author', avatarUrl: 'https://avatars.example/pull' },
          },
        },
        subject2: {
          discussion: {
            title: 'Discussion title',
            updatedAt: '2026-08-12T03:00:00.000Z',
            isAnswered: false,
            author: {
              login: 'discussion-author',
              avatarUrl: 'https://avatars.example/discussion',
            },
          },
        },
        subject3: null,
      };
    };

    const response = await handler({});

    expect(response.items[0]).toEqual({
      key: 'acme/widgets/issues/1',
      title: 'Issue title',
      updatedAt: '2026-08-12T01:00:00.000Z',
      state: 'closed',
      draft: undefined,
      isAnswered: undefined,
      issueType: { name: 'Bug', color: 'ff0000' },
      labels: [{ name: 'priority', color: '00AA00' }],
      comments: 4,
      authorLogin: 'issue-author',
      authorAvatarUrl: 'https://avatars.example/issue',
    });
    expect(response.items[1]).toMatchObject({
      key: 'acme/widgets/pulls/2',
      state: 'merged',
      draft: true,
      comments: 6,
    });
    expect(response.items[2]).toMatchObject({
      key: 'acme/widgets/discussions/3',
      title: 'Discussion title',
      isAnswered: false,
      authorLogin: 'discussion-author',
    });
    expect(response.items[3]).toEqual({
      key: 'acme/widgets/issues/4',
      title: undefined,
      updatedAt: undefined,
      state: undefined,
      draft: undefined,
      isAnswered: undefined,
      issueType: undefined,
      labels: undefined,
      comments: undefined,
      authorLogin: undefined,
      authorAvatarUrl: undefined,
    });
  });

  test('routes GitHub failures through the endpoint error policy', async () => {
    requestBody = { targets: [targets[0]] };
    const githubError = new Error('GraphQL failed');
    graphQLRequest = async () => {
      throw githubError;
    };
    routedError = null;
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      await expect(handler({})).rejects.toThrow('Notification Subject Enrichment route failed');
      expect(routedError).toBe(githubError);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
