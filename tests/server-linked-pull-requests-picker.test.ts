import { describe, expect, mock, test } from 'bun:test';

import * as linkedPullRequestTypes from '../shared/types/linked-pull-requests';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#shared/types/linked-pull-requests', () => linkedPullRequestTypes);
mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

const linkedPullRequestGraphql = await import('../server/utils/linked-pull-request-graphql-utils');
mock.module('#server/utils/linked-pull-request-graphql-utils', () => linkedPullRequestGraphql);

let graphQLRequest: (query: string, variables: Record<string, unknown>) => Promise<unknown>;

(
  globalThis as unknown as {
    definePrivateApiCoalescedEventHandler: typeof definePrivateApiCoalescedEventHandler;
  }
).definePrivateApiCoalescedEventHandler = ((handler: unknown) =>
  handler) as typeof definePrivateApiCoalescedEventHandler;

mock.module('#server/utils/repo-route-utils', () => ({
  extractIssueRouteParams: () => ({ owner: 'acme', repo: 'widgets', issueNumber: 7 }),
  executeGitHubRequest: async (
    _event: unknown,
    requestFn: (octokit: { graphql: typeof graphQLRequest }) => Promise<unknown>
  ) => requestFn({ graphql: graphQLRequest }),
}));

const handler = (
  await import('../server/api/issues/[owner]/[repo]/[issue_number]/linked-pull-requests.get')
).default as (event: unknown) => Promise<{
  owner: string;
  repo: string;
  number: number;
  totalCount: number;
  nodes: unknown[];
}>;

describe('Linked Pull Request Picker API', () => {
  test('returns connection JSON that the list model can group', async () => {
    graphQLRequest = async (query, variables) => {
      expect(query).toContain('closedByPullRequestsReferences(first: 20, includeClosedPrs: true)');
      expect(variables).toEqual({ owner: 'acme', repo: 'widgets', number: 7 });
      return {
        repository: {
          issue: {
            closedByPullRequestsReferences: {
              totalCount: 2,
              nodes: [
                {
                  number: 4,
                  title: 'Foreign',
                  updatedAt: '2026-08-01T00:00:00.000Z',
                  state: 'OPEN',
                  author: { login: 'hubot' },
                  repository: { name: 'lib', owner: { login: 'foreign' } },
                },
                {
                  number: 5,
                  title: 'Local',
                  updatedAt: '2026-08-02T00:00:00.000Z',
                  state: 'CLOSED',
                  mergedAt: '2026-08-03T00:00:00.000Z',
                  author: { login: 'octocat' },
                  repository: { name: 'widgets', owner: { login: 'acme' } },
                },
              ],
            },
          },
        },
      };
    };

    const response = await handler({});
    expect(response).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 7,
      totalCount: 2,
      nodes: [
        {
          owner: 'foreign',
          repo: 'lib',
          number: 4,
          title: 'Foreign',
          authorLogin: 'hubot',
          updatedAt: '2026-08-01T00:00:00.000Z',
          state: 'open',
        },
        {
          owner: 'acme',
          repo: 'widgets',
          number: 5,
          title: 'Local',
          authorLogin: 'octocat',
          updatedAt: '2026-08-02T00:00:00.000Z',
          state: 'merged',
        },
      ],
    });

    expect(
      linkedPullRequests
        .toLinkedPullRequestPickerModel(
          { totalCount: response.totalCount, nodes: response.nodes as never },
          { owner: response.owner, repo: response.repo }
        )
        .groups.map((group) => group.kind)
    ).toEqual(['same-repository', 'other-repositories']);
  });

  test('represents an empty Linked Pull Request list without auto-closing', async () => {
    graphQLRequest = async () => ({
      repository: {
        issue: {
          closedByPullRequestsReferences: { totalCount: 0, nodes: [] },
        },
      },
    });

    expect(await handler({})).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 7,
      totalCount: 0,
      nodes: [],
    });
  });
});
