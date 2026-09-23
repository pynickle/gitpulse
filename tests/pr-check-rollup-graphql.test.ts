import { describe, expect, mock, test } from 'bun:test';

import * as githubGraphqlUtils from '../server/utils/github-graphql-utils';
import * as prChecks from '../shared/utils/pr-checks';

mock.module('#server/utils/github-graphql-utils', () => githubGraphqlUtils);
mock.module('#shared/utils/pr-checks', () => prChecks);

const {
  PULL_REQUEST_CHECK_ROLLUP_QUERY,
  PR_CHECK_ROLLUP_NODE_FIELDS,
  attachPullRequestCheckRollups,
  fetchPullRequestCheckRollup,
  mapPullRequestCheckRollup,
} = await import('../server/utils/pr-check-rollup-graphql-utils');

describe('Check Rollup GraphQL mapping', () => {
  test('maps a CheckRun rollup into the near-raw rollup shape', () => {
    expect(
      mapPullRequestCheckRollup({
        state: 'FAILURE',
        contexts: {
          totalCount: 2,
          nodes: [
            {
              __typename: 'CheckRun',
              name: 'build',
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
              detailsUrl: 'https://github.com/acme/widgets/runs/1',
              checkSuite: { app: { name: 'GitHub Actions' } },
            },
            {
              __typename: 'CheckRun',
              name: 'test',
              status: 'IN_PROGRESS',
              conclusion: null,
              checkSuite: { app: { name: 'GitHub Actions' } },
            },
          ],
        },
      })
    ).toEqual({
      state: 'FAILURE',
      contexts: {
        totalCount: 2,
        nodes: [
          {
            __typename: 'CheckRun',
            name: 'build',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            detailsUrl: 'https://github.com/acme/widgets/runs/1',
            checkSuite: { app: { name: 'GitHub Actions' } },
            creator: null,
          },
          {
            __typename: 'CheckRun',
            name: 'test',
            status: 'IN_PROGRESS',
            conclusion: null,
            detailsUrl: null,
            checkSuite: { app: { name: 'GitHub Actions' } },
            creator: null,
          },
        ],
      },
    });
  });

  test('maps a legacy StatusContext onto the same context shape', () => {
    // GitHub reports a StatusContext's outcome on `state`, its name on `context`,
    // and its link on `targetUrl`; the rollup shape carries one field each.
    const rollup = mapPullRequestCheckRollup({
      state: 'SUCCESS',
      contexts: {
        totalCount: 1,
        nodes: [
          {
            __typename: 'StatusContext',
            context: 'legacy/ci',
            state: 'SUCCESS',
            targetUrl: 'https://ci.example/legacy',
            creator: { login: 'old-bot' },
          },
        ],
      },
    });

    expect(rollup.contexts?.nodes).toEqual([
      {
        __typename: 'StatusContext',
        name: 'legacy/ci',
        conclusion: 'SUCCESS',
        status: null,
        detailsUrl: 'https://ci.example/legacy',
        checkSuite: null,
        creator: { login: 'old-bot' },
      },
    ]);
  });

  test('returns null for a rollup GitHub did not report', () => {
    expect(mapPullRequestCheckRollup(null)).toBeNull();
    expect(mapPullRequestCheckRollup(undefined)).toBeNull();
    expect(mapPullRequestCheckRollup({ contexts: null })).toBeNull();
  });

  test('keeps a truncated rollup total so the chip can hide the passed fraction', () => {
    const rollup = mapPullRequestCheckRollup({
      state: 'SUCCESS',
      contexts: { totalCount: 148, nodes: [{ __typename: 'CheckRun', name: 'build' }] },
    });

    expect(rollup?.contexts?.totalCount).toBe(148);
    expect(rollup?.contexts?.nodes).toHaveLength(1);
  });

  test('asks for the rollup contexts capped at 100 and never for isRequired', () => {
    // `CheckRun.isRequired` cannot be requested inside a rollup query: GitHub
    // answers UNPROCESSABLE and blanks every CheckRun node.
    expect(PR_CHECK_ROLLUP_NODE_FIELDS).toContain('statusCheckRollup');
    expect(PR_CHECK_ROLLUP_NODE_FIELDS).toContain('contexts(first: 100)');
    expect(PR_CHECK_ROLLUP_NODE_FIELDS).not.toContain('isRequired');
    expect(PULL_REQUEST_CHECK_ROLLUP_QUERY).toContain('node(id: $id)');
  });
});

