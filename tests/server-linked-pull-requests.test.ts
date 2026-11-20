import { describe, expect, mock, test } from 'bun:test';

import * as githubGraphqlUtils from '../server/utils/github-graphql-utils';
import * as repoRouteUtils from '../server/utils/repo-route-utils';
import * as linkedPullRequestTypes from '../shared/types/linked-pull-requests';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#server/utils/github-graphql-utils', () => githubGraphqlUtils);
mock.module('#shared/types/linked-pull-requests', () => linkedPullRequestTypes);
mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

const linkedPullRequestGraphql = await import('../server/utils/linked-pull-request-graphql-utils');
mock.module('#server/utils/linked-pull-request-graphql-utils', () => linkedPullRequestGraphql);

let graphQLRequest: (query: string, variables: Record<string, unknown>) => Promise<unknown>;
let requestQuery: Record<string, unknown> = {};

(
  globalThis as unknown as {
    definePrivateApiCoalescedEventHandler: typeof definePrivateApiCoalescedEventHandler;
  }
).definePrivateApiCoalescedEventHandler = ((handler: unknown) =>
  handler) as typeof definePrivateApiCoalescedEventHandler;

(globalThis as unknown as { getQuery: (event: unknown) => Record<string, unknown> }).getQuery =
  () => requestQuery;

mock.module('#server/utils/repo-route-utils', () => ({
  ...repoRouteUtils,
  extractIssueRouteParams: () => ({ owner: 'acme', repo: 'widgets', issueNumber: 7 }),
  executeGitHubRequest: async (
    _event: unknown,
    requestFn: (octokit: { graphql: typeof graphQLRequest }) => Promise<unknown>
  ) => requestFn({ graphql: graphQLRequest }),
}));

interface LinkedPullRequestsResponse {
  owner: string;
  repo: string;
  number: number;
  totalCount: number;
  nodes: unknown[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const handler = (
  await import('../server/api/issues/[owner]/[repo]/[issue_number]/linked-pull-requests.get')
).default as (event: unknown) => Promise<LinkedPullRequestsResponse>;

const connectionPage = (pageInfo: { hasNextPage: boolean; endCursor: string | null } | null) => ({
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        totalCount: 25,
        pageInfo,
        nodes: [
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
});

describe('Linked Pull Request API', () => {
  test('returns connection JSON that the list model can group', async () => {
    requestQuery = {};
    graphQLRequest = async (query, variables) => {
      expect(query).toContain(
        'closedByPullRequestsReferences(first: 20, includeClosedPrs: true, after: $after)'
      );
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
      pageInfo: { hasNextPage: false, endCursor: null },
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
    requestQuery = {};
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
      pageInfo: { hasNextPage: false, endCursor: null },
    });
  });

  test('asks GitHub for the cursor page the reader requested and returns its cursor', async () => {
    requestQuery = { after: 'CURSOR-1' };
    graphQLRequest = async (query, variables) => {
      expect(query).toContain('after: $after');
      expect(variables).toEqual({
        owner: 'acme',
        repo: 'widgets',
        number: 7,
        after: 'CURSOR-1',
      });
      return connectionPage({ hasNextPage: true, endCursor: 'CURSOR-2' });
    };

    expect((await handler({})).pageInfo).toEqual({
      hasNextPage: true,
      endCursor: 'CURSOR-2',
    });
  });

  test('reports no further page when GitHub returns none', async () => {
    requestQuery = {};
    graphQLRequest = async () => connectionPage(null);

    expect((await handler({})).pageInfo).toEqual({
      hasNextPage: false,
      endCursor: null,
    });
  });

  test('drops a blank cursor instead of asking GitHub for page after an empty string', async () => {
    requestQuery = { after: '' };
    graphQLRequest = async (_query, variables) => {
      expect(variables).toEqual({ owner: 'acme', repo: 'widgets', number: 7 });
      return connectionPage(null);
    };

    expect((await handler({})).pageInfo).toEqual({
      hasNextPage: false,
      endCursor: null,
    });
  });
});
