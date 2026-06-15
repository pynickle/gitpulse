import { describe, expect, test } from 'bun:test';

import { ref } from 'vue';

import { useRefreshableView } from '../app/composables/useRefreshableView';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe('useRefreshableView', () => {
  test('uses the first remote freshness snapshot as the baseline when no local signature exists', async () => {
    const snapshots = ['remote-a', 'remote-b'];
    const view = useRefreshableView({
      refresh: async () => undefined,
      checkFreshness: async () => snapshots.shift(),
    });

    await view.checkForFreshness();
    expect(view.hasNewContent.value).toBe(false);

    await view.checkForFreshness();
    expect(view.hasNewContent.value).toBe(true);
  });

  test('marks new content when remote signature differs from the current baseline', async () => {
    const currentSignature = ref('local-a');
    const view = useRefreshableView({
      refresh: async () => undefined,
      checkFreshness: async () => 'remote-b',
      currentSignature,
    });

    view.resetFreshnessState();
    await view.checkForFreshness();

    expect(view.hasNewContent.value).toBe(true);
  });

  test('manual refresh clears the new content reminder and captures the refreshed baseline', async () => {
    const currentSignature = ref('local-a');
    const view = useRefreshableView({
      refresh: async () => {
        currentSignature.value = 'remote-b';
      },
      checkFreshness: async () => 'remote-b',
      currentSignature,
    });

    view.resetFreshnessState();
    await view.checkForFreshness();
    expect(view.hasNewContent.value).toBe(true);

    await view.refreshNow();

    expect(view.hasNewContent.value).toBe(false);
    await view.checkForFreshness();
    expect(view.hasNewContent.value).toBe(false);
  });

  test('ignores stale freshness checks after the refresh key resets', async () => {
    const currentSignature = ref('local-a');
    const freshness = createDeferred<string>();
    const view = useRefreshableView({
      refresh: async () => undefined,
      checkFreshness: async () => freshness.promise,
      currentSignature,
    });

    view.resetFreshnessState();
    const check = view.checkForFreshness();
    view.resetFreshnessState();
    freshness.resolve('remote-b');
    await check;

    expect(view.hasNewContent.value).toBe(false);
    expect(view.checking.value).toBe(false);
  });
});
