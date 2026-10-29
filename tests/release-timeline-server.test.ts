import { expect, mock, test } from 'bun:test';

import { z } from 'zod';

import * as reactions from '../shared/utils/reactions';
import * as follows from '../shared/utils/release-follows';
import * as searchText from '../shared/utils/release-note-search-text';
import * as timeline from '../shared/utils/release-timeline';
import * as env from '../shared/utils/user-settings-storage-env';
mock.module('#shared/utils/reactions', () => reactions);
mock.module('#shared/utils/user-settings-storage-env', () => env);
mock.module('#shared/utils/release-note-search-text', () => searchText);
const graphql = await import('../server/utils/release-timeline-graphql-utils');
const { createTimelineHistoryService } = await import('../server/utils/timeline-history-utils');
import type { ReleaseTimelinePage } from '../shared/types/release-follows';
import type { TimelineHistory } from '../shared/types/timeline-history';

// Execute the production loader with controllable provider/storage adapters. Like the
// mounted SFC harness, this resolves Nuxt bindings without replacing its business logic.
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(
  await Bun.file('server/utils/release-timeline-utils.ts').text()
);
const executable = code
  .replace(
    /import\s+({[^}]+})\s+from\s+['"]([^'"]+)['"];?/g,
    (_, binding: string, name: string) =>
      `const ${binding.replace(/\s+as\s+/g, ': ')} = modules[${JSON.stringify(name)}];`
  )
  .replace(
    'export async function loadReleaseTimelineRound',
    'async function loadReleaseTimelineRound'
  );

function harness(count = 1) {
  let stored: TimelineHistory | null = null;
  let failSave = false;
  const history = createTimelineHistoryService({
    read: async () => stored,
    write: async (_, value) => {
      stored = value;
    },
    update: async (_, updater) => {
      if (failSave) throw new Error('Storage down');
      stored = await updater(stored);
      return stored;
    },
  });
  let response: unknown = {
    repo0: { id: 'A', releases: { pageInfo: { hasNextPage: false }, nodes: [] } },
  };
  let duringRead = '';
  const provider = {
    graphql: async () => {
      duringRead = new Date().toISOString();
      return response;
    },
  };
  const modules = {
    zod: { z },
    h3: {
      getQuery: (event: unknown) => event,
      createError: (data: { statusMessage: string }) => new Error(data.statusMessage),
    },
    './github-auth-utils': {
      getGitHubSessionContext: async () => ({ octokit: provider, userLogin: 'octo' }),
    },
    './release-timeline-graphql-utils': graphql,
    './user-settings-utils': {
      readUserSettings: async () => ({
        followedRepositories: Array.from({ length: count }, (_, index) => ({
          id: String.fromCharCode(65 + index),
          owner: 'octo',
          name: String.fromCharCode(65 + index),
        })),
      }),
      renameFollowedRepositories: async () => {},
    },
    './timeline-history-utils': { createTimelineHistoryService: () => history },
    '#shared/utils/release-follows': follows,
    '#shared/utils/release-timeline': timeline,
  };
  const load = new Function('modules', `${executable}; return loadReleaseTimelineRound;`)(
    modules
  ) as (query: Record<string, string>, refresh?: boolean) => Promise<ReleaseTimelinePage>;
  return {
    load,
    history,
    setResponse: (value: unknown) => {
      response = value;
    },
    failSave: () => {
      failSave = true;
    },
    duringRead: () => duringRead,
  };
}

test('refresh captures server time before GitHub reads, accepts empty success and keeps the previous baseline', async () => {
  const app = harness();
  const first = await app.load({ timeZone: 'UTC' }, true);
  expect(first.refresh?.previousBaseline).toBeNull();
  expect(Date.parse(first.refresh!.startedAt)).toBeLessThanOrEqual(Date.parse(app.duringRead()));
  expect((await app.history.read('octo')).baseline).toBe(first.refresh!.startedAt);
  const second = await app.load({}, true);
  expect(second.refresh?.previousBaseline).toBe(first.refresh!.startedAt);
});

test('HTTP-success total failure and ordinary GET/history reads never advance the baseline', async () => {
  const app = harness();
  await app.history.advanceBaseline('octo', '2026-01-01T00:00:00Z');
  app.setResponse({});
  const failure = await app.load({}, true);
  expect(failure.transientIds).toEqual(['A']);
  expect((await app.history.read('octo')).baseline).toBe('2026-01-01T00:00:00Z');
  app.setResponse({
    repo0: { id: 'A', releases: { nodes: [], pageInfo: { hasNextPage: false } } },
  });
  await app.load({ cursors: JSON.stringify({ A: 'cursor' }) });
  await app.load({});
  expect((await app.history.read('octo')).baseline).toBe('2026-01-01T00:00:00Z');
});

test('a baseline persistence failure returns usable GitHub data and an explicit save error', async () => {
  const app = harness();
  app.failSave();
  const result = await app.load({}, true);
  expect(result.pages.A?.status).toBe('available');
  expect(result.persistenceError).toBeTruthy();
  expect((await app.history.read('octo')).baseline).toBeNull();
});

test('partial refresh success advances the baseline despite another repository failing', async () => {
  const app = harness(2);
  app.setResponse({
    repo0: { id: 'A', releases: { nodes: [], pageInfo: { hasNextPage: false } } },
    repo1: null,
  });
  const result = await app.load({}, true);
  expect(result.unavailableIds).toEqual(['B']);
  expect((await app.history.read('octo')).baseline).toBe(result.refresh!.startedAt);
});

test.each([true, false])(
  'timeline round supplies complete readable note text (refresh=%s)',
  async (refresh) => {
    const app = harness();
    app.setResponse({
      repo0: {
        id: 'A',
        releases: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              databaseId: 1,
              tagName: 'v1',
              publishedAt: '2026-10-20T12:00:00Z',
              description: `${'intro '.repeat(120)}修复 **登录** 问题 [docs](https://example.com/HIDDENPATH) ![badge](https://img.example/HIDDENSRC) <img src="HIDDENIMAGE" alt="RawAlt">`,
            },
            { databaseId: 2, description: null },
          ],
        },
      },
    });
    const result = await app.load({}, refresh);
    const page = result.pages.A;
    if (page?.status !== 'available') throw new Error('Expected an available release page');
    expect(page.releases[0]!.notesSearchText.endsWith('修复 登录 问题 docs badge rawalt')).toBe(
      true
    );
    expect(page.releases[0]!.notesSearchText).not.toContain('hidden');
    expect(page.releases[1]!.notesSearchText).toBe('');
  }
);
