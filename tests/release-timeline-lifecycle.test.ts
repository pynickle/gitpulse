import { afterEach, describe, expect, mock, test } from 'bun:test';

import {
  defineComponent,
  effectScope,
  getCurrentInstance,
  h,
  nextTick,
  shallowRef,
  type EffectScope,
} from 'vue';

import type {
  FollowedRepository,
  ReleaseTimeline,
  ReleaseTimelineRequest,
  RepositoryReleaseLookup,
} from '#shared/types/release-follows';

import { getFollowedRepositoryQueries } from '../app/composables/followed-repositories/queries';
import filterReleaseTimelineGroups from '../app/utils/filterReleaseTimelineGroups';
import * as timelineUtils from '../shared/utils/release-timeline';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/release-timeline', () => timelineUtils);

const { createReleaseTimelineSession } =
  await import('../app/composables/release-timeline/session');

const scopes: EffectScope[] = [];
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const scope of scopes.splice(0)) scope.stop();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const repository: FollowedRepository = { id: 'R_widgets', owner: 'octo', name: 'widgets' };
const timeline = (date = '2026-10-02'): ReleaseTimeline => ({
  groups: [{ date, items: [] }],
  unavailableIds: [],
  transientIds: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(
  history?: import('../shared/types/timeline-history').TimelineHistoryAdapter,
  filter?: import('vue').Ref<
    import('../app/utils/filterReleaseTimelineGroups').ReleaseTimelineFilterState
  >
) {
  const login = shallowRef<string | null>('octocat');
  const loaded = shallowRef(true);
  const repositories = shallowRef([repository]);
  const historyCache = shallowRef<
    import('../app/composables/release-timeline/history').TimelineHistoryCache | null
  >(null);
  const cache = shallowRef<
    import('../app/composables/release-timeline/session').ReleaseTimelineSessionEntry | null
  >(null);
  const requests: (ReturnType<typeof deferred<ReleaseTimeline>> & {
    input?: ReleaseTimelineRequest;
  })[] = [];
  const dom = createVueDom({ filterReleaseTimelineGroups });
  cleanups.push(dom.cleanup);
  let lookups!: ReturnType<typeof getFollowedRepositoryQueries>;
  dom.mount(
    defineComponent({
      setup() {
        lookups = getFollowedRepositoryQueries(getCurrentInstance()!.appContext.app, {
          login,
          loaded,
          repositories,
          loadSettings: async () => {},
          adapter: {
            identities: async () => ({
              availableIds: repositories.value.map((repo) => repo.id),
              unavailableIds: [],
              transientIds: [],
            }),
            timeline: (input) => {
              const request = deferred<ReleaseTimeline>();
              requests.push({ ...request, input });
              return request.promise;
            },
          },
        });
        return () => h('div');
      },
    })
  );
  const open = () => {
    const scope = effectScope();
    scopes.push(scope);
    const view = scope.run(() =>
      createReleaseTimelineSession({
        login,
        loaded,
        repositories,
        cache,
        lookups,
        history,
        historyCache,
        filter,
        describeError: (error) => (error instanceof Error ? error.message : 'An error occurred'),
      })
    )!;
    return { view, close: () => scope.stop() };
  };
  return { login, loaded, repositories, requests, open };
}

const settle = async () => {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
  await nextTick();
};

describe('Release Timeline lifecycle', () => {
  test("a new user cannot restore another user's successful cache after returning", async () => {
    const harness = createHarness();
    const first = harness.open();
    harness.requests[0]!.resolve(timeline('2026-10-01'));
    await settle();
    first.close();
    harness.login.value = 'hubot';
    const second = harness.open();
    expect(second.view.groups.value).toEqual([]);
    expect(second.view.loading.value).toBe(true);
    expect(harness.requests).toHaveLength(2);
  });

  test('loading waits for user settings and an empty follow collection hides cached cards without fetching', async () => {
    const harness = createHarness();
    harness.loaded.value = false;
    const first = harness.open();
    expect(harness.requests).toHaveLength(0);
    expect(first.view.loading.value).toBe(false);
    harness.loaded.value = true;
    await nextTick();
    harness.requests[0]!.resolve(timeline());
    await settle();
    first.close();

    harness.repositories.value = [];
    const second = harness.open();
    expect(second.view.groups.value).toEqual([]);
    expect(second.view.hasFollows.value).toBe(false);
    expect(second.view.loading.value).toBe(false);
    expect(harness.requests).toHaveLength(1);
  });

  test('a failed refresh keeps successful cards, reports lookup failure, and allows a retry', async () => {
    const harness = createHarness();
    const first = harness.open();
    harness.requests[0]!.resolve(timeline('2026-10-01'));
    await settle();
    const refresh = first.view.fetchTimeline();
    harness.requests[1]!.reject(new Error('Temporarily unavailable'));
    await refresh;
    expect(first.view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(first.view.error.value).toBe('Temporarily unavailable');
    expect(first.view.loading.value).toBe(false);
    expect(first.view.transientRepos.value).toEqual([repository]);

    first.close();
    const second = harness.open();
    expect(second.view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(second.view.hasLookupFailures.value).toBe(true);
    expect(harness.requests).toHaveLength(2);
    const retry = second.view.fetchTimeline();
    harness.requests[2]!.resolve(timeline());
    await retry;
    expect(second.view.groups.value).toEqual(timeline().groups);
    expect(second.view.error.value).toBeNull();
  });

  test.each(['success', 'failure'] as const)(
    'a superseded refresh %s cannot change the latest request state',
    async (outcome) => {
      const harness = createHarness();
      const { view } = harness.open();
      const refresh = view.fetchTimeline();
      if (outcome === 'success') {
        harness.requests[0]!.resolve({
          ...timeline('2026-09-30'),
          unavailableIds: [repository.id],
        });
      } else {
        harness.requests[0]!.reject(new Error('Old request failed'));
      }
      await settle();
      expect(view.loading.value).toBe(true);
      expect(view.error.value).toBeNull();
      expect(view.hasLookupFailures.value).toBe(false);
      expect(view.groups.value).toEqual([]);

      harness.requests[1]!.resolve(timeline());
      await refresh;
      expect(view.loading.value).toBe(false);
      expect(view.groups.value).toEqual(timeline().groups);
    }
  );

  test('changing follows keeps successful cards, and returning to cached follows invalidates the intervening request', async () => {
    const harness = createHarness();
    const { view } = harness.open();
    harness.requests[0]!.resolve(timeline('2026-10-01'));
    await settle();

    harness.repositories.value = [repository, { id: 'R_tools', owner: 'octo', name: 'tools' }];
    await nextTick();
    expect(view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(view.loading.value).toBe(true);

    harness.repositories.value = [repository];
    await nextTick();
    expect(view.loading.value).toBe(false);
    harness.requests[1]!.resolve({ ...timeline(), transientIds: [repository.id] });
    await settle();
    expect(view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(view.hasLookupFailures.value).toBe(false);
    expect(harness.requests).toHaveLength(2);
  });

  test('a context change invalidates a response already queued before Vue updates the view', async () => {
    const harness = createHarness();
    const { view } = harness.open();
    harness.requests[0]!.resolve(timeline());
    harness.repositories.value = [];
    await settle();

    harness.repositories.value = [repository];
    await nextTick();
    expect(view.groups.value).toEqual([]);
    expect(view.loading.value).toBe(true);
    expect(harness.requests).toHaveLength(2);
  });

  test('switching users clears the old Timeline and rejects the old refresh even with identical follows', async () => {
    const harness = createHarness();
    const { view } = harness.open();
    harness.requests[0]!.resolve(timeline('2026-10-01'));
    await settle();
    const oldRefresh = view.fetchTimeline();

    harness.login.value = 'hubot';
    harness.loaded.value = false;
    await nextTick();
    expect(view.groups.value).toEqual([]);
    expect(view.loading.value).toBe(false);

    harness.loaded.value = true;
    await nextTick();
    expect(harness.requests).toHaveLength(3);
    harness.requests[1]!.resolve({ ...timeline('2026-09-30'), unavailableIds: [repository.id] });
    await oldRefresh;
    expect(view.groups.value).toEqual([]);
    expect(view.hasLookupFailures.value).toBe(false);
    expect(view.loading.value).toBe(true);

    harness.requests[2]!.resolve(timeline());
    await settle();
    expect(view.groups.value).toEqual(timeline().groups);
  });

  test('leaving discards a pending refresh and returning reuses the last successful Timeline', async () => {
    const harness = createHarness();
    const first = harness.open();
    harness.requests[0]!.resolve(timeline('2026-10-01'));
    await settle();

    const refresh = first.view.fetchTimeline();
    first.close();
    const second = harness.open();
    expect(second.view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(second.view.loading.value).toBe(false);
    expect(harness.requests).toHaveLength(2);

    harness.requests[1]!.resolve({ ...timeline(), unavailableIds: [repository.id] });
    await refresh;
    expect(second.view.hasLookupFailures.value).toBe(true);
    second.close();
    const third = harness.open();
    expect(third.view.groups.value).toEqual(timeline('2026-10-01').groups);
    expect(harness.requests).toHaveLength(2);
  });

  test('clearing all Release Follows prevents an outstanding response from restoring the Timeline', async () => {
    const harness = createHarness();
    const { view } = harness.open();
    expect(view.loading.value).toBe(true);

    harness.repositories.value = [];
    await nextTick();
    harness.requests[0]!.resolve(timeline());
    await settle();

    expect(view.groups.value).toEqual([]);
    expect(view.loading.value).toBe(false);
    expect(view.hasFollows.value).toBe(false);
  });
});

const releasePage = (
  id: string,
  dates: string[],
  cursor: string | null
): Extract<RepositoryReleaseLookup, { status: 'available' }> => ({
  status: 'available',
  owner: 'octo',
  name: id,
  hasOlderReleases: cursor !== null,
  endCursor: cursor,
  releases: dates.map((date) => ({
    id: Number(date.replaceAll('-', '')),
    tagName: date,
    name: date,
    description: '',
    publishedAt: `${date}T12:00:00Z`,
    isDraft: false,
    isPrerelease: false,
    assetCount: 0,
    htmlUrl: null,
    reactions: [],
  })),
});
const round = (pages: Record<string, RepositoryReleaseLookup>): ReleaseTimeline => ({
  ...timelineUtils.assembleReleaseTimeline(
    Object.keys(pages).map((id) => ({ id, owner: 'octo', name: id })),
    pages,
    { timeZone: 'UTC' }
  ),
  pages,
});
const dates = (view: ReturnType<ReturnType<typeof createHarness>['open']>['view']) =>
  view.groups.value.flatMap((group) => group.items.map((item) => item.tagName));

const searchFilter = () => ({
  repositories: [] as string[],
  dateRange: { from: null as string | null, to: null as string | null },
  query: '',
  hidePrereleases: false,
  includeReleaseNotes: false,
});
const searchPage = (
  repositoryId: string,
  releases: Partial<import('#shared/types/release-follows').RepositoryReleaseItem>[]
) => {
  const page = releasePage(repositoryId, ['2026-10-15'], null);
  return {
    ...page,
    releases: releases.map((release, index) => ({
      ...page.releases[0]!,
      id: index + 1,
      ...release,
    })),
  };
};
const visibleKeys = (view: ReturnType<ReturnType<typeof createHarness>['open']>['view']) =>
  view.visibleGroups.value.flatMap((group) => group.items.map(timelineUtils.timelineReleaseKey));

test('search requires every term on one release across repository, title and tag without fetching', async () => {
  const filter = shallowRef({ ...searchFilter(), query: 'OCTO/widgets 3.12' });
  const app = createHarness(undefined, filter);
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      R_widgets: {
        ...searchPage('R_widgets', [
          { name: 'Autumn improvements', tagName: 'v3.12.0' },
          { name: 'Widgets migration', tagName: 'v2.0.0' },
        ]),
        name: 'widgets',
      },
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual(['R_widgets:1']);
  filter.value = { ...filter.value, query: 'autumn migration' };
  expect(visibleKeys(view)).toEqual([]);
  expect(app.requests).toHaveLength(1);
});

test('search handles literal terms, phrases and numeric version boundaries in the session', async () => {
  const filter = shallowRef(searchFilter());
  const app = createHarness(undefined, filter);
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      R_widgets: {
        ...searchPage('R_widgets', [
          { name: 'Node.js AUTH_TOKEN 搜索改进 for R', tagName: 'v3.12.0' },
          { name: 'preact caching\n  improvements 搜索 支持 C', tagName: 'v3.120.0' },
          { name: 'caching scattered improvements', tagName: 'v13.12.0' },
          { name: '   ', tagName: '3.12.1' },
        ]),
        owner: 'Example',
        name: 'widgets',
      },
    })
  );
  await settle();
  const cases: [string, string[]][] = [
    ['example', ['R_widgets:1', 'R_widgets:2', 'R_widgets:3', 'R_widgets:4']],
    ['widg', ['R_widgets:1', 'R_widgets:2', 'R_widgets:3', 'R_widgets:4']],
    ['EXAMPLE/WIDGETS\t\n node.JS    auth_token', ['R_widgets:1']],
    ['nodejs', []],
    ['react', ['R_widgets:2']],
    ['搜索改进', ['R_widgets:1']],
    ['搜索 支持', ['R_widgets:2']],
    ['改', ['R_widgets:1']],
    ['R for', ['R_widgets:1']],
    ['C', ['R_widgets:2', 'R_widgets:3']],
    ['3.12', ['R_widgets:1', 'R_widgets:4']],
    ['v3.12', ['R_widgets:1']],
    ['"3.12"', ['R_widgets:1', 'R_widgets:4']],
    ['3.120', ['R_widgets:2']],
    ['13.12', ['R_widgets:3']],
    ['"caching  improvements"', ['R_widgets:2']],
    ['widgets "caching\n improvements', ['R_widgets:2']],
    ['"widgets node.js"', []],
    ['"improvements caching"', []],
    ['\t \n ', ['R_widgets:1', 'R_widgets:2', 'R_widgets:3', 'R_widgets:4']],
    ['', ['R_widgets:1', 'R_widgets:2', 'R_widgets:3', 'R_widgets:4']],
  ];
  for (const [query, expected] of cases) {
    filter.value = { ...filter.value, query };
    expect(visibleKeys(view), query).toEqual(expected);
  }
  expect(app.requests).toHaveLength(1);
});

test('optional note search uses full readable Markdown and code while excluding invisible markup', async () => {
  const filter = shallowRef(searchFilter());
  const app = createHarness(undefined, filter);
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        {
          name: 'Autumn',
          description: `${'preview '.repeat(80)}Deep feature\n  improvements\n[Readable label](https://hidden-link.example/path)\n![Diagram](https://hidden-image.example/pic)\n[Reference label][ref]\n\n[ref]: https://reference-destination.example\n\n<strong data-hidden="attribute-secret">Visible HTML &amp; text</strong>\n<!-- hidden-comment -->\n<script>hidden-script</script>\n<style>hidden-style</style>\n\n\`AUTH_TOKEN\`\n\n\`\`\`html\n<config>CODE_IDENTIFIER</config>\n\`\`\``,
        },
        { name: 'Other', description: null },
      ]),
    })
  );
  await settle();
  expect(view.groups.value[0]!.items[0]!.changelog).not.toContain('Deep feature');
  filter.value = { ...filter.value, query: 'feature' };
  expect(visibleKeys(view)).toEqual([]);
  filter.value = { ...filter.value, includeReleaseNotes: true };
  expect(visibleKeys(view)).toEqual(['R_widgets:1']);
  const cases: [string, string[]][] = [
    ['octo autumn feature', ['R_widgets:1']],
    ['"feature improvements"', ['R_widgets:1']],
    ['"readable label"', ['R_widgets:1']],
    ['"reference label"', ['R_widgets:1']],
    ['"visible html & text"', ['R_widgets:1']],
    ['AUTH_TOKEN', ['R_widgets:1']],
    ['CODE_IDENTIFIER', ['R_widgets:1']],
    ['"<config>code_identifier</config>"', ['R_widgets:1']],
    ['hidden-link', []],
    ['hidden-image', []],
    ['reference-destination', []],
    ['data-hidden', []],
    ['attribute-secret', []],
    ['strong', []],
    ['hidden-comment', []],
    ['hidden-script', []],
    ['hidden-style', []],
    ['missing', []],
  ];
  for (const [query, expected] of cases) {
    filter.value = { ...filter.value, query };
    expect(visibleKeys(view), query).toEqual(expected);
  }
  filter.value = { ...filter.value, query: 'feature', includeReleaseNotes: false };
  expect(visibleKeys(view)).toEqual([]);
  expect(app.requests).toHaveLength(1);
});

