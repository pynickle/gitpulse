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
  definePrivateApiCoalescedEventHandler: defineEventHandler,
  getQuery,
  readBody,
});

const sharedReactions = await import('../shared/utils/reactions');
mock.module('#shared/utils/reactions', () => sharedReactions);

type RestResponder = (route: string, params: Record<string, unknown>) => unknown;
type GraphqlResponder = (query: string, variables: Record<string, unknown>) => unknown;

let restCalls: Array<{ route: string; params: Record<string, unknown> }> = [];
let graphqlCalls: Array<{ query: string; variables: Record<string, unknown> }> = [];
let restHandler: RestResponder = () => [];
let graphqlHandler: GraphqlResponder = () => ({});

const octokit = {
  request: async (route: string, params: Record<string, unknown> = {}) => {
    restCalls.push({ route, params });
    const data = await restHandler(route, params);
    return { status: 200, data, headers: {} };
  },
  graphql: async (query: string, variables: Record<string, unknown> = {}) => {
    graphqlCalls.push({ query, variables });
    return await graphqlHandler(query, variables);
  },
};

const auth = await import('../server/utils/github-auth-utils');
const authAdapter = {
  ...auth,
  getGitHubClient: async () => octokit,
  getGitHubSessionContext: async () => ({
    accessTokenCacheKey: 'token-key',
    octokit,
    userLogin: 'octocat',
  }),
};
mock.module('#server/utils/github-auth-utils', () => authAdapter);
mock.module('../server/utils/github-auth-utils', () => authAdapter);
mock.module('#shared/types/comment-moderation', () => import('../shared/types/comment-moderation'));
mock.module(
  '#shared/utils/release-note-search-text',
  () => import('../shared/utils/release-note-search-text')
);
mock.module(
  '#shared/utils/user-settings-storage-env',
  () => import('../shared/utils/user-settings-storage-env')
);
mock.module('#server/utils/issue-duplicate-target-utils', () => ({
  fetchIssueDuplicateTarget: async () => undefined,
}));
mock.module('#server/utils/sub-issue-graphql-utils', () => ({
  fetchIssueParentTarget: async () => undefined,
}));

const reactionUtils = await import('../server/utils/github-reaction-utils');
mock.module('#server/utils/github-reaction-utils', () => reactionUtils);

const moderationUtils = await import('../server/utils/comment-moderation-utils');
mock.module('#server/utils/comment-moderation-utils', () => moderationUtils);
const releaseTimelineGraphql = await import('../server/utils/release-timeline-graphql-utils');
const timelineHistoryUtils = await import('../server/utils/timeline-history-utils');

Object.assign(globalThis, {
  parsePaginationNumber: (value: unknown, fallback: number) => Number(value) || fallback,
  getGitHubClient: async () => octokit,
});

const commentPost = (
  await import('../server/api/reactions/comments/[owner]/[repo]/[comment_id].post')
).default;
const commentGet = (
  await import('../server/api/reactions/comments/[owner]/[repo]/[comment_id].get')
).default;
const issueDelete = (
  await import('../server/api/reactions/issues/[owner]/[repo]/[issue_number].delete')
).default;
const issueDetailGet = (await import('../server/api/issues/[owner]/[repo]/[issue_number].get'))
  .default;
const releaseDetailGet = (await import('../server/api/releases/[owner]/[repo]/[release_id].get'))
  .default;

const router = createRouter()
  .get('/api/reactions/comments/:owner/:repo/:comment_id', commentGet)
  .post('/api/reactions/comments/:owner/:repo/:comment_id', commentPost)
  .delete('/api/reactions/issues/:owner/:repo/:issue_number', issueDelete)
  .get('/api/issues/:owner/:repo/:issue_number', issueDetailGet)
  .get('/api/releases/:owner/:repo/:release_id', releaseDetailGet);
const fetchApi = toWebHandler(createApp().use(router.handler));

beforeEach(() => {
  restCalls = [];
  graphqlCalls = [];
  restHandler = () => [];
  graphqlHandler = () => ({});
});

test('fetchIssueReactionSummary returns viewerCanReact from GraphQL alongside normalized reactions', async () => {
  restHandler = () => [{ id: 10, content: '+1', user: { login: 'octocat' } }];
  graphqlHandler = () => ({
    repository: {
      issueOrPullRequest: {
        viewerCanReact: false,
      },
    },
  });

  const payload = await reactionUtils.fetchIssueReactionSummary(
    octokit as never,
    { owner: 'acme', repo: 'widgets', targetId: 42 },
    'octocat'
  );

  expect(payload).toEqual({
    items: [{ content: '+1', count: 1, viewerHasReacted: true, viewerReactionId: 10 }],
    canReact: false,
  });
  expect(graphqlCalls[0]?.variables).toEqual({ owner: 'acme', repo: 'widgets', number: 42 });
});

