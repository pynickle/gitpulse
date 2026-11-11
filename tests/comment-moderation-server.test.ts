import { beforeEach, expect, mock, test } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getQuery,
  readBody,
  toWebHandler,
} from 'h3';

Object.assign(globalThis, {
  createError,
  defineEventHandler,
  getQuery,
  readBody,
  definePrivateApiCoalescedEventHandler: defineEventHandler,
});

let node: Record<string, unknown> | null;
let calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
let denied = false;
let mutationResult: Record<string, unknown> | undefined;
let restData: unknown = [];
let restResponses: Record<string, unknown> = {};
let readGraphql: ((query: string, variables: Record<string, unknown>) => unknown) | undefined;
let signedIn = true;
Object.assign(globalThis, {
  getUserSession: async () => (signedIn ? { secure: { access_token: 'test-token' } } : {}),
});
const restCalls: Array<{ route: string; parameters: unknown }> = [];
const github = {
  request: async (route: string, parameters: unknown) => {
    restCalls.push({ route, parameters });
    return { status: 204, data: restResponses[route] ?? restData, headers: {} };
  },
  graphql: async (query: string, variables: Record<string, unknown>) => {
    calls.push({ query, variables });
    if (query.includes('mutation')) {
      if (denied) throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
      if (mutationResult) return mutationResult;
      node = {
        ...node,
        isMinimized: true,
        minimizedReason: 'off-topic',
        viewerCanUnminimize: true,
      };
      return { minimizeComment: { minimizedComment: node } };
    }
    return readGraphql ? readGraphql(query, variables) : { nodes: [node] };
  },
};
const auth = await import('../server/utils/github-auth-utils');
const githubAdapter = {
  ...auth,
  getGitHubClient: async (event: Parameters<typeof auth.getAccessToken>[0]) => {
    await auth.getAccessToken(event);
    return github;
  },
};
mock.module('#server/utils/github-auth-utils', () => githubAdapter);
mock.module('../server/utils/github-auth-utils', () => githubAdapter);
mock.module('#shared/types/comment-moderation', () => import('../shared/types/comment-moderation'));
mock.module(
  '#server/utils/comment-moderation-utils',
  () => import('../server/utils/comment-moderation-utils')
);
const mutation = (await import('../server/api/comments/moderation.post')).default;
const csrf = (await import('../server/middleware/csrf')).default;
const router = createRouter().post('/api/comments/moderation', mutation);
const fetchApi = toWebHandler(createApp().use(csrf).use(router.handler));
const submit = (body: unknown) =>
  fetchApi(
    new Request('https://gitpulse.test/api/comments/moderation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'gitpulse_csrf=csrf-test',
        'x-csrf-token': 'csrf-test',
      },
      body: JSON.stringify(body),
    })
  );
beforeEach(() => {
  calls = [];
  signedIn = true;
  restCalls.length = 0;
  denied = false;
  mutationResult = undefined;
  restData = [];
  restResponses = {};
  readGraphql = undefined;
  node = {
    __typename: 'IssueComment',
    id: 'IC_1',
    databaseId: 12,
    isMinimized: false,
    minimizedReason: null,
    viewerCanDelete: true,
    viewerCanMinimize: true,
    viewerCanUnminimize: false,
  };
});
test('session and CSRF guards reject mutations before any GitHub request', async () => {
  const noCsrf = await fetchApi(
    new Request('https://gitpulse.test/api/comments/moderation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId: 'IC_1', action: 'delete' }),
    })
  );
  expect(noCsrf.status).toBe(403);
  signedIn = false;
  expect((await submit({ nodeId: 'IC_1', action: 'delete' })).status).toBe(401);
  expect(calls).toHaveLength(0);
});
test('unhides directly using the upstream result', async () => {
  mutationResult = { unminimizeComment: { unminimizedComment: { ...node, isMinimized: false } } };
  const response = await submit({ nodeId: 'IC_1', action: 'unhide' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ moderation: { isMinimized: false } });
  expect(calls.at(-1)!.variables).toEqual({ subjectId: 'IC_1' });
  expect(calls.at(-1)!.query).toContain('unminimizeComment');
});
test('deletes CommitComment through commit REST endpoint using server-read repository and ID', async () => {
  node = {
    ...node,
    __typename: 'CommitComment',
    repository: { name: 'app', owner: { login: 'octo' } },
  };
  const response = await submit({ nodeId: 'IC_1', action: 'delete' });
  expect(response.status).toBe(200);
  expect(restCalls).toEqual([
    {
      route: 'DELETE /repos/{owner}/{repo}/comments/{comment_id}',
      parameters: { owner: 'octo', repo: 'app', comment_id: 12 },
    },
  ]);
  expect(calls.some((call) => call.query.includes('mutation'))).toBe(false);
});
test('a wiped Discussion parent is returned with actual body and discussion counts, preserving its replies', async () => {
  node = { ...node, __typename: 'DiscussionComment', discussion: { id: 'D_1' }, replyTo: null };
  mutationResult = {
    deleteDiscussionComment: {
      comment: { ...node, body: '', replies: { totalCount: 2 } },
    },
  };
  readGraphql = (query) =>
    query.includes('DiscussionAfterDeletion')
      ? {
          discussion: { id: 'D_1', isAnswered: false, answer: null, comments: { totalCount: 3 } },
          parent: null,
        }
      : { nodes: [node] };
  const response = await submit({ nodeId: 'IC_1', action: 'delete' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    deleted: false,
    body: '',
    moderation: { resourceType: 'DiscussionComment' },
    discussion: { id: 'D_1', answerId: null, isAnswered: false, totalCount: 3 },
  });
});

