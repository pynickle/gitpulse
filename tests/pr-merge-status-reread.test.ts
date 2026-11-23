import { afterEach, describe, expect, test } from 'bun:test';

import { effectScope, type EffectScope } from 'vue';

import { createVueDom } from './helpers/vue-dom';

const { usePRMergeStatus } = await import('../app/composables/usePRMergeStatus');

const openStatus = (overrides: Record<string, unknown> = {}) => ({
  state: 'open',
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  mergeableState: 'clean',
  mergeable: true,
  autoMerge: false,
  draft: false,
  reviewDecision: 'none',
  reviewSummary: { approved: 0, changesRequested: 0 },
  checkRollup: null,
  headSha: 'abc123',
  headBranch: null,
  viewerCanMerge: true,
  allowedMergeMethods: ['merge', 'squash', 'rebase'],
  behindBy: 0,
  baseRef: 'main',
  baseSha: '1234567890abcdef',
  viewerCanWriteHead: true,
  ...overrides,
});

type Responder = (url: string, options?: { method?: string }) => Promise<unknown>;

let scope: EffectScope | null = null;
let dom: ReturnType<typeof createVueDom> | null = null;

function createComposable(respond: Responder) {
  // The DOM the composable is created in has to outlive its effect scope.
  dom = createVueDom({
    useGitPulseApiFetch: () => (url: string, options?: { method?: string }) =>
      respond(url, options),
  });
  const scoped = effectScope();
  const api = scoped.run(() => usePRMergeStatus());
  if (!api) throw new Error('composable did not mount');
  scope = scoped;
  return api;
}

afterEach(async () => {
  scope?.stop();
  scope = null;
  await dom?.cleanup();
  dom = null;
});

describe('merge status reread', () => {
  test('a failed reread keeps the status already on screen', async () => {
    let respond: Responder = async () => openStatus();
    const api = createComposable(() => respond());

    await api.fetchMergeStatus('octo', 'app', 4);
    expect(api.mergeStatus.value?.headSha).toBe('abc123');

    respond = async () => {
      throw new Error('GitHub is unavailable');
    };
    const reread = await api.fetchMergeStatus('octo', 'app', 4);

    expect(reread).toBeNull();
    // The reader keeps the last known status rather than watching the box blank out.
    expect(api.mergeStatus.value?.headSha).toBe('abc123');
    expect(api.error.value).toContain('GitHub is unavailable');
  });

  test('a failed first read still leaves no status to show', async () => {
    const api = createComposable(async () => {
      throw new Error('GitHub is unavailable');
    });

    await api.fetchMergeStatus('octo', 'app', 4);

    expect(api.mergeStatus.value).toBeNull();
    expect(api.error.value).toContain('GitHub is unavailable');
  });

  test('a reread that lands replaces the status it was holding', async () => {
    let respond: Responder = async () => openStatus({ headSha: 'abc123' });
    const api = createComposable(() => respond());

    await api.fetchMergeStatus('octo', 'app', 4);

    respond = async () => openStatus({ headSha: 'def456', behindBy: 2 });
    await api.fetchMergeStatus('octo', 'app', 4);

    expect(api.mergeStatus.value?.headSha).toBe('def456');
    expect(api.mergeStatus.value?.behindBy).toBe(2);
    expect(api.error.value).toBeNull();
  });
});

interface Deferred {
  promise: Promise<unknown>;
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}

