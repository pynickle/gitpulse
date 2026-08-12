import { describe, expect, mock, test } from 'bun:test';

import { createRepoDetailResource } from '../app/composables/repo-detail-session/resource';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('repo detail session resource', () => {
  test('loads, caches by key, and serves repeats without refetching', async () => {
    const fetchValue = mock(async (key: string) => `value:${key}`);
    const resource = createRepoDetailResource<string | null>(fetchValue, {
      fallback: () => null,
    });

    const first = resource.load('octo/repo@main');
    expect(resource.loading.value).toBe(true);
    await first;

    expect(resource.data.value).toBe('value:octo/repo@main');
    expect(resource.loading.value).toBe(false);
    expect(fetchValue).toHaveBeenCalledTimes(1);

    await resource.load('octo/repo@main');
    expect(resource.data.value).toBe('value:octo/repo@main');
    expect(fetchValue).toHaveBeenCalledTimes(1);
  });

  test('force reload bypasses and refreshes the cache', async () => {
    let counter = 0;
    const fetchValue = mock(async () => {
      counter += 1;
      return counter;
    });
    const resource = createRepoDetailResource<number | null>(fetchValue, {
      fallback: () => null,
    });

    await resource.load('key');
    expect(resource.data.value).toBe(1);

    await resource.load('key', { force: true });
    expect(resource.data.value).toBe(2);
    expect(fetchValue).toHaveBeenCalledTimes(2);

    // Refreshed value is cached again.
    await resource.load('key');
    expect(resource.data.value).toBe(2);
    expect(fetchValue).toHaveBeenCalledTimes(2);
  });

  test('ignores stale responses after a newer load wins', async () => {
    const deferredA = createDeferred<string>();
    const deferredB = createDeferred<string>();
    const responses = new Map([
      ['a', deferredA.promise],
      ['b', deferredB.promise],
    ]);
    const resource = createRepoDetailResource<string | null>(
      (key) => responses.get(key) as Promise<string>,
      { fallback: () => null }
    );

    const loadA = resource.load('a');
    const loadB = resource.load('b');

    deferredB.resolve('value-b');
    await loadB;
    expect(resource.data.value).toBe('value-b');

    deferredA.resolve('value-a');
    await loadA;
    expect(resource.data.value).toBe('value-b');
    expect(resource.loading.value).toBe(false);
  });

  test('cache hit invalidates an in-flight request', async () => {
    const slow = createDeferred<string>();
    let calls = 0;
    const resource = createRepoDetailResource<string | null>(
      async (key: string) => {
        calls += 1;
        if (key === 'slow') return slow.promise;
        return `value:${key}`;
      },
      { fallback: () => null }
    );

    await resource.load('cached');
    expect(resource.data.value).toBe('value:cached');

    const slowLoad = resource.load('slow');
    await resource.load('cached');
    expect(resource.loading.value).toBe(false);

    slow.resolve('value:slow');
    await slowLoad;
    expect(resource.data.value).toBe('value:cached');
    expect(calls).toBe(2);
  });

  test('failed loads apply the fallback and cache it when negative caching is on', async () => {
    let calls = 0;
    const resource = createRepoDetailResource<string | null>(
      async () => {
        calls += 1;
        throw new Error('boom');
      },
      { fallback: () => null, cacheFallbackOnError: true }
    );

    await resource.load('key');
    expect(resource.data.value).toBe(null);
    expect(resource.loading.value).toBe(false);
    expect(calls).toBe(1);

    // Negative cache: same key does not retry within the session.
    await resource.load('key');
    expect(calls).toBe(1);
  });

  test('failed loads without negative caching surface an error and allow retry', async () => {
    let shouldFail = true;
    const resource = createRepoDetailResource<string | null>(
      async () => {
        if (shouldFail) throw new Error('boom');
        return 'recovered';
      },
      { fallback: () => null, errorMessage: () => 'load failed' }
    );

    await resource.load('key');
    expect(resource.data.value).toBe(null);
    expect(resource.error.value).toBe('load failed');

    shouldFail = false;
    await resource.load('key');
    expect(resource.data.value).toBe('recovered');
    expect(resource.error.value).toBe(null);
  });

  test('clear wipes the cache and resets state', async () => {
    let calls = 0;
    const resource = createRepoDetailResource<string | null>(
      async (key: string) => {
        calls += 1;
        return `value:${key}`;
      },
      { fallback: () => null }
    );

    await resource.load('key');
    expect(resource.data.value).toBe('value:key');

    resource.clear();
    expect(resource.data.value).toBe(null);
    expect(resource.error.value).toBe(null);

    await resource.load('key');
    expect(calls).toBe(2);
  });
});