test('Discussion reply deletion returns the upstream parent reply count and answer state', async () => {
  node = {
    ...node,
    __typename: 'DiscussionComment',
    discussion: { id: 'D_1' },
    replyTo: { id: 'DC_parent' },
  };
  mutationResult = {
    deleteDiscussionComment: { comment: { ...node, replies: { totalCount: 0 } } },
  };
  readGraphql = (query) =>
    query.includes('DiscussionAfterDeletion')
      ? {
          discussion: {
            id: 'D_1',
            isAnswered: true,
            answer: { id: 'DC_answer' },
            comments: { totalCount: 3 },
          },
          parent: { id: 'DC_parent', replies: { totalCount: 1 } },
        }
      : { nodes: [node] };
  const response = await submit({ nodeId: 'IC_1', action: 'delete' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    deleted: true,
    moderation: null,
    discussion: {
      parentId: 'DC_parent',
      replyCount: 1,
      answerId: 'DC_answer',
      totalCount: 3,
    },
  });
  expect(calls.at(-1)!.variables).toEqual({ id: 'D_1', parentId: 'DC_parent' });
});
test('an absent mutation payload cannot be reported as success', async () => {
  mutationResult = {};
  expect((await submit({ nodeId: 'IC_1', action: 'delete' })).status).toBe(502);
});
test('reads node identity, hidden state and only explicit capabilities at the HTTP boundary', async () => {
  const handler = (await import('../server/api/comments/moderation.get')).default;
  const fetchRead = toWebHandler(createApp().use(handler));
  node = { ...node, isMinimized: true, minimizedReason: 'low-quality', viewerCanDelete: undefined };
  const response = await fetchRead(
    new Request('https://gitpulse.test/api/comments/moderation?nodeId=IC_1')
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    moderation: {
      nodeId: 'IC_1',
      resourceType: 'IssueComment',
      isMinimized: true,
      minimizedReason: 'low-quality',
      viewerCanDelete: false,
      viewerCanMinimize: true,
    },
  });
  expect(calls[0]!.variables).toEqual({ ids: ['IC_1'] });
});
test('issue timeline pagination preserves existing identity and enriches hidden comments from GitHub nodes', async () => {
  mock.module('#shared/utils/reactions', () => import('../shared/utils/reactions'));
  mock.module(
    '#server/utils/github-timeline-utils',
    () => import('../server/utils/github-timeline-utils')
  );
  Object.assign(globalThis, {
    getGitHubClient: async () => github,
    parsePaginationNumber: (value: unknown, fallback: number) => Number(value) || fallback,
  });
  const handler = (await import('../server/api/issues/[owner]/[repo]/[issue_number]/timeline.get'))
    .default;
  restData = [{ id: 12, node_id: 'IC_1', event: 'commented', body: 'Context' }];
  node = { ...node, isMinimized: true, minimizedReason: 'spam' };
  const fetchRead = toWebHandler(
    createApp().use(
      createRouter().get('/api/issues/:owner/:repo/:issue_number/timeline', handler).handler
    )
  );
  const response = await fetchRead(
    new Request('https://gitpulse.test/api/issues/octo/app/1/timeline?page=2')
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    timeline: [
      {
        id: '12',
        body: 'Context',
        moderation: {
          nodeId: 'IC_1',
          resourceType: 'IssueComment',
          isMinimized: true,
          minimizedReason: 'spam',
          viewerCanDelete: true,
        },
      },
    ],
  });
  expect(restCalls[0]!.parameters).toMatchObject({ page: 2 });
});

