import { afterEach, expect, mock, test } from 'bun:test';

import { computed, defineComponent, getCurrentInstance, h, nextTick, shallowRef } from 'vue';

import type {
  FollowedRepository,
  LookupClassification,
  ReleaseTimeline,
} from '#shared/types/release-follows';

import { createFollowedRepositoryHttpAdapter } from '../app/composables/followed-repositories/httpAdapter';
import { getFollowedRepositoryQueries } from '../app/composables/followed-repositories/queries';
import {
  createReleaseTimelineSession,
  type ReleaseTimelineSessionEntry,
} from '../app/composables/release-timeline/session';
import * as followUtils from '../shared/utils/release-follows';
import { createVueDom } from './helpers/vue-dom';

// Bun does not resolve Nuxt's generated aliases; bind the real shared implementation.
mock.module('#shared/utils/release-follows', () => followUtils);
const { getFollowAddBlock } = await import('#shared/utils/release-follows');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function harness(count = 100, initialLoaded = true) {
  const dom = createVueDom();
  cleanups.push(dom.cleanup);
  const login = shallowRef<string | null>('octocat');
  const loaded = shallowRef(initialLoaded);
  const repositories = shallowRef<FollowedRepository[]>(
    Array.from({ length: count }, (_, i) => ({ id: `R${i}`, owner: 'octo', name: `repo${i}` }))
  );
  const identities: ReturnType<typeof deferred<LookupClassification & { renamed?: boolean }>>[] =
    [];
  const timelines: ReturnType<typeof deferred<ReleaseTimeline>>[] = [];
  const settingsRequests: { force?: boolean; result: ReturnType<typeof deferred<void>> }[] = [];
  const options = {
    login,
    loaded,
    repositories,
    loadSettings: (options?: { force?: boolean }) => {
      const result = deferred<void>();
      settingsRequests.push({ ...options, result });
      return result.promise;
    },
    adapter: {
      identities: () => {
        const request = deferred<LookupClassification & { renamed?: boolean }>();
        identities.push(request);
        return request.promise;
      },
      timeline: () => {
        const request = deferred<ReleaseTimeline>();
        timelines.push(request);
        return request.promise;
      },
    },
  };
  let queries!: ReturnType<typeof getFollowedRepositoryQueries>;
  const visible = shallowRef(true);
  const cache = shallowRef<ReleaseTimelineSessionEntry | null>(null);
  let view!: ReturnType<typeof createReleaseTimelineSession>;
  const timelineVisible = shallowRef(false);
  const consumer = defineComponent({
    setup() {
      queries = getFollowedRepositoryQueries(getCurrentInstance()!.appContext.app, options);
      return () => h('div');
    },
  });
  const timelineConsumer = defineComponent({
    setup() {
      const lookups = getFollowedRepositoryQueries(getCurrentInstance()!.appContext.app, options);
      view = createReleaseTimelineSession({
        login,
        loaded,
        repositories,
        cache,
        lookups,
        describeError: (error) => (error as Error).message,
      });
      return () => h('div');
    },
  });
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h('div', [
          visible.value ? h(consumer) : null,
          timelineVisible.value ? h(timelineConsumer) : null,
        ]),
    })
  );
  const openTimeline = async () => {
    timelineVisible.value = true;
    await nextTick();
    return view;
  };
  const closeTimeline = async () => {
    timelineVisible.value = false;
    await nextTick();
  };
  const addBlock = computed(() =>
    getFollowAddBlock(repositories.value, queries.unavailableIdSet.value)
  );
  return {
    ...options,
    queries,
    identities,
    timelines,
    addBlock,
    mounted,
    visible,
    settingsRequests,
    cache,
    openTimeline,
    closeTimeline,
  };
}

const available = (ids = ['R0']): LookupClassification => ({
  availableIds: ids,
  unavailableIds: [],
  transientIds: [],
});
const unavailable = (): LookupClassification => ({
  availableIds: [],
  unavailableIds: ['R0'],
  transientIds: [],
});
const releases = (): ReleaseTimeline => ({
  groups: [{ date: '2026-10-07', items: [] }],
  unavailableIds: [],
  transientIds: [],
});
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await nextTick();
};

test('an older identity response cannot free a slot after Timeline confirms 100 available follows', async () => {
  const app = harness();
  const identity = app.queries.fetchIdentities();
  const timeline = app.queries.fetchTimeline();
  app.timelines[0]!.resolve({ groups: [], unavailableIds: [], transientIds: [] });
  await timeline;
  app.identities[0]!.resolve({ availableIds: [], unavailableIds: ['R0'], transientIds: [] });
  await identity;
  expect(app.queries.unavailableIds.value).toEqual([]);
  expect(app.addBlock.value).toBe('valid-cap');
});