test('fetchIssueReactionSummary degrades cleanly when GraphQL viewerCanReact query fails', async () => {
  restHandler = () => [{ id: 11, content: 'heart', user: { login: 'someone' } }];
  graphqlHandler = () => {
    throw new Error('GraphQL unavailable');
  };

  const payload = await reactionUtils.fetchIssueReactionSummary(
    octokit as never,
    { owner: 'acme', repo: 'widgets', targetId: 42 },
    'octocat'
  );

  expect(payload).toEqual({
    items: [{ content: 'heart', count: 1, viewerHasReacted: false, viewerReactionId: null }],
  });
});

test('GET comment reaction summary resolves viewerCanReact via node_id lookup when nodeId is omitted', async () => {
  restHandler = (route) => {
    if (route === 'GET /repos/{owner}/{repo}/issues/comments/{comment_id}') {
      return { id: 99, node_id: 'IC_99' };
    }
    return [{ id: 5, content: 'eyes', user: { login: 'alice' } }];
  };
  graphqlHandler = () => ({
    node: { viewerCanReact: false },
  });

  const response = await fetchApi(
    new Request('https://gitpulse.test/api/reactions/comments/acme/widgets/99')
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    items: [{ content: 'eyes', count: 1, viewerHasReacted: false, viewerReactionId: null }],
    canReact: false,
  });
  expect(graphqlCalls[0]?.variables).toEqual({ id: 'IC_99' });
});

test('POST comment reaction converts REST 403 into reaction_forbidden only when GraphQL confirms viewerCanReact is false', async () => {
  restHandler = (route) => {
    if (route === 'POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions') {
      const error = new Error('Must have admin rights to Repository.') as Error & {
        status: number;
      };
      error.status = 403;
      throw error;
    }
    if (route === 'GET /repos/{owner}/{repo}/issues/comments/{comment_id}') {
      return { id: 99, node_id: 'IC_99' };
    }
    return [];
  };
  graphqlHandler = () => ({ node: { viewerCanReact: false } });

  const forbiddenResponse = await fetchApi(
    new Request('https://gitpulse.test/api/reactions/comments/acme/widgets/99', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '+1' }),
    })
  );
  const forbiddenBody = await forbiddenResponse.json();
  expect(forbiddenResponse.status).toBe(403);
  expect(sharedReactions.isReactionForbiddenError({ data: forbiddenBody })).toBe(true);

  graphqlCalls = [];
  graphqlHandler = () => ({ node: { viewerCanReact: true } });

  const otherForbiddenResponse = await fetchApi(
    new Request('https://gitpulse.test/api/reactions/comments/acme/widgets/99', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '+1' }),
    })
  );
  const otherBody = await otherForbiddenResponse.json();
  expect(otherForbiddenResponse.status).toBe(403);
  expect(sharedReactions.isReactionForbiddenError({ data: otherBody })).toBe(false);
});

test('DELETE issue reaction converts REST 403 into reaction_forbidden when GraphQL re-check confirms viewerCanReact is false', async () => {
  let eligibilityChecks = 0;
  restHandler = (route) => {
    if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/reactions') {
      return [{ id: 77, content: '+1', user: { login: 'octocat' } }];
    }
    if (route === 'DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}') {
      const error = new Error('Must have admin rights to Repository.') as Error & {
        status: number;
      };
      error.status = 403;
      throw error;
    }
    return [];
  };
  graphqlHandler = () => {
    eligibilityChecks += 1;
    // Initial summary lookup reports true so the REST DELETE executes; the 403 re-check sees false.
    return {
      repository: {
        issueOrPullRequest: {
          viewerCanReact: eligibilityChecks === 1,
        },
      },
    };
  };

  const response = await fetchApi(
    new Request('https://gitpulse.test/api/reactions/issues/acme/widgets/12', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '+1' }),
    })
  );
  const body = await response.json();
  expect(response.status).toBe(403);
  expect(sharedReactions.isReactionForbiddenError({ data: body })).toBe(true);
  expect(
    restCalls.some(
      (call) =>
        call.route === 'DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}'
    )
  ).toBe(true);
  expect(eligibilityChecks).toBe(2);
});

test('POST comment reaction does not call GraphQL on non-403 server failures', async () => {
  restHandler = () => {
    const error = new Error('Internal error') as Error & { status: number };
    error.status = 500;
    throw error;
  };

  const response = await fetchApi(
    new Request('https://gitpulse.test/api/reactions/comments/acme/widgets/99', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '+1' }),
    })
  );
  expect(response.status).toBe(500);
  expect(graphqlCalls).toHaveLength(0);
});