test('notes search ANDs repository, local date and prerelease filters while preserving order and groups', async () => {
  const filter = shallowRef({ ...searchFilter(), query: 'feature', includeReleaseNotes: true });
  const app = createHarness(undefined, filter);
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve({
    ...round({
      A: searchPage('A', [
        { id: 10, publishedAt: '2026-10-15T12:00:00Z', description: 'feature', isPrerelease: true },
        { id: 11, publishedAt: '2026-10-14T12:00:00Z', description: 'feature' },
        { id: 12, publishedAt: '2026-10-13T12:00:00Z', description: 'feature' },
        { id: 13, publishedAt: '2026-10-14T12:00:00Z', description: 'other' },
      ]),
      B: searchPage('B', [{ id: 1, publishedAt: '2026-10-14T12:00:00Z', description: 'feature' }]),
    }),
    refresh: { previousBaseline: '2026-10-14T00:00:00Z', startedAt: '2026-10-16T00:00:00Z' },
  });
  await settle();
  expect(visibleKeys(view)).toEqual(['A:10', 'A:11', 'B:1', 'A:12']);
  expect(view.visibleGroups.value.map((group) => group.date)).toEqual([
    '2026-10-15',
    '2026-10-14',
    '2026-10-13',
  ]);
  expect(view.loadedNewCount.value).toBe(3);
  filter.value = {
    ...filter.value,
    repositories: ['octo/A'],
    dateRange: { from: '2026-10-14', to: '2026-10-14' },
    hidePrereleases: true,
  };
  expect(visibleKeys(view)).toEqual(['A:11']);
  expect(view.visibleGroups.value.map((group) => group.date)).toEqual(['2026-10-14']);
  expect(view.loadedNewCount.value).toBe(1);
  filter.value = { ...filter.value, query: '   ' };
  expect(visibleKeys(view)).toEqual(['A:11', 'A:13']);
  expect(view.loadedNewCount.value).toBe(2);
  expect(app.requests).toHaveLength(1);
});