test('Workspace reads preserve inline comment IDs and enrich object capabilities', async () => {
  mock.module('#server/utils/github-id-utils', () => import('../server/utils/github-id-utils'));
  mock.module(
    '#server/utils/github-timeline-utils',
    () => import('../server/utils/github-timeline-utils')
  );
  const handler = (await import('../server/api/pulls/[owner]/[repo]/[pull_number]/comments.get'))
    .default;
  restData = [{ id: 12, node_id: 'IC_1', body: 'Inline', path: 'src/app.ts', position: 2 }];
  node = { ...node, __typename: 'PullRequestReviewComment', viewerCanDelete: false };
  readGraphql = (query) =>
    query.includes('query CommentModeration')
      ? { nodes: [node] }
      : {
          repository: {
            pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } },
          },
        };
  const fetchRead = toWebHandler(
    createApp().use(
      createRouter().get('/api/pulls/:owner/:repo/:pull_number/comments', handler).handler
    )
  );
  const response = await fetchRead(
    new Request('https://gitpulse.test/api/pulls/octo/app/1/comments')
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    items: [
      {
        id: '12',
        body: 'Inline',
        moderation: {
          resourceType: 'PullRequestReviewComment',
          nodeId: 'IC_1',
          viewerCanDelete: false,
        },
      },
    ],
  });
});

test('PR timeline distinguishes reviews, inline replies and CommitComment despite shared display classification', async () => {
  mock.module('#shared/utils/pr-checks', () => import('../shared/utils/pr-checks'));
  mock.module(
    '#server/utils/github-graphql-utils',
    () => import('../server/utils/github-graphql-utils')
  );
  mock.module('#shared/utils/reactions', () => import('../shared/utils/reactions'));
  mock.module(
    '#server/utils/github-timeline-utils',
    () => import('../server/utils/github-timeline-utils')
  );
  mock.module(
    '#server/utils/pr-check-rollup-graphql-utils',
    () => import('../server/utils/pr-check-rollup-graphql-utils')
  );
  const handler = (await import('../server/api/pulls/[owner]/[repo]/[pull_number]/timeline.get'))
    .default;
  restResponses = {
    'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline': [
      { event: 'reviewed', id: 12, node_id: 'R_1', state: 'APPROVED', body: 'Review' },
      {
        event: 'line_commented',
        comments: [{ id: 13, node_id: 'RC_1', body: 'Inline reply', in_reply_to_id: 11 }],
      },
      {
        event: 'commit_commented',
        comments: [{ id: 14, node_id: 'CC_1', body: 'Commit context' }],
      },
    ],
  };
  const types = ['PullRequestReview', 'PullRequestReviewComment', 'CommitComment'];
  readGraphql = (query, variables) =>
    query.includes('query CommentModeration')
      ? {
          nodes: (variables.ids as string[]).map((id) => ({
            ...node,
            id,
            __typename: types[['R_1', 'RC_1', 'CC_1'].indexOf(id)],
          })),
        }
      : {
          repository: {
            pullRequest: {
              reviews: { nodes: [], pageInfo: { hasNextPage: false } },
              reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
            },
          },
        };
  const fetchRead = toWebHandler(
    createApp().use(
      createRouter().get('/api/pulls/:owner/:repo/:pull_number/timeline', handler).handler
    )
  );
  const response = await fetchRead(
    new Request('https://gitpulse.test/api/pulls/octo/app/1/timeline')
  );
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { timeline: Array<Record<string, unknown>> };
  expect(payload.timeline).toHaveLength(3);
  expect(payload.timeline.find((item) => item.id === '12')).toMatchObject({
    state: 'approved',
    // GitHub reports the capability on a review node, but a review is never deleted.
    moderation: { resourceType: 'PullRequestReview', viewerCanDelete: false },
  });
  expect(payload.timeline.find((item) => item.id === '13')).toMatchObject({
    kind: 'review-comment',
    moderation: { resourceType: 'PullRequestReviewComment' },
  });
  expect(payload.timeline.find((item) => item.id === '14')).toMatchObject({
    kind: 'review-comment',
    moderation: { resourceType: 'CommitComment' },
  });
});