test('enrichCommentModeration attaches canReact to reactable timeline items without querying viewerCanReact on PullRequestReview', async () => {
  graphqlHandler = () => ({
    nodes: [
      {
        __typename: 'IssueComment',
        id: 'IC_1',
        databaseId: 101,
        isMinimized: false,
        minimizedReason: null,
        viewerCanDelete: false,
        viewerCanMinimize: false,
        viewerCanUnminimize: false,
        viewerCanReact: false,
      },
      {
        __typename: 'PullRequestReview',
        id: 'PRR_1',
        databaseId: 202,
        isMinimized: false,
        minimizedReason: null,
        viewerCanDelete: false,
        viewerCanMinimize: false,
        viewerCanUnminimize: false,
      },
    ],
  });

  const commentItem: {
    moderation?: ReturnType<typeof moderationUtils.restCommentModeration>;
    canReact?: boolean;
  } = {
    moderation: moderationUtils.restCommentModeration('IssueComment', { id: 101, node_id: 'IC_1' }),
  };
  const reviewItem: {
    moderation?: ReturnType<typeof moderationUtils.restCommentModeration>;
    canReact?: boolean;
  } = {
    moderation: moderationUtils.restCommentModeration('PullRequestReview', {
      id: 202,
      node_id: 'PRR_1',
    }),
  };

  await moderationUtils.enrichCommentModeration(octokit as never, [commentItem, reviewItem]);

  expect(commentItem.canReact).toBe(false);
  expect(reviewItem.canReact).toBeUndefined();
  expect(graphqlCalls[0]?.query).toContain('... on IssueComment');
  expect(graphqlCalls[0]?.query).not.toMatch(/\.\.\. on PullRequestReview \{[^}]*viewerCanReact/);
});

test('mapRepositoryReleaseLookup and recoveredReleaseSchema preserve viewerCanReact on releases', () => {
  const lookup = releaseTimelineGraphql.mapRepositoryReleaseLookup({
    id: 'R_1',
    name: 'widgets',
    nameWithOwner: 'octo/widgets',
    owner: { login: 'octo' },
    releases: {
      pageInfo: { hasNextPage: false },
      nodes: [
        {
          databaseId: 50,
          url: 'https://github.com/octo/widgets/releases/tag/v1.0',
          tagName: 'v1.0',
          name: 'v1.0',
          description: 'Notes',
          publishedAt: '2026-11-01T00:00:00Z',
          isDraft: false,
          isPrerelease: false,
          releaseAssets: { totalCount: 0 },
          reactionGroups: [],
          viewerCanReact: false,
        },
      ],
    },
  });

  expect(lookup.status).toBe('available');
  if (lookup.status === 'available') {
    expect(lookup.releases[0]?.canReact).toBe(false);
  }

  const parsed = timelineHistoryUtils.recoveredReleaseSchema.parse({
    repository: { id: 'R_1', owner: 'octo', name: 'widgets' },
    id: 50,
    title: 'v1.0',
    tagName: 'v1.0',
    publishedAt: '2026-11-01T00:00:00Z',
    changelog: 'Notes',
    changelogTruncated: false,
    assetCount: 0,
    isPrerelease: false,
    isOldestShown: false,
    htmlUrl: 'https://github.com/octo/widgets/releases/tag/v1.0',
    reactions: [],
    canReact: false,
    discoveredAt: '2026-11-02T00:00:00Z',
  });
  expect(parsed.canReact).toBe(false);
});

test('GET issue detail and GET release detail forward canReact in the response payload', async () => {
  restHandler = (route) => {
    if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}') {
      return { number: 7, title: 'Bug', state: 'open' };
    }
    if (route === 'GET /repos/{owner}/{repo}/releases/{release_id}') {
      return { id: 88, node_id: 'RE_88', tag_name: 'v1.0' };
    }
    return [];
  };
  graphqlHandler = (query) => {
    if (query.includes('issueOrPullRequest')) {
      return { repository: { issueOrPullRequest: { viewerCanReact: false } } };
    }
    return { node: { viewerCanReact: false } };
  };

  const issueResponse = await fetchApi(
    new Request('https://gitpulse.test/api/issues/acme/widgets/7')
  );
  expect(issueResponse.status).toBe(200);
  expect((await issueResponse.json()).canReact).toBe(false);

  restCalls = [];
  const releaseResponse = await fetchApi(
    new Request('https://gitpulse.test/api/releases/acme/widgets/88')
  );
  expect(releaseResponse.status).toBe(200);
  expect((await releaseResponse.json()).canReact).toBe(false);
  // Release detail should reuse release.data.node_id instead of fetching the release twice.
  expect(
    restCalls.filter((call) => call.route === 'GET /repos/{owner}/{repo}/releases/{release_id}')
  ).toHaveLength(1);
});