test('coordinated rounds expose the shared timestamp, retain buffers and resume cached independent cursors', async () => {
  const harness = createHarness();
  harness.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const first = harness.open();
  harness.requests[0]!.resolve(
    round({
      A: releasePage('A', ['2026-10-15', '2026-10-10'], 'A1'),
      B: releasePage('B', ['2026-10-12', '2026-09-01'], 'B1'),
    })
  );
  await settle();
  expect(dates(first.view)).toEqual(['2026-10-15', '2026-10-12', '2026-10-10']);
  expect(first.view.hasMore.value).toBe(true);
  first.close();
  const { view } = harness.open();
  const loading = view.loadOlder();
  expect(harness.requests[1]!.input).toEqual({ cursors: { A: 'A1', B: 'B1' } });
  harness.requests[1]!.resolve(
    round({ A: releasePage('A', ['2026-08-01'], null), B: releasePage('B', [], null) })
  );
  await loading;
  expect(dates(view)).toEqual([
    '2026-10-15',
    '2026-10-12',
    '2026-10-10',
    '2026-09-01',
    '2026-08-01',
  ]);
  expect(view.hasMore.value).toBe(false);
});

test('later pages recover unknown publications, keep cumulative coverage and distinguish buffered cards', async () => {
  const saved: import('../shared/types/timeline-history').RecoveredRelease[] = [];
  const harness = createHarness({
    read: async () => ({ baseline: null, records: [], revision: 0 }),
    merge: async (records) => {
      saved.push(...records);
      return { baseline: null, records: [...saved], revision: 1 };
    },
    clear: async () => ({ baseline: null, records: [], revision: 2 }),
  });
  harness.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = harness.open();
  harness.requests[0]!.resolve({
    ...round({
      A: releasePage('A', ['2026-10-10'], 'A1'),
      B: releasePage('B', ['2026-09-01'], 'B1'),
    }),
    refresh: { previousBaseline: '2026-10-11T00:00:00Z', startedAt: '2026-10-15T00:00:00Z' },
  });
  await settle();
  expect(view.loadedNewCount.value).toBe(0);
  const loading = view.loadOlder();
  harness.requests[1]!.resolve(
    round({ A: releasePage('A', ['2026-10-12'], 'A2'), B: releasePage('B', ['2026-08-01'], 'B2') })
  );
  await loading;
  expect(dates(view)).toEqual(['2026-10-12', '2026-10-10']);
  expect(view.loadedNewCount.value).toBe(1);
  expect(saved.map((item) => item.tagName)).toEqual(['2026-10-12']);
  const rest = view.loadOlder();
  harness.requests[2]!.resolve(
    round({ A: releasePage('A', ['2026-07-01'], null), B: releasePage('B', [], null) })
  );
  await rest;
  expect(dates(view)).toContain('2026-09-01');
  expect(saved).toHaveLength(1);
  expect(view.previousBaseline.value).toBe('2026-10-11T00:00:00Z');
});