test('Discussion reads and reply pagination retain hidden state and explicit viewer abilities', async () => {
  mock.module(
    '#server/utils/github-discussion-utils',
    () => import('../server/utils/github-discussion-utils')
  );
  mock.module('#server/utils/repo-route-utils', () => import('../server/utils/repo-route-utils'));
  const detail = (await import('../server/api/discussions/[owner]/[repo]/[discussion_number].get'))
    .default;
  const replies = (
    await import('../server/api/discussions/[owner]/[repo]/[discussion_number]/comments/[comment_id]/replies.get')
  ).default;
  const reply = {
    ...node,
    id: 'DC_2',
    __typename: 'DiscussionComment',
    isMinimized: true,
    minimizedReason: 'outdated',
    body: 'Reply',
    replyTo: { id: 'DC_1' },
  };
  const pageInfo = { hasNextPage: false, endCursor: null };
  const parent = {
    ...reply,
    id: 'DC_1',
    isMinimized: true,
    minimizedReason: 'spam',
    body: 'Parent',
    replyTo: null,
    replies: { totalCount: 1, pageInfo, nodes: [reply] },
  };
  readGraphql = (query) =>
    query.includes('FetchDiscussionCommentReplies')
      ? {
          node: {
            discussion: { number: 1, repository: { name: 'app', owner: { login: 'octo' } } },
            replyTo: null,
            replies: parent.replies,
          },
        }
      : {
          repository: {
            discussion: {
              id: 'D_1',
              number: 1,
              title: 'Discussion',
              answer: reply,
              comments: { totalCount: 1, pageInfo, nodes: [parent] },
            },
          },
        };
  const router = createRouter()
    .get('/api/discussions/:owner/:repo/:discussion_number', detail)
    .get('/api/discussions/:owner/:repo/:discussion_number/comments/:comment_id/replies', replies);
  const fetchRead = toWebHandler(createApp().use(router.handler));
  const response = await fetchRead(new Request('https://gitpulse.test/api/discussions/octo/app/1'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    answer: { moderation: { nodeId: 'DC_2', isMinimized: true } },
    comments: {
      items: [
        {
          id: 'DC_1',
          moderation: { resourceType: 'DiscussionComment', minimizedReason: 'spam' },
          replies: { items: [{ moderation: { minimizedReason: 'outdated' } }] },
        },
      ],
    },
  });
  const more = await fetchRead(
    new Request(
      'https://gitpulse.test/api/discussions/octo/app/1/comments/DC_1/replies?cursor=next-page'
    )
  );
  expect(more.status).toBe(200);
  expect(await more.json()).toMatchObject({
    items: [{ id: 'DC_2', moderation: { viewerCanDelete: true, isMinimized: true } }],
  });
  expect(calls.at(-1)!.variables).toEqual({ commentId: 'DC_1', cursor: 'next-page' });
  expect(calls.at(-1)!.query).toContain('viewerCanUnminimize');
});
test.each([
  ['IssueComment', 'deleteIssueComment'],
  ['PullRequestReviewComment', 'deletePullRequestReviewComment'],
])('deletes %s through its real resource mutation', async (type, mutation) => {
  node = { ...node, __typename: type, state: 'APPROVED' };
  mutationResult = { [mutation]: { clientMutationId: null } };
  const response = await submit({ nodeId: 'IC_1', action: 'delete' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ deleted: true });
  expect(calls.at(-1)!.query).toContain(`${mutation}(input: {id: $id})`);
  expect(calls.at(-1)!.variables).toEqual({ id: 'IC_1' });
});
test('a review is never deleted, even when GitHub reports the capability', async () => {
  node = { ...node, __typename: 'PullRequestReview', state: 'APPROVED', viewerCanDelete: true };
  const response = await submit({ nodeId: 'IC_1', action: 'delete' });
  expect(response.status).toBe(400);
  expect(calls.some((call) => call.query.includes('mutation'))).toBe(false);
});
test('rejects invalid operations and reasons before contacting GitHub', async () => {
  for (const body of [
    { nodeId: 'IC_1', action: 'hide' },
    { nodeId: 'IC_1', action: 'hide', reason: 'off-topic' },
    { nodeId: 'IC_1', action: 'resolve' },
    { nodeId: 'IC_1', action: 'delete', viewerCanDelete: true },
  ])
    expect((await submit(body)).status).toBe(400);
  expect(calls).toEqual([]);
});
test('returns GitHub refusal without a success result', async () => {
  denied = true;
  const response = await submit({ nodeId: 'IC_1', action: 'hide', reason: 'SPAM' });
  expect(response.status).toBe(403);
  expect(await response.json()).not.toHaveProperty('moderation');
});
test('hides the actual GitHub node with an explicit classifier and returns upstream state', async () => {
  const response = await submit({ nodeId: 'IC_1', action: 'hide', reason: 'OFF_TOPIC' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    moderation: {
      nodeId: 'IC_1',
      resourceType: 'IssueComment',
      isMinimized: true,
      minimizedReason: 'off-topic',
    },
  });
  const write = calls.find((call) => call.query.includes('mutation'))!;
  expect(write.variables).toEqual({ subjectId: 'IC_1', classifier: 'OFF_TOPIC' });
  expect(write.query).toContain('minimizeComment');
});
