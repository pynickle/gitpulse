import { afterEach, describe, expect, mock, test } from 'bun:test';

import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue';

import type { FollowedRepository, ReleaseTimeline } from '#shared/types/release-follows';

import * as timelineUtils from '../shared/utils/release-timeline';

mock.module('#shared/utils/release-timeline', () => timelineUtils);

const { createReleaseTimelineSession } =
  await import('../app/composables/release-timeline/session');

const scopes: EffectScope[] = [];
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
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

function createHarness() {
  const login = shallowRef<string | null>('octocat');
  const loaded = shallowRef(true);
  const repositories = shallowRef([repository]);
  const cache = shallowRef<
    import('../app/composables/release-timeline/session').ReleaseTimelineSessionEntry | null
  >(null);
  const requests: ReturnType<typeof deferred<ReleaseTimeline>>[] = [];
  const unavailableIds = shallowRef<string[]>([]);
  const transientIds = shallowRef<string[]>([]);
  const open = () => {
    const scope = effectScope();
    scopes.push(scope);
    const view = scope.run(() =>
      createReleaseTimelineSession({
        login,
        loaded,
        repositories,
        cache,
        load: () => {
          const request = deferred<ReleaseTimeline>();
          requests.push(request);
          return request.promise;
        },
        lookups: {
          unavailableIds,
          transientIds,
          applyLookupIds: (unavailable, transient) => {
            unavailableIds.value = unavailable;
            transientIds.value = transient;
          },
        },
        describeError: (error) => (error instanceof Error ? error.message : 'An error occurred'),
      })
    )!;
    return { view, close: () => scope.stop() };
  };
  return { login, loaded, repositories, requests, open };
}

const settle = async () => {
  await Promise.resolve();
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
    expect(second.view.hasLookupFailures.value).toBe(false);
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
    expect(second.view.hasLookupFailures.value).toBe(false);
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