test('partial windows do not retract when a missing repository returns and retry only advances its failed cursor', async () => {
  const harness = createHarness();
  harness.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = harness.open();
  harness.requests[0]!.resolve(
    round({ A: releasePage('A', ['2026-10-01'], 'A1'), B: { status: 'transient' } })
  );
  await settle();
  expect(view.partial.value).toBe(true);
  const retry = view.retryFailed();
  expect(harness.requests[1]!.input).toEqual({ cursors: { B: null } });
  harness.requests[1]!.resolve(round({ B: releasePage('B', ['2026-10-12'], 'B1') }));
  await retry;
  expect(dates(view)).toEqual(['2026-10-12', '2026-10-01']);
  expect(view.partial.value).toBe(true);
  const older = view.loadOlder();
  expect(harness.requests[2]!.input).toEqual({ cursors: { A: 'A1', B: 'B1' } });
  harness.requests[2]!.resolve(round({ A: { status: 'transient' }, B: { status: 'transient' } }));
  await older;
  expect(dates(view)).toEqual(['2026-10-12', '2026-10-01']);
  const again = view.retryFailed();
  expect(harness.requests[3]!.input).toEqual({ cursors: { A: 'A1', B: 'B1' } });
  harness.requests[3]!.resolve(
    round({ A: releasePage('A', [], null), B: releasePage('B', ['2026-09-01'], null) })
  );
  await again;
  expect(view.partial.value).toBe(false);
  expect(view.hasMore.value).toBe(false);
});