test.each(['identity-identity', 'identity-timeline', 'timeline-identity', 'timeline-timeline'])(
  '%s queries preserve current classification while pending and only accept the last dispatch',
  async (sources) => {
    for (const reverse of [false, true]) {
      const app = harness(1);
      const seed = app.queries.fetchIdentities();
      app.identities[0]!.resolve(unavailable());
      await seed;
      const start = (source: string) => {
        const promise =
          source === 'identity' ? app.queries.fetchIdentities() : app.queries.fetchTimeline();
        const transport = source === 'identity' ? app.identities.at(-1)! : app.timelines.at(-1)!;
        return { promise, transport };
      };
      const [first, second] = sources.split('-');
      const old = start(first!);
      const latest = start(second!);
      expect(app.queries.unavailableIds.value).toEqual(['R0']);
      const finishOld = async () => {
        old.transport.resolve({ ...releases(), ...unavailable() });
        await old.promise;
      };
      if (!reverse) {
        await finishOld();
        expect(app.queries.unavailableIds.value).toEqual(['R0']);
      }
      latest.transport.resolve({ ...releases(), ...available() });
      await latest.promise;
      if (reverse) await finishOld();
      expect(app.queries.unavailableIds.value).toEqual([]);
      expect(app.queries.transientIds.value).toEqual([]);
    }
  }
);

test.each(['success', 'failure', 'partial'] as const)(
  'latest failure never restores the older %s result',
  async (outcome) => {
    const app = harness(2);
    const old = app.queries.fetchIdentities();
    const latest = app.queries.fetchTimeline();
    const error = new Error('rate limited');
    const observed = latest.catch((reason) => reason);
    app.timelines[0]!.reject(error);
    expect(await observed).toBe(error);
    if (outcome === 'failure') app.identities[0]!.reject(new Error('old failure'));
    else
      app.identities[0]!.resolve(
        outcome === 'success' ? unavailable() : { ...unavailable(), transientIds: ['R1'] }
      );
    await old;
    expect(app.queries.unavailableIds.value).toEqual([]);
    expect(app.queries.transientIds.value).toEqual(['R0', 'R1']);
  }
);

test.each(['account', 'logout', 'collection'] as const)(
  '%s round trips immediately invalidate old requests without a Timeline',
  async (change) => {
    const app = harness(1);
    const old = app.queries.fetchIdentities();
    if (change === 'collection') {
      const repos = app.repositories.value;
      app.repositories.value = [];
      app.repositories.value = repos;
    } else {
      app.login.value = change === 'logout' ? null : 'hubot';
      app.login.value = 'octocat';
    }
    app.identities[0]!.resolve({ ...unavailable(), renamed: true });
    await old;
    expect(app.queries.unavailableIds.value).toEqual([]);
    expect(app.settingsRequests).toHaveLength(0);
    const fill = app.queries.ensureClassification();
    expect(app.identities).toHaveLength(2);
    app.identities[1]!.resolve(available());
    await fill;
  }
);

test('collection edits preserve the intersection; renames and reordering preserve in-flight eligibility', async () => {
  const app = harness(100);
  const seed = app.queries.fetchIdentities();
  app.identities[0]!.resolve(unavailable());
  await seed;
  expect(app.addBlock.value).toBeNull();
  const old = app.queries.fetchIdentities();
  app.repositories.value = [...app.repositories.value, { id: 'new', owner: 'octo', name: 'new' }];
  expect(app.queries.unavailableIds.value).toEqual(['R0']);
  expect(app.addBlock.value).toBe('valid-cap');
  app.identities[1]!.resolve(available());
  await old;
  expect(app.queries.unavailableIds.value).toEqual(['R0']);
  const current = app.queries.fetchIdentities();
  app.repositories.value = app.repositories.value
    .map((repo) => ({ ...repo, owner: 'renamed', name: 'changed' }))
    .reverse();
  app.identities[2]!.resolve({ ...available(), unavailableIds: ['new'] });
  await current;
  expect(app.queries.unavailableIds.value).toEqual(['new']);
  app.repositories.value = app.repositories.value.filter((repo) => repo.id !== 'new');
  expect(app.queries.unavailableIds.value).toEqual([]);
  app.repositories.value = [];
  expect(app.queries.transientIds.value).toEqual([]);
  await Promise.all([
    app.queries.fetchIdentities(),
    app.queries.fetchTimeline(),
    app.queries.ensureClassification(),
  ]);
  expect(app.identities).toHaveLength(3);
  expect(app.timelines).toHaveLength(0);
});

