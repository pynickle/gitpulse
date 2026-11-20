import { beforeEach, expect, mock, test } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getQuery,
  toWebHandler,
} from 'h3';

Object.assign(globalThis, {
  createError,
  getQuery,
  definePrivateApiCoalescedEventHandler: defineEventHandler,
  parsePaginationNumber: (value: unknown, fallback: number) => Number(value) || fallback,
});

let restResponses: Record<string, unknown> = {};
const graphqlCalls: Array<{ query: string; variables: Record<string, unknown> }> = [];
let graphqlResponse: (query: string) => unknown = () => ({});
const github = {
  request: async (route: string) => ({
    status: 200,
    data: restResponses[route] ?? [],
    headers: {},
  }),
  graphql: async (query: string, variables: Record<string, unknown>) => {
    graphqlCalls.push({ query, variables });
    return graphqlResponse(query);
  },
};
const auth = await import('../server/utils/github-auth-utils');
const githubAdapter = {
  ...auth,
  getGitHubSessionContext: async () => ({
    accessTokenCacheKey: 'test',
    octokit: github,
    userLogin: 'octocat',
  }),
};
Object.assign(globalThis, { getGitHubClient: async () => github });
mock.module('#server/utils/github-auth-utils', () => githubAdapter);
mock.module('#server/utils/github-reaction-utils', () => ({
  fetchIssueReactionSummary: async () => ({ items: [] }),
}));
mock.module('#shared/utils/reactions', () => import('../shared/utils/reactions'));
mock.module(
  '#server/utils/github-graphql-utils',
  () => import('../server/utils/github-graphql-utils')
);
mock.module('#shared/utils/copilot-review', () => import('../shared/utils/copilot-review'));
mock.module('#shared/types/comment-moderation', () => import('../shared/types/comment-moderation'));
mock.module(
  '#server/utils/comment-moderation-utils',
  () => import('../server/utils/comment-moderation-utils')
);
mock.module(
  '#server/utils/github-timeline-utils',
  () => import('../server/utils/github-timeline-utils')
);
mock.module(
  '#server/utils/issue-duplicate-target-utils',
  () => import('../server/utils/issue-duplicate-target-utils')
);
mock.module('#shared/utils/sub-issues', () => import('../shared/utils/sub-issues'));
mock.module(
  '#server/utils/sub-issue-graphql-utils',
  () => import('../server/utils/sub-issue-graphql-utils')
);

const detail = (await import('../server/api/issues/[owner]/[repo]/[issue_number].get')).default;
const timeline = (await import('../server/api/issues/[owner]/[repo]/[issue_number]/timeline.get'))
  .default;
const fetchApi = toWebHandler(
  createApp().use(
    createRouter()
      .get('/api/issues/:owner/:repo/:issue_number', detail)
      .get('/api/issues/:owner/:repo/:issue_number/timeline', timeline).handler
  )
);
const getJson = async (path: string) => {
  const response = await fetchApi(new Request(`https://gitpulse.test${path}`));
  return { status: response.status, body: await response.json() };
};

const canonical = {
  number: 42,
  title: 'Original report',
  url: 'https://github.com/other/lib/issues/42',
  state: 'OPEN',
  repository: { name: 'lib', owner: { login: 'other' } },
};

const duplicateTarget = {
  resourceType: 'issue',
  number: 42,
  title: 'Original report',
  url: 'https://github.com/other/lib/issues/42',
  state: 'open',
  repository: { name: 'lib', nameWithOwner: 'other/lib', owner: { login: 'other' } },
};

beforeEach(() => {
  restResponses = {};
  graphqlCalls.length = 0;
  graphqlResponse = () => ({});
});

test('a closed duplicate Issue detail names its Duplicate Target', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': {
      number: 7,
      state: 'closed',
      state_reason: 'duplicate',
    },
  };
  graphqlResponse = () => ({ repository: { issue: { duplicateOf: canonical } } });

  const { status, body } = await getJson('/api/issues/acme/widgets/7');

  expect(status).toBe(200);
  expect(body.duplicate_of).toEqual(duplicateTarget);
  expect(graphqlCalls.map((call) => call.variables)).toEqual([
    { owner: 'acme', repo: 'widgets', number: 7 },
  ]);
});

test('an Issue closed for another reason asks GitHub for no Duplicate Target', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': {
      number: 7,
      state: 'closed',
      state_reason: 'not_planned',
    },
  };

  const { body } = await getJson('/api/issues/acme/widgets/7');

  expect(body.duplicate_of).toBeUndefined();
  expect(graphqlCalls).toEqual([]);
});

test('Issue detail returns its parent reference and the REST sub-issue counts', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}': {
      number: 7,
      state: 'open',
      parent_issue_url: 'https://api.github.com/repos/other/lib/issues/42',
      sub_issues_summary: { completed: 1, total: 3, percent_completed: 33 },
    },
  };
  graphqlResponse = () => ({ repository: { issue: { parent: canonical } } });

  const { status, body } = await getJson('/api/issues/acme/widgets/7');

  expect(status).toBe(200);
  expect(body.parent_issue).toEqual(duplicateTarget);
  expect(body.sub_issues_summary).toMatchObject({ completed: 1, total: 3 });
});

test('a duplicate close event in the timeline links to its cross-repository target', async () => {
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline': [
      {
        id: 31,
        node_id: 'CE_31',
        event: 'closed',
        state_reason: 'duplicate',
        created_at: '2026-11-12T19:42:39Z',
        actor: { login: 'maintainer' },
      },
      {
        id: 30,
        node_id: 'CE_30',
        event: 'closed',
        state_reason: 'completed',
        created_at: '2026-11-01T10:00:00Z',
        actor: { login: 'maintainer' },
      },
    ],
  };
  graphqlResponse = (query) =>
    query.includes('duplicateOf') ? { nodes: [{ id: 'CE_31', duplicateOf: canonical }] } : {};

  const { status, body } = await getJson('/api/issues/acme/widgets/7/timeline');

  expect(status).toBe(200);
  const closed = body.timeline.filter(
    (item: { eventType?: string }) => item.eventType === 'closed'
  );
  expect(closed).toEqual([
    expect.objectContaining({ id: '30', stateReason: 'completed' }),
    expect.objectContaining({ id: '31', stateReason: 'duplicate', duplicate: duplicateTarget }),
  ]);
  expect(closed[0].duplicate).toBeUndefined();
  expect(graphqlCalls.map((call) => call.variables)).toEqual([{ ids: ['CE_31'] }]);
});