test('empty displayable pages retain continuation without automatically fetching another page', async () => {
  const harness = createHarness();
  const { view } = harness.open();
  harness.requests[0]!.resolve(round({ R_widgets: releasePage('R_widgets', [], 'next') }));
  await settle();
  expect(view.groups.value).toEqual([]);
  expect(view.hasMore.value).toBe(true);
  expect(harness.requests).toHaveLength(1);
  const load = view.loadOlder();
  harness.requests[1]!.resolve(
    round({ R_widgets: releasePage('R_widgets', ['2026-09-01'], null) })
  );
  await load;
  expect(dates(view)).toEqual(['2026-09-01']);
});

test('hiding prereleases updates the loaded count while retaining manual continuation and original releases', async () => {
  const filter = shallowRef({
    repositories: [] as string[],
    dateRange: { from: null as string | null, to: null as string | null },
    query: '',
    hidePrereleases: false,
  });
  const harness = createHarness(undefined, filter);
  const { view } = harness.open();
  const previewPage = releasePage('R_widgets', ['2026-10-15'], 'next');
  previewPage.releases[0]!.isPrerelease = true;
  harness.requests[0]!.resolve({
    ...round({ R_widgets: previewPage }),
    refresh: { previousBaseline: '2026-10-01T00:00:00Z', startedAt: '2026-10-16T00:00:00Z' },
  });
  await settle();
  expect(view.loadedNewCount.value).toBe(1);
  filter.value = { ...filter.value, hidePrereleases: true };
  await settle();
  expect(view.visibleGroups.value).toEqual([]);
  expect(view.loadedNewCount.value).toBe(0);
  expect(view.hasMore.value).toBe(true);
  expect(harness.requests).toHaveLength(1);
  const load = view.loadOlder();
  expect(harness.requests[1]!.input).toEqual({ cursors: { R_widgets: 'next' } });
  harness.requests[1]!.resolve(
    round({ R_widgets: releasePage('R_widgets', ['2026-10-12'], null) })
  );
  await load;
  expect(
    view.visibleGroups.value.flatMap((group) => group.items.map((item) => item.tagName))
  ).toEqual(['2026-10-12']);
  expect(view.loadedNewCount.value).toBe(1);
  filter.value = { ...filter.value, hidePrereleases: false };
  expect(view.loadedNewCount.value).toBe(2);
  expect(dates(view)).toEqual(['2026-10-15', '2026-10-12']);
});

test('the loaded new count follows repository, local-date and title filters without preventing recovery', async () => {
  const filter = shallowRef({
    repositories: [] as string[],
    dateRange: { from: null as string | null, to: null as string | null },
    query: '',
    hidePrereleases: false,
  });
  const saved: import('../shared/types/timeline-history').RecoveredRelease[] = [];
  const app = createHarness(
    {
      read: async () => ({ baseline: null, records: [], revision: 0 }),
      merge: async (records) => {
        saved.push(...records);
        return { baseline: null, records: saved, revision: 1 };
      },
      clear: async () => ({ baseline: null, records: [], revision: 2 }),
    },
    filter
  );
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve({
    ...round({
      A: releasePage('A', ['2026-10-15', '2026-10-10'], 'A1'),
      B: releasePage('B', ['2026-10-12'], null),
    }),
    refresh: { previousBaseline: '2026-10-11T00:00:00Z', startedAt: '2026-10-16T00:00:00Z' },
  });
  await settle();
  expect(view.loadedNewCount.value).toBe(2);
  expect(view.baselineExposed.value).toBe(true);
  filter.value = { ...filter.value, repositories: ['octo/A'] };
  expect(view.loadedNewCount.value).toBe(1);
  filter.value = { ...filter.value, dateRange: { from: null, to: '2026-10-14' } };
  expect(view.loadedNewCount.value).toBe(0);
  filter.value = {
    ...filter.value,
    repositories: [],
    dateRange: { from: null, to: null },
    query: 'missing',
  };
  expect(view.visibleGroups.value).toEqual([]);
  expect(view.hasMore.value).toBe(true);
  const load = view.loadOlder();
  app.requests[1]!.resolve(round({ A: releasePage('A', ['2026-10-13'], null) }));
  await load;
  expect(saved.map((item) => item.tagName)).toEqual(['2026-10-13']);
  expect(view.loadedNewCount.value).toBe(0);
  filter.value = { ...filter.value, query: '2026-10-13' };
  expect(view.loadedNewCount.value).toBe(1);
});