const defer = (): Deferred => {
  let resolve!: Deferred['resolve'];
  let reject!: Deferred['reject'];
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Lets a test settle pending promise chains without waiting on a real timer.
const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

describe('stack merge polling', () => {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const timers = new Map<number, { run: () => void; delayMs: number }>();
  let delays: number[] = [];
  let nextTimerId = 1;

  const installPollTimers = () => {
    timers.clear();
    delays = [];
    nextTimerId = 1;
    globalThis.setTimeout = ((run: () => void, delayMs = 0) => {
      const id = nextTimerId++;
      timers.set(id, { run, delayMs });
      return id;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((id: number) => {
      timers.delete(id);
    }) as unknown as typeof clearTimeout;
  };

  const createPolledComposable = (respond: Responder) => {
    const api = createComposable(respond);
    installPollTimers();
    return api;
  };

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  });

  const fireNextTimer = async () => {
    const [id, timer] = [...timers][0]!;
    timers.delete(id);
    delays.push(timer.delayMs);
    timer.run();
    await settle();
  };

  const runPollToEnd = async () => {
    await settle();
    while (timers.size > 0) await fireNextTimer();
  };

  const isPoll = (url: string) => url.endsWith('/stack-merge/u1');
  const isStart = (url: string) => url.endsWith('/stack-merge');
  const payload = { method: 'squash' } as const;

  test('resetMergeStatus cancels a stack merge that is still polling', async () => {
    let polls = 0;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      if (isPoll(url)) polls += 1;
      return { outcome: 'landed' };
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await settle();
    expect(timers.size).toBe(1);

    api.resetMergeStatus();

    expect(await merge).toBeNull();
    expect(timers.size).toBe(0);
    expect(polls).toBe(0);
  });

  test('resetMergeStatus clears the errors of the pull request it leaves', async () => {
    const api = createPolledComposable(async () => {
      throw new Error('nope');
    });

    await api.mergePullRequest('octo', 'app', 4, payload);
    await api.updatePullRequestBranch('octo', 'app', 4, { method: 'merge', expectedHeadOid: 'a' });
    expect(api.mergeError.value).toContain('nope');
    expect(api.branchUpdateError.value).toContain('nope');

    api.resetMergeStatus();

    expect(api.mergeError.value).toBeNull();
    expect(api.branchActionError.value).toBeNull();
    expect(api.branchUpdateError.value).toBeNull();
  });

  test('a merge that settles after a switch does not overwrite the new status', async () => {
    const merge = defer();
    const api = createPolledComposable(async (url) => {
      if (url.endsWith('/merge')) return merge.promise;
      return openStatus({ headSha: 'old' });
    });

    const result = api.mergePullRequest('octo', 'app', 4, payload);
    await settle();
    api.resetMergeStatus();
    api.setMergeStatus(openStatus({ headSha: 'new' }) as never);
    merge.resolve({ merged: true });

    expect(await result).toBe(false);
    expect(api.mergeStatus.value?.headSha).toBe('new');
  });

  test('a failed merge that settles after a switch leaves no error behind', async () => {
    const merge = defer();
    const api = createPolledComposable(() => merge.promise);

    const result = api.mergePullRequest('octo', 'app', 4, payload);
    await settle();
    api.resetMergeStatus();
    merge.reject(new Error('stale failure'));

    expect(await result).toBe(false);
    expect(api.mergeError.value).toBeNull();
  });

  test('a branch update that settles after a switch does not overwrite the new status', async () => {
    const update = defer();
    const api = createPolledComposable(async (url) => {
      if (url.endsWith('/update-branch')) return update.promise;
      return openStatus({ headSha: 'old' });
    });

    const result = api.updatePullRequestBranch('octo', 'app', 4, {
      method: 'merge',
      expectedHeadOid: 'abc123',
    });
    await settle();
    api.resetMergeStatus();
    api.setMergeStatus(openStatus({ headSha: 'new' }) as never);
    update.resolve({});

    expect(await result).toBe(false);
    expect(api.mergeStatus.value?.headSha).toBe('new');
  });

  test('a head branch change that settles after a switch does not touch the new status', async () => {
    const mutation = defer();
    const api = createPolledComposable(async (url) => {
      if (url.endsWith('/head-branch')) return mutation.promise;
      return openStatus({ headSha: 'old' });
    });

    const result = api.deleteHeadBranch('octo', 'app', 4);
    await settle();
    api.resetMergeStatus();
    api.setMergeStatus(openStatus({ headSha: 'new' }) as never);
    mutation.resolve({ head_branch: { name: 'feature' } });

    expect(await result).toBe(false);
    expect(api.mergeStatus.value?.headSha).toBe('new');
    expect(api.mergeStatus.value?.headBranch).toBeNull();
  });

  test('polling backs off and tolerates two transient read failures', async () => {
    let reads = 0;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      if (isPoll(url)) {
        reads += 1;
        if (reads <= 2) throw new Error('read failed');
        return { outcome: 'landed' };
      }
      return openStatus({ merged: true, state: 'merged' });
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await runPollToEnd();

    expect(await merge).toEqual({ outcome: 'landed' });
    expect(reads).toBe(3);
    expect(delays).toEqual([2000, 2000, 2000]);
    expect(api.mergeError.value).toBeNull();
    expect(api.mergeStatus.value?.merged).toBe(true);
  });

  test('a read failure that recovers resets the failure count', async () => {
    let reads = 0;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      if (isPoll(url)) {
        reads += 1;
        if (reads === 1 || reads === 2 || reads === 4 || reads === 5) throw new Error('flaky');
        return reads === 6 ? { outcome: 'landed' } : { outcome: 'in-progress', id: 'u1' };
      }
      return openStatus();
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await runPollToEnd();

    expect((await merge)?.outcome).toBe('landed');
    expect(reads).toBe(6);
  });

  test('a third consecutive read failure stalls without raising an error', async () => {
    let reads = 0;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      reads += 1;
      throw new Error('GitHub is unavailable');
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await runPollToEnd();

    const result = await merge;
    expect(result?.outcome).toBe('stalled');
    expect(result?.id).toBe('u1');
    expect(result?.message).toContain('GitHub is unavailable');
    expect(reads).toBe(3);
    expect(api.mergeError.value).toBeNull();
  });

  test('a merge still running after the poll cap stalls, and resume can land it', async () => {
    let reads = 0;
    let landed = false;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      if (isPoll(url)) {
        reads += 1;
        return landed ? { outcome: 'landed' } : { outcome: 'in-progress', id: 'u1' };
      }
      return openStatus({ merged: true, state: 'merged' });
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await runPollToEnd();

    expect(await merge).toEqual({ outcome: 'stalled', id: 'u1', message: undefined });
    expect(reads).toBe(25);
    expect(delays.slice(0, 8)).toEqual([2000, 2000, 2000, 3000, 3000, 4000, 4000, 4000]);
    expect(api.mergeError.value).toBeNull();

    landed = true;
    delays = [];
    const resumed = api.resumeStackMergePoll('octo', 'app', 4, 'u1');
    await runPollToEnd();

    expect(await resumed).toEqual({ outcome: 'landed' });
    expect(delays).toEqual([2000]);
    expect(api.mergeStatus.value?.merged).toBe(true);
    expect(api.mergeError.value).toBeNull();
  });

  test('a failed outcome without an id is not polled', async () => {
    const api = createPolledComposable(async () => ({ outcome: 'in-progress', message: 'no id' }));

    const result = await api.mergeStack('octo', 'app', 4, payload);

    expect(result).toEqual({ outcome: 'failed', message: 'no id' });
    expect(timers.size).toBe(0);
  });

  test('polling keeps the active id when a pending reply omits it before landing', async () => {
    let reads = 0;
    const api = createPolledComposable(async (url) => {
      if (isStart(url)) return { outcome: 'in-progress', id: 'u1' };
      if (isPoll(url)) {
        reads += 1;
        return reads === 1 ? { outcome: 'in-progress' } : { outcome: 'landed' };
      }
      return openStatus({ merged: true, state: 'merged' });
    });

    const merge = api.mergeStack('octo', 'app', 4, payload);
    await runPollToEnd();

    expect(await merge).toEqual({ outcome: 'landed' });
    expect(reads).toBe(2);
    expect(api.mergeStatus.value?.merged).toBe(true);
  });
});
