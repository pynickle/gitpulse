import { beforeEach, expect, mock, test } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  readBody,
  toWebHandler,
} from 'h3';

Object.assign(globalThis, {
  createError,
  defineEventHandler,
  definePrivateApiCoalescedEventHandler: defineEventHandler,
  readBody,
});

interface SearchCall {
  route: string;
  parameters: Record<string, unknown>;
}

const searchCalls: SearchCall[] = [];
let searchPages: Record<string, unknown>[][] = [[]];
let searchError: unknown = null;

const github = {
  request: async (route: string, parameters: Record<string, unknown>) => {
    searchCalls.push({ route, parameters });
    if (searchError) throw searchError;
    const items = searchPages[(parameters.page as number) - 1] ?? [];
    return {
      status: 200,
      data: { total_count: items.length, items },
      headers: {},
    };
  },
};

const auth = await import('../server/utils/github-auth-utils');
const githubAdapter = { ...auth, getGitHubClient: async () => github };
mock.module('#server/utils/github-auth-utils', () => githubAdapter);
mock.module('../server/utils/github-auth-utils', () => githubAdapter);
mock.module('#server/utils/repo-route-utils', () => import('../server/utils/repo-route-utils'));
mock.module('#server/utils/pr-archive-utils', () => import('../server/utils/pr-archive-utils'));

const handler = (await import('../server/api/repos/[owner]/[repo]/archived-pulls.get')).default;
const router = createRouter().get('/api/repos/:owner/:repo/archived-pulls', handler);
const fetchApi = toWebHandler(createApp().use(router.handler));

const getArchived = () =>
  fetchApi(new Request('https://gitpulse.test/api/repos/acme/widgets/archived-pulls'));

beforeEach(() => {
  searchCalls.length = 0;
  searchPages = [[]];
  searchError = null;
});

const archivedItem = (number: number) => ({
  number,
  pull_request: { url: `https://api.github.com/repos/acme/widgets/pulls/${number}` },
});

test('lists archived pull request numbers for one repository, scoped by the search qualifier', async () => {
  searchPages = [[archivedItem(7), archivedItem(12)]];

  const response = await getArchived();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([7, 12]);
  expect(searchCalls).toHaveLength(1);
  expect(searchCalls[0]).toEqual({
    route: 'GET /search/issues',
    parameters: { q: 'repo:acme/widgets is:pr is:archived', per_page: 100, page: 1 },
  });
});

test('keeps reading past the first page so a later archived pull request is not missed', async () => {
  const fullPage = Array.from({ length: 100 }, (_, index) => archivedItem(index + 1));
  searchPages = [fullPage, [archivedItem(250)]];

  expect(await (await getArchived()).json()).toContain(250);
  expect(searchCalls.map((call) => call.parameters.page)).toEqual([1, 2]);
});

test('ignores an issue result that carries no pull request', async () => {
  searchPages = [[archivedItem(7), { number: 9 }]];

  expect(await (await getArchived()).json()).toEqual([7]);
});

test('returns an empty list when the repository has nothing archived', async () => {
  expect(await (await getArchived()).json()).toEqual([]);
});

test('keeps a GitHub failure visible instead of reporting nothing archived', async () => {
  searchError = Object.assign(new Error('Validation Failed'), { status: 422 });

  const response = await getArchived();

  expect(response.status).toBe(422);
});