test('a delayed merge snapshot cannot restore cleared history and a failed save preserves cards for retry after returning', async () => {
  const merge = deferred<import('../shared/types/timeline-history').TimelineHistorySnapshot>();
  let fail = false;
  let merges = 0;
  const app = createHarness({
    read: async () => ({ baseline: null, records: [], revision: 0 }),
    merge: async (records) => {
      merges++;
      if (fail) throw new Error('Save failed');
      if (merges === 1) return merge.promise;
      return { baseline: null, records, revision: 4 };
    },
    clear: async () => ({ baseline: null, records: [], revision: 3 }),
  });
  const first = app.open();
  app.requests[0]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-10'], 'first') }));
  await settle();
  const loading = first.view.loadOlder();
  app.requests[1]!.resolve(
    round({ R_widgets: releasePage('R_widgets', ['2026-10-12'], 'second') })
  );
  await settle();
  await first.view.clearRecovered();
  merge.resolve({
    baseline: null,
    revision: 2,
    records: [{ ...first.view.groups.value[0]!.items[0]!, discoveredAt: '2026-10-15T00:00:00Z' }],
  });
  await loading;
  expect(first.view.recoveredRecords.value).toEqual([]);
  fail = true;
  const next = first.view.loadOlder();
  app.requests[2]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-14'], null) }));
  await next;
  expect(first.view.persistenceError.value).toBe('Save failed');
  expect(dates(first.view)).toContain('2026-10-14');
  first.close();
  fail = false;
  const second = app.open();
  await second.view.retryPersistence();
  expect(second.view.recoveredRecords.value.map((item) => item.tagName)).toEqual(['2026-10-14']);
  expect(second.view.persistenceError.value).toBeNull();
});

test('clearing history completes across leaving and returning without hiding a failed baseline save', async () => {
  const clear = deferred<import('../shared/types/timeline-history').TimelineHistorySnapshot>();
  const retained = {
    ...timelineUtils.assembleReleaseTimeline(
      [repository],
      { R_widgets: releasePage('R_widgets', ['2026-10-12'], null) },
      { timeZone: 'UTC' }
    ).groups[0]!.items[0]!,
    discoveredAt: '2026-10-15T00:00:00Z',
  };
  const app = createHarness({
    read: async () => ({ baseline: null, revision: 1, records: [retained] }),
    clear: () => clear.promise,
    merge: async () => ({ baseline: null, revision: 1, records: [retained] }),
  });
  const first = app.open();
  app.requests[0]!.resolve({
    ...round({ R_widgets: releasePage('R_widgets', [], null) }),
    persistenceError: 'Baseline save failed',
  });
  await settle();
  const clearing = first.view.clearRecovered();
  first.close();
  const second = app.open();
  await settle();
  expect(second.view.clearingHistory.value).toBe(true);
  clear.resolve({ baseline: null, revision: 2, records: [] });
  await clearing;
  expect(second.view.recoveredRecords.value).toEqual([]);
  expect(second.view.persistenceError.value).toBe('Baseline save failed');
  expect(second.view.clearingHistory.value).toBe(false);
});

test('successful retry removes the retry action after a wholly failed refresh', async () => {
  const app = createHarness();
  const { view } = app.open();
  app.requests[0]!.resolve(round({ R_widgets: { status: 'transient' } }));
  await settle();
  expect(view.canRetry.value).toBe(true);
  const retry = view.retryFailed();
  app.requests[1]!.resolve(round({ R_widgets: releasePage('R_widgets', [], null) }));
  await retry;
  expect(view.canRetry.value).toBe(false);
});

test('an incomplete page exposes its usable cards but retries the same cursor until the full page succeeds', async () => {
  const app = createHarness();
  const { view } = app.open();
  app.requests[0]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-10'], 'first') }));
  await settle();
  const next = view.loadOlder();
  app.requests[1]!.resolve(
    round({
      R_widgets: {
        ...releasePage('R_widgets', ['2026-10-12'], 'second'),
        incomplete: true,
      } as RepositoryReleaseLookup,
    })
  );
  await next;
  expect(dates(view)).toContain('2026-10-12');
  expect(view.canRetry.value).toBe(true);
  const retry = view.retryFailed();
  expect(app.requests[2]!.input).toEqual({ cursors: { R_widgets: 'first' } });
  app.requests[2]!.resolve(
    round({ R_widgets: releasePage('R_widgets', ['2026-10-12', '2026-09-01'], null) })
  );
  await retry;
  expect(dates(view)).toEqual(['2026-10-12', '2026-10-10', '2026-09-01']);
  expect(view.canRetry.value).toBe(false);
});

