import { beforeEach, expect, mock, test } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getQuery,
  toWebHandler,
} from 'h3';

import * as pagination from '../server/utils/github-pagination';

Object.assign(globalThis, {
  createError,
  getQuery,
  definePrivateApiCoalescedEventHandler: defineEventHandler,
});

interface RestCall {
  route: string;
  parameters: Record<string, unknown>;
}

const restCalls: RestCall[] = [];
let restResponses: Record<string, { data: unknown; link?: string }> = {};
const github = {
  request: async (route: string, parameters: Record<string, unknown>) => {
    restCalls.push({ route, parameters });
    const response = restResponses[route] ?? { data: [] };
    return { status: 200, data: response.data, headers: { link: response.link } };
  },
};

Object.assign(globalThis, {
  getGitHubClient: async () => github,
  getGitHubSessionContext: async () => ({
    accessTokenCacheKey: 'test',
    octokit: github,
    userLogin: 'octocat',
  }),
});
mock.module('#server/utils/github-auth-utils', () => import('../server/utils/github-auth-utils'));
mock.module(
  '#shared/utils/github-search-query',
  () => import('../shared/utils/github-search-query')
);
mock.module(
  '#server/utils/github-issue-search-route-utils',
  () => import('../server/utils/github-issue-search-route-utils')
);
mock.module('../utils/github-pagination', () => pagination);

const handler = (await import('../server/api/repos.get')).default;
const fetchApi = toWebHandler(createApp().use(createRouter().get('/api/repos', handler).handler));
const getRepos = async (query: string) => {
  const response = await fetchApi(new Request(`https://gitpulse.test/api/repos?${query}`));
  return { status: response.status, body: await response.json() };
};

const pageLinks = (prev: number, next: number) =>
  `<https://api.github.com/user/repos?page=${prev}>; rel="prev", <https://api.github.com/user/repos?page=${next}>; rel="next"`;

beforeEach(() => {
  restCalls.length = 0;
  restResponses = {};
});

test('browses accessible personal, collaborator and organization repositories by recent update', async () => {
  const repos = [{ full_name: 'acme/widgets' }, { full_name: 'octocat/notes' }];
  restResponses = {
    'GET /user/repos': { data: repos, link: pageLinks(1, 3) },
  };

  const { status, body } = await getRepos('scope=accessible&page=2&per_page=30');

  expect(status).toBe(200);
  expect(body.items).toEqual(repos);
  expect(body.pagination).toMatchObject({ page: 2, perPage: 30, hasPrev: true, hasNext: true });
  expect(restCalls).toEqual([
    {
      route: 'GET /user/repos',
      parameters: {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
        direction: 'desc',
        page: 2,
        per_page: 30,
      },
    },
  ]);
});

test('keeps the owned-repository list when no scope is requested', async () => {
  await getRepos('page=1');

  expect(restCalls).toEqual([
    {
      route: 'GET /user/repos',
      parameters: { type: 'owner', sort: 'updated', direction: 'desc', page: 1, per_page: 20 },
    },
  ]);
});

test('searches only the reader and their organizations when a query is typed', async () => {
  const repos = [{ full_name: 'acme/widget-kit' }];
  restResponses = {
    'GET /user/orgs': { data: [{ login: 'acme' }, { login: 'tools' }] },
    'GET /search/repositories': { data: { total_count: 41, items: repos } },
  };

  const { status, body } = await getRepos('scope=accessible&q=%20widget%20&page=1&per_page=20');

  expect(status).toBe(200);
  expect(body.items).toEqual(repos);
  expect(body.pagination).toMatchObject({ page: 1, perPage: 20, totalCount: 41, totalPages: 3 });
  expect(restCalls).toEqual([
    { route: 'GET /user/orgs', parameters: { per_page: 100 } },
    {
      route: 'GET /search/repositories',
      parameters: {
        q: 'widget fork:true user:octocat org:acme org:tools',
        page: 1,
        per_page: 20,
      },
    },
  ]);
});