test('unknown and transient follows consume valid slots; unavailable follows still consume stored slots', async () => {
  const app = harness(100);
  expect(app.addBlock.value).toBe('valid-cap');
  const query = app.queries.fetchIdentities();
  app.identities[0]!.resolve({
    availableIds: [],
    unavailableIds: ['R0', 'outside'],
    transientIds: ['R1', 'outside'],
  });
  await query;
  expect(app.queries.unavailableIds.value).toEqual(['R0']);
  expect(app.queries.transientIds.value).toHaveLength(99);
  expect(app.addBlock.value).toBeNull();
  app.repositories.value = Array.from({ length: 150 }, (_, i) => ({
    id: `R${i}`,
    owner: 'octo',
    name: `repo${i}`,
  }));
  expect(app.addBlock.value).toBe('stored-cap');
});

test('background consumers share a query and follow its replacement without waiting for the old response', async () => {
  const app = harness(1);
  const fills = [app.queries.ensureClassification(), app.queries.ensureClassification()];
  expect(app.identities).toHaveLength(1);
  const newer = app.queries.fetchTimeline();
  app.timelines[0]!.resolve(releases());
  await newer;
  await Promise.all(fills);
  expect(app.identities).toHaveLength(1);
  app.identities[0]!.resolve(unavailable());
  await settle();
  expect(app.queries.unavailableIds.value).toEqual([]);
});

test('background reuse consumes a failed Timeline wait while its caller receives the original error', async () => {
  const app = harness(1);
  const timeline = app.queries.fetchTimeline();
  const error = new Error('network');
  const observed = timeline.catch((reason) => reason);
  const fills = [app.queries.ensureClassification(), app.queries.ensureClassification()];
  app.timelines[0]!.reject(error);
  expect(await observed).toBe(error);
  await Promise.all(fills);
  await app.queries.ensureClassification();
  expect(app.identities).toHaveLength(0);
  expect(app.queries.transientIds.value).toEqual(['R0']);
  const retry = app.queries.fetchIdentities();
  app.identities[0]!.resolve(available());
  await retry;
  expect(app.queries.transientIds.value).toEqual([]);
});

test('background identity failure is queried once, with explicit retry available', async () => {
  const app = harness(1);
  const fill = app.queries.ensureClassification();
  app.identities[0]!.reject(new Error('offline'));
  await fill;
  await app.queries.ensureClassification();
  expect(app.identities).toHaveLength(1);
  const retry = app.queries.fetchIdentities();
  app.identities[1]!.resolve(available());
  await retry;
  expect(app.queries.transientIds.value).toEqual([]);
});

test('classification survives its first consumer and is shared with later consumers; app destruction rejects writes', async () => {
  const app = harness(1);
  const query = app.queries.fetchIdentities();
  app.visible.value = false;
  await nextTick();
  app.identities[0]!.resolve(unavailable());
  await query;
  expect(app.queries.unavailableIds.value).toEqual(['R0']);
  app.cache.value = { login: 'octocat', followKey: 'R0', timeline: releases() };
  const view = await app.openTimeline();
  expect(view.unavailableRepos.value).toEqual(app.repositories.value);
  await app.closeTimeline();
  app.login.value = 'hubot';
  expect(app.queries.unavailableIds.value).toEqual([]);
  const pending = app.queries.fetchIdentities();
  app.mounted.unmount();
  app.identities[1]!.resolve(unavailable());
  await pending;
  expect(app.queries.unavailableIds.value).toEqual([]);
  await app.queries.fetchIdentities();
  expect(app.identities).toHaveLength(2);
});

test('different apps never share classifications or request priority', async () => {
  const first = harness(1);
  const second = harness(1);
  const a = first.queries.fetchIdentities();
  const b = second.queries.fetchIdentities();
  first.identities[0]!.resolve(unavailable());
  await a;
  expect(second.queries.unavailableIds.value).toEqual([]);
  second.identities[0]!.resolve(available());
  await b;
  expect(first.queries.unavailableIds.value).toEqual(['R0']);
});

test.each(['success', 'failure', 'account', 'empty'] as const)(
  'settings wait: %s only dispatches for the original loaded account',
  async (outcome) => {
    const app = harness(1, false);
    const query = app.queries.fetchTimeline();
    expect(app.timelines).toHaveLength(0);
    if (outcome === 'failure') app.settingsRequests[0]!.result.reject(new Error('settings failed'));
    else {
      if (outcome === 'account') {
        app.login.value = null;
        app.login.value = 'octocat';
      }
      if (outcome === 'empty') app.repositories.value = [];
      app.loaded.value = true;
      app.settingsRequests[0]!.result.resolve();
    }
    await settle();
    if (outcome === 'success') {
      expect(app.timelines).toHaveLength(1);
      app.timelines[0]!.resolve(releases());
      expect(await query).toEqual(releases());
    } else {
      expect(await query).toBeNull();
      expect(app.timelines).toHaveLength(0);
    }
  }
);

