import { beforeEach, expect, mock, test } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  readBody,
  toWebHandler,
} from 'h3';

Object.assign(globalThis, { createError, defineEventHandler, readBody });

interface RestCall {
  route: string;
  parameters: Record<string, unknown>;
}

interface GraphqlCall {
  query: string;
  variables: Record<string, unknown>;
}

const restCalls: RestCall[] = [];
const graphqlCalls: GraphqlCall[] = [];
let restResponses: Record<string, unknown> = {};
let graphqlResponse: Record<string, unknown> = {};

const github = {
  request: async (route: string, parameters: Record<string, unknown>) => {
    restCalls.push({ route, parameters });
    const data = restResponses[route];
    if (data instanceof Error) throw data;
    return { status: 200, data, headers: {} };
  },
  graphql: async (query: string, variables: Record<string, unknown>) => {
    graphqlCalls.push({ query, variables });
    return graphqlResponse;
  },
};

const auth = await import('../server/utils/github-auth-utils');
const githubAdapter = { ...auth, getGitHubClient: async () => github };
mock.module('#server/utils/github-auth-utils', () => githubAdapter);
mock.module('../server/utils/github-auth-utils', () => githubAdapter);
mock.module('#server/utils/repo-route-utils', () => import('../server/utils/repo-route-utils'));
mock.module('#server/utils/pr-archive-utils', () => import('../server/utils/pr-archive-utils'));

const handler = (await import('../server/api/pulls/[owner]/[repo]/[pull_number]/archive.post'))
  .default;
const router = createRouter().post('/api/pulls/:owner/:repo/:pull_number/archive', handler);
const fetchApi = toWebHandler(createApp().use(router.handler));

const postArchive = (body: unknown) =>
  fetchApi(
    new Request('https://gitpulse.test/api/pulls/acme/widgets/7/archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  restCalls.length = 0;
  graphqlCalls.length = 0;
  restResponses = {
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': { number: 7, node_id: 'PR_node_7' },
  };
  graphqlResponse = {};
});

test('archives through the GraphQL mutation and reports the new state', async () => {
  graphqlResponse = { archivePullRequest: { pullRequest: { number: 7 } } };

  const response = await postArchive({ action: 'archive' });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ archived: true });
  expect(graphqlCalls).toHaveLength(1);
  expect(graphqlCalls[0]!.query).toContain('archivePullRequest');
  expect(graphqlCalls[0]!.variables).toEqual({ input: { pullRequestId: 'PR_node_7' } });
});

test('unarchives through the matching mutation, which leaves the pull request closed', async () => {
  graphqlResponse = { unarchivePullRequest: { pullRequest: { number: 7 } } };

  const response = await postArchive({ action: 'unarchive' });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ archived: false });
  expect(graphqlCalls).toHaveLength(1);
  expect(graphqlCalls[0]!.query).toContain('unarchivePullRequest');
  expect(graphqlCalls[0]!.query).toContain('mutation UnarchivePullRequest');
});

test('rejects a missing or unknown action without touching GitHub', async () => {
  for (const body of [{}, { action: 'delete' }, null]) {
    const response = await postArchive(body);
    expect(response.status).toBe(400);
  }

  expect(restCalls).toEqual([]);
  expect(graphqlCalls).toEqual([]);
});

test('fails without a node id instead of sending a mutation GitHub cannot resolve', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': { number: 7, node_id: null },
  };

  const response = await postArchive({ action: 'archive' });

  expect(response.status).toBe(502);
  expect(graphqlCalls).toEqual([]);
});

test('surfaces a GitHub refusal to archive, such as an archived repository', async () => {
  github.graphql = async (query: string, variables: Record<string, unknown>) => {
    graphqlCalls.push({ query, variables });
    throw Object.assign(new Error('Repository was archived so is read-only'), {
      status: 403,
      errors: [{ type: 'FORBIDDEN', message: 'Repository was archived so is read-only' }],
    });
  };

  try {
    const response = await postArchive({ action: 'archive' });
    expect(response.status).toBe(403);
  } finally {
    github.graphql = async (query: string, variables: Record<string, unknown>) => {
      graphqlCalls.push({ query, variables });
      return graphqlResponse;
    };
  }
});