test('account switching rejects a pending history mutation even when follows match', async () => {
  const merge = deferred<import('../shared/types/timeline-history').TimelineHistorySnapshot>();
  const app = createHarness({
    read: async () => ({ baseline: null, revision: 0, records: [] }),
    merge: () => merge.promise,
    clear: async () => ({ baseline: null, revision: 1, records: [] }),
  });
  const { view } = app.open();
  app.requests[0]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-10'], 'first') }));
  await settle();
  const loading = view.loadOlder();
  app.requests[1]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-12'], null) }));
  await settle();
  const oldRecord = { ...view.groups.value[0]!.items[0]!, discoveredAt: '2026-10-15T00:00:00Z' };
  app.login.value = 'other';
  await settle();
  merge.resolve({ baseline: null, revision: 10, records: [oldRecord] });
  await loading;
  expect(view.recoveredRecords.value).toEqual([]);
  app.requests[2]!.resolve(round({ R_widgets: releasePage('R_widgets', [], null) }));
  await settle();
  expect(view.recoveredRecords.value).toEqual([]);
});

test('equal-time cards remain visible and the refresh marker is exposed only after loading its timestamp', async () => {
  const app = createHarness();
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve({
    ...round({
      A: releasePage('A', ['2026-10-10'], 'A1'),
      B: releasePage('B', ['2026-10-10', '2026-09-01'], 'B1'),
    }),
    refresh: { previousBaseline: '2026-10-01T00:00:00Z', startedAt: '2026-10-15T00:00:00Z' },
  });
  await settle();
  expect(dates(view)).toEqual(['2026-10-10', '2026-10-10']);
  expect(view.baselineExposed.value).toBe(false);
  expect(view.loadedNewCount.value).toBe(2);
  const older = view.loadOlder();
  app.requests[1]!.resolve(round({ A: releasePage('A', [], null), B: releasePage('B', [], null) }));
  await older;
  expect(view.baselineExposed.value).toBe(true);
});

test('notes search preserves the loaded window until an explicit older round reveals buffered matches', async () => {
  const filter = shallowRef(searchFilter());
  const app = createHarness(undefined, filter);
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve({
    ...round({
      A: {
        ...searchPage('A', [
          {
            id: 1,
            publishedAt: '2026-10-15T12:00:00Z',
            description: `${'intro '.repeat(120)}visibleword`,
          },
          {
            id: 2,
            publishedAt: '2026-10-08T12:00:00Z',
            description: `${'intro '.repeat(120)}bufferword`,
          },
        ]),
        hasOlderReleases: true,
        endCursor: 'A1',
      },
      B: releasePage('B', ['2026-10-10'], 'B1'),
    }),
    refresh: { previousBaseline: '2026-10-09T00:00:00Z', startedAt: '2026-10-16T00:00:00Z' },
  });
  await settle();
  expect(visibleKeys(view)).toEqual(['A:1', 'B:20261010']);
  expect(view.loadedNewCount.value).toBe(2);
  expect(view.baselineExposed.value).toBe(false);
  filter.value = { ...filter.value, query: 'bufferword', includeReleaseNotes: true };
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  expect(view.hasMore.value).toBe(true);
  expect(view.baselineExposed.value).toBe(false);
  expect(view.loadedNewCount.value).toBe(0);
  filter.value = { ...filter.value, query: 'visibleword' };
  expect(visibleKeys(view)).toEqual(['A:1']);
  expect(view.loadedNewCount.value).toBe(1);
  filter.value = { ...filter.value, includeReleaseNotes: false };
  expect(visibleKeys(view)).toEqual([]);
  filter.value = { ...filter.value, query: 'bufferword', includeReleaseNotes: true };
  await settle();
  expect(app.requests).toHaveLength(1);
  const older = view.loadOlder();
  expect(app.requests[1]!.input).toEqual({ cursors: { A: 'A1', B: 'B1' } });
  app.requests[1]!.resolve(round({ A: releasePage('A', [], null), B: releasePage('B', [], null) }));
  await older;
  expect(visibleKeys(view)).toEqual(['A:2']);
  expect(view.hasMore.value).toBe(false);
  expect(view.baselineExposed.value).toBe(true);
  expect(view.loadedNewCount.value).toBe(0);
});

test('notes matches remain isolated when repositories contain the same numeric release id', async () => {
  const filter = shallowRef({ ...searchFilter(), query: 'heliopause', includeReleaseNotes: true });
  const app = createHarness(undefined, filter);
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      A: searchPage('A', [{ id: 7, description: `${'intro '.repeat(120)}heliopause` }]),
      B: searchPage('B', [{ id: 7, description: `${'intro '.repeat(120)}magnetopause` }]),
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual(['A:7']);
  filter.value = { ...filter.value, query: 'magnetopause' };
  expect(visibleKeys(view)).toEqual(['B:7']);
  filter.value = { ...filter.value, query: 'heliopause magnetopause' };
  expect(visibleKeys(view)).toEqual([]);
  expect(app.requests).toHaveLength(1);
});