describe('attach Check Rollups to Search items', () => {
  const pullItem = (id: number, number: number, repository = 'acme/widgets') => ({
    id,
    number,
    title: `Pull ${number}`,
    repository_url: `https://api.github.com/repos/${repository}`,
    pull_request: { url: `https://api.github.com/repos/${repository}/pulls/${number}` },
  });

  test('attaches the rollup only to pull request items', async () => {
    const items = [
      pullItem(1, 10),
      {
        id: 2,
        number: 11,
        title: 'Issue',
        repository_url: 'https://api.github.com/repos/acme/widgets',
      },
      pullItem(3, 12),
    ];

    const octokit = {
      graphql: async (query: string, variables: Record<string, unknown>) => {
        expect(query).toContain('statusCheckRollup');
        expect(query).not.toContain('closedByPullRequestsReferences');
        expect(variables).toMatchObject({
          owner0: 'acme',
          repo0: 'widgets',
          number0: 10,
          number1: 12,
        });

        return {
          subject0: {
            pullRequest: {
              statusCheckRollup: {
                state: 'SUCCESS',
                contexts: { totalCount: 2, nodes: [{ __typename: 'CheckRun', name: 'build' }] },
              },
            },
          },
          subject1: null,
        };
      },
    };

    const next = await attachPullRequestCheckRollups(octokit, items);

    expect(next[0]).toMatchObject({
      id: 1,
      checkRollup: {
        state: 'SUCCESS',
        contexts: { totalCount: 2, nodes: [{ __typename: 'CheckRun', name: 'build' }] },
      },
    });
    expect(next[1]).toEqual(items[1]);
    expect(next[1]).not.toHaveProperty('checkRollup');
    expect(next[2]).not.toHaveProperty('checkRollup');
  });

  test('chunks targets at 50 per aliased query', async () => {
    const items = Array.from({ length: 120 }, (_, index) => pullItem(index + 1, index + 1));
    const chunkSizes: number[] = [];

    const octokit = {
      graphql: async (_query: string, variables: Record<string, unknown>) => {
        chunkSizes.push(Object.keys(variables).filter((key) => key.startsWith('number')).length);
        return {};
      },
    };

    await attachPullRequestCheckRollups(octokit, items);

    expect(chunkSizes).toEqual([50, 50, 20]);
  });

  test('keeps the rollup from a partially failed GraphQL response', async () => {
    const items = [pullItem(1, 10)];
    const rollup = { state: 'FAILURE', contexts: { totalCount: 1, nodes: [] } };

    const octokit = {
      graphql: async () => {
        const error = new Error('GraphQL partial') as Error & { data: unknown };
        error.data = { subject0: { pullRequest: { statusCheckRollup: rollup } } };
        throw error;
      },
    };

    const next = await attachPullRequestCheckRollups(octokit, items);
    expect(next[0]).toMatchObject({ checkRollup: rollup });
  });

  test('leaves Search items unchanged when the rollup pass fails', async () => {
    const items = [pullItem(1, 10)];

    const octokit = {
      graphql: async () => {
        throw new Error('GraphQL 502');
      },
    };

    expect(await attachPullRequestCheckRollups(octokit, items)).toEqual(items);
  });

  test('skips the GraphQL pass when no item is a pull request', async () => {
    const items = [
      { id: 1, number: 2, repository_url: 'https://api.github.com/repos/acme/widgets' },
    ];
    let called = false;

    const octokit = {
      graphql: async () => {
        called = true;
        return {};
      },
    };

    expect(await attachPullRequestCheckRollups(octokit, items)).toEqual(items);
    expect(called).toBe(false);
  });

  test('skips items without a resolvable repository or number', async () => {
    const items = [
      { id: 1, pull_request: {} },
      { id: 2, number: 'nope', repository_url: 'https://api.github.com/repos/acme/widgets' },
      { id: 3, number: 3, repository_url: 'not-a-repo-url', pull_request: {} },
      {
        id: 4,
        number: 4,
        repository_url: 'https://api.github.com/repos/acme/widgets',
        pull_request: {},
      },
    ];
    let variables: Record<string, unknown> = {};

    const octokit = {
      graphql: async (_query: string, passed: Record<string, unknown>) => {
        variables = passed;
        return {};
      },
    };

    await attachPullRequestCheckRollups(octokit, items);

    expect(Object.keys(variables)).toEqual(['owner0', 'repo0', 'number0']);
    expect(variables).toMatchObject({ owner0: 'acme', repo0: 'widgets', number0: 4 });
  });
});

describe('fetch one pull request Check Rollup', () => {
  test('resolves the rollup behind the pull request node id', async () => {
    const rollup = { state: 'SUCCESS', contexts: { totalCount: 1, nodes: [] } };
    let id: unknown;
    const octokit = {
      graphql: async (_query: string, variables: Record<string, unknown>) => {
        id = variables.id;
        return { node: { statusCheckRollup: rollup } };
      },
    };

    expect(await fetchPullRequestCheckRollup(octokit, 'PR_abc')).toEqual(rollup);
    expect(id).toBe('PR_abc');
  });

  test('returns null without calling GitHub when there is no node id', async () => {
    let called = false;
    const octokit = {
      graphql: async () => {
        called = true;
        return {};
      },
    };

    expect(await fetchPullRequestCheckRollup(octokit, null)).toBeNull();
    expect(called).toBe(false);
  });

  test('keeps the rollup from a partially failed GraphQL response', async () => {
    const rollup = { state: 'FAILURE', contexts: { totalCount: 2, nodes: [] } };
    const octokit = {
      graphql: async () => {
        const error = new Error('GraphQL partial') as Error & { data: unknown };
        error.data = { node: { statusCheckRollup: rollup } };
        throw error;
      },
    };

    expect(await fetchPullRequestCheckRollup(octokit, 'PR_abc')).toEqual(rollup);
  });

  test('degrades to null so a rollup error never breaks the PR detail surface', async () => {
    const octokit = {
      graphql: async () => {
        throw new Error('GraphQL 500');
      },
    };
    const originalConsoleWarn = console.warn;
    console.warn = () => {};

    try {
      expect(await fetchPullRequestCheckRollup(octokit, 'PR_abc')).toBeNull();
    } finally {
      console.warn = originalConsoleWarn;
    }
  });
});
