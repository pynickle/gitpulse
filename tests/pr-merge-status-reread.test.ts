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

type Responder = () => Promise<unknown>;

let scope: EffectScope | null = null;

function createComposable(respond: Responder) {
  // The DOM the composable is created in has to outlive its effect scope.
  createVueDom({ useGitPulseApiFetch: () => () => respond() });
  const scoped = effectScope();
  const api = scoped.run(() => usePRMergeStatus());
  if (!api) throw new Error('composable did not mount');
  scope = scoped;
  return api;
}

afterEach(() => {
  scope?.stop();
  scope = null;
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