test('an empty notes search retains partial coverage and allows explicit retry and older loading', async () => {
  const filter = shallowRef({ ...searchFilter(), query: 'needle', includeReleaseNotes: true });
  const app = createHarness(undefined, filter);
  app.repositories.value = [
    { id: 'A', owner: 'octo', name: 'A' },
    { id: 'B', owner: 'octo', name: 'B' },
  ];
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      A: {
        ...searchPage('A', [{ id: 1, description: 'ordinary changes' }]),
        hasOlderReleases: true,
        endCursor: 'A1',
      },
      B: { status: 'transient' },
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  expect(view.partial.value).toBe(true);
  expect(view.canRetry.value).toBe(true);
  expect(view.hasMore.value).toBe(true);
  expect(app.requests).toHaveLength(1);
  const retry = view.retryFailed();
  expect(app.requests[1]!.input).toEqual({ cursors: { B: null } });
  app.requests[1]!.resolve(
    round({
      B: searchPage('B', [
        {
          id: 2,
          publishedAt: '2026-10-16T12:00:00Z',
          description: `${'intro '.repeat(120)}needle`,
        },
      ]),
    })
  );
  await retry;
  expect(visibleKeys(view)).toEqual(['B:2']);
  expect(view.partial.value).toBe(false);
  expect(view.canRetry.value).toBe(false);
  filter.value = { ...filter.value, query: 'olderneedle' };
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  expect(view.hasMore.value).toBe(true);
  expect(app.requests).toHaveLength(2);
  const older = view.loadOlder();
  expect(app.requests[2]!.input).toEqual({ cursors: { A: 'A1' } });
  app.requests[2]!.resolve(
    round({
      A: searchPage('A', [
        {
          id: 3,
          publishedAt: '2026-10-12T12:00:00Z',
          description: `${'intro '.repeat(120)}olderneedle`,
        },
      ]),
    })
  );
  await older;
  expect(visibleKeys(view)).toEqual(['A:3']);
  expect(view.partial.value).toBe(false);
  expect(view.hasMore.value).toBe(false);
});

test('refresh replaces searchable notes when the repository and release ids stay the same', async () => {
  const filter = shallowRef({
    ...searchFilter(),
    query: 'retiredtoken',
    includeReleaseNotes: true,
  });
  const app = createHarness(undefined, filter);
  const { view } = app.open();
  app.requests[0]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        { id: 41, description: `${'intro '.repeat(120)}retiredtoken` },
      ]),
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual(['R_widgets:41']);
  const refresh = view.fetchTimeline();
  app.requests[1]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        { id: 41, description: `${'intro '.repeat(120)}replacementtoken` },
      ]),
    })
  );
  await refresh;
  expect(visibleKeys(view)).toEqual([]);
  filter.value = { ...filter.value, query: 'replacementtoken' };
  expect(visibleKeys(view)).toEqual(['R_widgets:41']);
  expect(app.requests).toHaveLength(2);
});

test('cached notes survive returning to the view and are discarded across account and logout changes', async () => {
  const filter = shallowRef({
    ...searchFilter(),
    query: 'firstaccount',
    includeReleaseNotes: true,
  });
  const app = createHarness(undefined, filter);
  const first = app.open();
  app.requests[0]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        { id: 41, description: `${'intro '.repeat(120)}firstaccount` },
      ]),
    })
  );
  await settle();
  expect(visibleKeys(first.view)).toEqual(['R_widgets:41']);
  first.close();
  const { view } = app.open();
  await settle();
  expect(visibleKeys(view)).toEqual(['R_widgets:41']);
  expect(app.requests).toHaveLength(1);
  app.login.value = 'other';
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  app.requests[1]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        { id: 41, description: `${'intro '.repeat(120)}secondaccount` },
      ]),
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  filter.value = { ...filter.value, query: 'secondaccount' };
  expect(visibleKeys(view)).toEqual(['R_widgets:41']);
  app.login.value = null;
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  app.login.value = 'other';
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  app.requests[2]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        { id: 41, description: `${'intro '.repeat(120)}newsession` },
      ]),
    })
  );
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  filter.value = { ...filter.value, query: 'newsession' };
  expect(visibleKeys(view)).toEqual(['R_widgets:41']);
  expect(app.requests).toHaveLength(3);
});

test('notes search does not filter or suppress recovered release history', async () => {
  const filter = shallowRef({ ...searchFilter(), query: 'absent', includeReleaseNotes: true });
  const saved: import('#shared/types/timeline-history').RecoveredRelease[] = [];
  const app = createHarness(
    {
      read: async () => ({ baseline: null, records: [], revision: 0 }),
      merge: async (records) => {
        saved.push(...records);
        return { baseline: null, records: saved, revision: 1 };
      },
      clear: async () => ({ baseline: null, records: [], revision: 2 }),
    },
    filter
  );
  const { view } = app.open();
  app.requests[0]!.resolve(round({ R_widgets: releasePage('R_widgets', ['2026-10-10'], 'next') }));
  await settle();
  expect(visibleKeys(view)).toEqual([]);
  const older = view.loadOlder();
  app.requests[1]!.resolve(
    round({
      R_widgets: searchPage('R_widgets', [
        {
          id: 2,
          publishedAt: '2026-10-12T12:00:00Z',
          description: `${'intro '.repeat(120)}recoveredneedle`,
        },
      ]),
    })
  );
  await older;
  expect(visibleKeys(view)).toEqual([]);
  expect(view.recoveredRecords.value.map(timelineUtils.timelineReleaseKey)).toEqual([
    'R_widgets:2',
  ]);
  filter.value = { ...filter.value, query: 'recoveredneedle' };
  expect(visibleKeys(view)).toEqual(['R_widgets:2']);
  expect(view.recoveredRecords.value.map(timelineUtils.timelineReleaseKey)).toEqual([
    'R_widgets:2',
  ]);
  filter.value = { ...filter.value, includeReleaseNotes: false };
  expect(visibleKeys(view)).toEqual([]);
  expect(view.recoveredRecords.value.map(timelineUtils.timelineReleaseKey)).toEqual([
    'R_widgets:2',
  ]);
  expect(app.requests).toHaveLength(2);
});
