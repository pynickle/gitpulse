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

const restCalls: RestCall[] = [];
let restResponses: Record<string, unknown> = {};
const github = {
  request: async (route: string, parameters: Record<string, unknown>) => {
    restCalls.push({ route, parameters });
    const data = restResponses[route];
    if (data instanceof Error) throw data;
    return { status: 200, data, headers: {} };
  },
};

const auth = await import('../server/utils/github-auth-utils');
const githubAdapter = { ...auth, getGitHubClient: async () => github };
mock.module('#server/utils/github-auth-utils', () => githubAdapter);
mock.module('../server/utils/github-auth-utils', () => githubAdapter);
mock.module('#server/utils/repo-route-utils', () => import('../server/utils/repo-route-utils'));
mock.module(
  '#server/utils/zod-validation-utils',
  () => import('../server/utils/zod-validation-utils')
);
mock.module(
  '#server/utils/repo-request-validation-utils',
  () => import('../server/utils/repo-request-validation-utils')
);

const handler = (
  await import('../server/api/repos/[owner]/[repo]/issues/[issue_number]/state.patch')
).default;
const router = createRouter().patch('/api/repos/:owner/:repo/issues/:issue_number/state', handler);
const fetchApi = toWebHandler(createApp().use(router.handler));

const patchState = (body: unknown) =>
  fetchApi(
    new Request('https://gitpulse.test/api/repos/acme/widgets/issues/7/state', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const updatedIssue = (state: string, stateReason: string | null) => ({
  state,
  state_reason: stateReason,
  closed_at: state === 'closed' ? '2026-11-20T10:00:00Z' : null,
});

const target = {
  id: 9001,
  number: 42,
  title: 'Original report',
  html_url: 'https://github.com/other/lib/issues/42',
  state: 'closed',
};

beforeEach(() => {
  restCalls.length = 0;
  restResponses = {};
});

test('closes as Completed or Not planned with the native close reason', async () => {
  for (const reason of ['completed', 'not_planned']) {
    restCalls.length = 0;
    restResponses = {
      'PATCH /repos/{owner}/{repo}/issues/{issue_number}': updatedIssue('closed', reason),
    };

    const response = await patchState({ state: 'closed', state_reason: reason });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: 'closed',
      stateReason: reason,
      closedAt: '2026-11-20T10:00:00Z',
      duplicateOf: null,
    });
    expect(restCalls).toEqual([
      {
        route: 'PATCH /repos/{owner}/{repo}/issues/{issue_number}',
        parameters: {
          owner: 'acme',
          repo: 'widgets',
          issue_number: 7,
          state: 'closed',
          state_reason: reason,
        },
      },
    ]);
  }
});

test('closes as Duplicate by resolving the Duplicate Target to its GitHub issue ID', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': target,
    'PATCH /repos/{owner}/{repo}/issues/{issue_number}': updatedIssue('closed', 'duplicate'),
  };

  const response = await patchState({
    state: 'closed',
    state_reason: 'duplicate',
    duplicate_of: { owner: 'other', repo: 'lib', number: 42 },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    state: 'closed',
    stateReason: 'duplicate',
    closedAt: '2026-11-20T10:00:00Z',
    duplicateOf: {
      resourceType: 'issue',
      number: 42,
      title: 'Original report',
      url: 'https://github.com/other/lib/issues/42',
      state: 'closed',
      repository: { name: 'lib', nameWithOwner: 'other/lib', owner: { login: 'other' } },
    },
  });
  expect(restCalls).toEqual([
    {
      route: 'GET /repos/{owner}/{repo}/issues/{issue_number}',
      parameters: { owner: 'other', repo: 'lib', issue_number: 42 },
    },
    {
      route: 'PATCH /repos/{owner}/{repo}/issues/{issue_number}',
      parameters: {
        owner: 'acme',
        repo: 'widgets',
        issue_number: 7,
        state: 'closed',
        state_reason: 'duplicate',
        duplicate_issue_id: 9001,
      },
    },
  ]);
});

test('rejects a missing, malformed, self-referencing, or Pull Request Duplicate Target', async () => {
  const rejected = [
    { state: 'closed', state_reason: 'duplicate' },
    { state: 'closed', state_reason: 'duplicate', duplicate_of: { owner: 'other', repo: 'lib' } },
    {
      state: 'closed',
      state_reason: 'duplicate',
      duplicate_of: { owner: 'ACME', repo: 'Widgets', number: 7 },
    },
  ];

  for (const body of rejected) {
    expect((await patchState(body)).status).toBe(400);
  }
  expect(restCalls).toEqual([]);

  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': {
      ...target,
      pull_request: { url: 'https://api.github.com/repos/other/lib/pulls/42' },
    },
  };
  const pullRequest = await patchState({
    state: 'closed',
    state_reason: 'duplicate',
    duplicate_of: { owner: 'other', repo: 'lib', number: 42 },
  });
  expect(pullRequest.status).toBe(400);
  expect(restCalls.map((call) => call.route)).toEqual([
    'GET /repos/{owner}/{repo}/issues/{issue_number}',
  ]);
});

test('reports an inaccessible Duplicate Target without changing the Issue', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': Object.assign(new Error('Not Found'), {
      status: 404,
    }),
  };

  const response = await patchState({
    state: 'closed',
    state_reason: 'duplicate',
    duplicate_of: { owner: 'other', repo: 'private', number: 3 },
  });

  expect(response.status).toBe(404);
  expect(restCalls.map((call) => call.route)).toEqual([
    'GET /repos/{owner}/{repo}/issues/{issue_number}',
  ]);
});

test('reopens without a close reason, even when one is supplied', async () => {
  restResponses = {
    'PATCH /repos/{owner}/{repo}/issues/{issue_number}': updatedIssue('open', 'reopened'),
  };

  const response = await patchState({
    state: 'open',
    state_reason: 'duplicate',
    duplicate_of: { owner: 'other', repo: 'lib', number: 42 },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    state: 'open',
    stateReason: 'reopened',
    closedAt: null,
    duplicateOf: null,
  });
  expect(restCalls).toEqual([
    {
      route: 'PATCH /repos/{owner}/{repo}/issues/{issue_number}',
      parameters: { owner: 'acme', repo: 'widgets', issue_number: 7, state: 'open' },
    },
  ]);
});