test('only an accepted identity rename reloads client settings', async () => {
  const app = harness(1);
  const old = app.queries.fetchIdentities();
  const current = app.queries.fetchIdentities();
  app.identities[0]!.resolve({ ...available(), renamed: true });
  await old;
  expect(app.settingsRequests).toHaveLength(0);
  app.identities[1]!.resolve({ ...available(), renamed: true });
  await settle();
  expect(app.settingsRequests[0]!.force).toBe(true);
  app.settingsRequests[0]!.result.resolve();
  await current;
});

test.each(['fetchIdentities', 'fetchTimeline', 'ensureClassification'] as const)(
  'an account change as settings settle cannot dispatch %s for the new session',
  async (action) => {
    const app = harness(1, false);
    const query = app.queries[action]();
    void app.settingsRequests[0]!.result.promise.then(() => {
      app.login.value = null;
      app.login.value = 'octocat';
    });
    app.loaded.value = true;
    app.settingsRequests[0]!.result.resolve();
    await settle();
    expect(app.timelines).toHaveLength(0);
    expect(app.identities).toHaveLength(0);
    expect(await query).toBe(action === 'fetchTimeline' ? null : undefined);
  }
);

test.each(['success', 'failure'] as const)(
  'later identity classification cannot swallow Timeline content %s',
  async (outcome) => {
    const app = harness(1);
    const view = await app.openTimeline();
    const identity = app.queries.fetchIdentities();
    app.identities[0]!.resolve(unavailable());
    await identity;
    if (outcome === 'success') app.timelines[0]!.resolve(releases());
    else app.timelines[0]!.reject(new Error('original error'));
    await settle();
    expect(view.unavailableRepos.value).toEqual(app.repositories.value);
    expect(view.groups.value).toEqual(outcome === 'success' ? releases().groups : []);
    expect(view.error.value).toBe(outcome === 'success' ? null : 'original error');
  }
);

test('returning restores cached content immediately without restoring its old classification', async () => {
  const app = harness(1);
  await app.openTimeline();
  app.timelines[0]!.resolve(releases());
  await settle();
  await app.closeTimeline();
  const identity = app.queries.fetchIdentities();
  app.identities[0]!.resolve(unavailable());
  await identity;
  const view = await app.openTimeline();
  expect(view.groups.value).toEqual(releases().groups);
  expect(view.unavailableRepos.value).toEqual(app.repositories.value);
  expect(app.timelines).toHaveLength(1);
  expect(app.identities).toHaveLength(1);
});

test('cached content displays while missing classifications are filled once in the background', async () => {
  const app = harness(100);
  app.cache.value = {
    login: 'octocat',
    followKey: app.repositories.value
      .map((repo) => repo.id)
      .sort()
      .join('\0'),
    timeline: releases(),
  };
  const view = await app.openTimeline();
  expect(view.groups.value).toEqual(releases().groups);
  expect(view.loading.value).toBe(false);
  expect(app.addBlock.value).toBe('valid-cap');
  expect(app.timelines).toHaveLength(0);
  expect(app.identities).toHaveLength(1);
  const fill = app.queries.ensureClassification();
  app.identities[0]!.resolve(unavailable());
  await fill;
  expect(view.unavailableRepos.value).toEqual([app.repositories.value[0]!]);
});

test('an unmounted Timeline accepts shared classification but leaves its view and cache untouched', async () => {
  const app = harness(1);
  const view = await app.openTimeline();
  await app.closeTimeline();
  app.timelines[0]!.resolve({ ...releases(), unavailableIds: ['R0'] });
  await settle();
  expect(app.queries.unavailableIds.value).toEqual(['R0']);
  expect(view.groups.value).toEqual([]);
  expect(app.cache.value).toBeNull();
});

test('the production adapter owns identity and timezone-aware Timeline requests', async () => {
  const paths: string[] = [];
  const adapter = createFollowedRepositoryHttpAdapter(async <T>(path: string): Promise<T> => {
    paths.push(path);
    return (path === '/api/release-follows/identities' ? available() : releases()) as T;
  });
  expect(await adapter.identities()).toEqual(available());
  expect(await adapter.timeline()).toEqual(releases());
  expect(paths[0]).toBe('/api/release-follows/identities');
  const url = new URL(paths[1]!, 'https://gitpulse.example');
  expect(url.pathname).toBe('/api/release-timeline');
  expect(url.searchParams.get('timeZone')).toBe(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
});

test('an action that cannot dispatch retains already displayed Timeline content without an error', async () => {
  const app = harness(1);
  const view = await app.openTimeline();
  app.timelines[0]!.resolve(releases());
  await settle();
  // Settings become unavailable before an explicit refresh can start.
  app.loaded.value = false;
  await view.fetchTimeline();
  expect(app.timelines).toHaveLength(1);
  expect(view.error.value).toBeNull();
  // The settings watcher owns hiding/restoring content while settings are unloaded.
  app.loaded.value = true;
  await settle();
  expect(view.groups.value).toEqual(releases().groups);
});
