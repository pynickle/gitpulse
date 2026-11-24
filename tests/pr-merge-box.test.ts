import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef, type Component } from 'vue';

import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import enLocale from '../i18n/locales/en.json';
import * as prChecks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });
const slotStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
});

const lookupMessage = (key: string): string => {
  let cursor: unknown = enLocale;
  for (const part of key.split('.')) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return key;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : key;
};

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(lookupMessage(key), params);

type MergeMethod = 'merge' | 'squash' | 'rebase';

interface RecordedMerge {
  method: string;
  commitTitle?: string;
  commitMessage?: string;
}

interface RecordedUpdate {
  method: string;
  expectedHeadOid: string;
}

interface CommitDefaults {
  merge: { title: string; message: string };
  squash: { title: string; message: string };
}

const commitDefaults: CommitDefaults = {
  merge: { title: 'Merge pull request #4 from octo/topic', message: 'Add feature' },
  squash: { title: 'Add feature (#4)', message: '* feat: one\n\n* fix: two' },
};

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

/**
 * Stands in for the merge status store: the component only needs a status to read
 * its allowed methods from, plus a place to record what a merge would send.
 *
 * `holdDefaults` keeps the default commit message request pending so a test can
 * observe the form's state while the box is still reading it.
 */
interface RecordedStackMergeResult {
  outcome: 'in-progress' | 'landed' | 'queued' | 'failed' | 'stalled';
  id?: string;
  message?: string;
}

function createMergeStatusStore({ holdDefaults = false } = {}) {
  const mergeStatus = shallowRef<Record<string, unknown> | null>(null);
  const merges: RecordedMerge[] = [];
  const updates: RecordedUpdate[] = [];
  const resumedPolls: Array<{ owner: string; repo: string; pullNumber: number; id: string }> = [];
  const branchUpdateError = ref<string | null>(null);
  const defaults = shallowRef<CommitDefaults | null>(null);
  const defaultsGate = holdDefaults ? createDeferred() : null;
  let defaultsReads = 0;
  let finishUpdate = async (_payload: RecordedUpdate): Promise<boolean> => true;
  let finishStackMerge = async (
    _payload: RecordedMerge
  ): Promise<RecordedStackMergeResult | null> => ({ outcome: 'landed' });
  let finishResumeStackMerge = async (_id: string): Promise<RecordedStackMergeResult | null> => ({
    outcome: 'landed',
  });

  const store = {
    mergeStatus,
    loading: ref(false),
    error: ref<string | null>(null),
    mergeError: ref<string | null>(null),
    branchActionError: ref<string | null>(null),
    branchUpdateError,
    commitDefaults: defaults,
    setMergeStatus: (value: Record<string, unknown> | null) => {
      mergeStatus.value = value;
      branchUpdateError.value = null;
    },
    resetMergeStatus: () => {
      mergeStatus.value = null;
      branchUpdateError.value = null;
    },
    fetchMergeStatus: async (_owner?: string, _repo?: string, _pullNumber?: number) => null,
    fetchCommitDefaults: async () => {
      defaultsReads += 1;
      await defaultsGate?.promise;
      defaults.value = commitDefaults;
      return commitDefaults;
    },
    defaultsReads: () => defaultsReads,
    releaseDefaults: () => defaultsGate?.resolve(),
    clearCommitDefaults: () => {
      defaults.value = null;
    },
    mergePullRequest: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      payload: RecordedMerge
    ) => {
      merges.push(payload);
      return true;
    },
    mergeStack: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      payload: RecordedMerge
    ) => {
      merges.push(payload);
      return finishStackMerge(payload);
    },
    resumeStackMergePoll: async (owner: string, repo: string, pullNumber: number, id: string) => {
      resumedPolls.push({ owner, repo, pullNumber, id });
      return finishResumeStackMerge(id);
    },
    stageStackMerge: (fn: (payload: RecordedMerge) => Promise<RecordedStackMergeResult | null>) => {
      finishStackMerge = fn;
    },
    stageResumeStackMerge: (fn: (id: string) => Promise<RecordedStackMergeResult | null>) => {
      finishResumeStackMerge = fn;
    },
    deleteHeadBranch: async () => true,
    restoreHeadBranch: async () => true,
    updatePullRequestBranch: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      payload: RecordedUpdate
    ) => {
      updates.push(payload);
      return finishUpdate(payload);
    },
    /**
     * Replaces what the branch update does after the box has recorded it.
     * The real store rereads on success and on a rejected head oid; a test
     * that needs that reread does it here.
     */
    stageBranchUpdate: (fn: (payload: RecordedUpdate) => Promise<boolean>) => {
      finishUpdate = fn;
    },
    merges,
    updates,
    resumedPolls,
  };

  return store;
}

let store: ReturnType<typeof createMergeStatusStore>;
let dom: ReturnType<typeof createVueDom>;

const StackRebaseDialog = await compileVue(
  'app/components/dashboard/pr/PRStackRebaseDialog.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': { useI18n: () => ({ t, locale: ref('en') }) },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
  },
  { getFetchErrorMessage: '~/utils/getFetchErrorMessage' }
);

const MergeBox = await compileVue(
  'app/components/dashboard/pr/PRMergeBox.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': { useI18n: () => ({ t, locale: ref('en') }) },
    '#shared/utils/pr-checks': prChecks,
    '~/components/dashboard/pr/CheckListRows.vue': { default: slotStub },
    '~/components/dashboard/pr/PRStackRebaseDialog.vue': { default: StackRebaseDialog },
    '~/components/ui/GitHubAvatar.vue': { default: slotStub },
    '~/components/ui/ScrollArea.vue': { default: slotStub },
    '~/utils/getCheckStatusToneIcon': { getCheckStatusToneIcon: () => icon },
    '~/composables/usePRMergeStatus': {
      usePRMergeStatus: () => store,
    },
    '~/composables/useRelativeTimeNow': { useRelativeTimeNow: () => shallowRef(0) },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => '' },
  },
  {
    getCheckStatusToneIcon: '~/utils/getCheckStatusToneIcon',
    usePRMergeStatus: '~/composables/usePRMergeStatus',
    useRelativeTimeNow: '~/composables/useRelativeTimeNow',
    formatDurationFromNow: '~/utils/formatDurationFromNow',
  }
);

function mountMergeBox(
  allowedMergeMethods: MergeMethod[],
  options?: { holdDefaults?: boolean; rereadError?: string }
) {
  store = createMergeStatusStore(options);
  store.error.value = options?.rereadError ?? null;
  dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

  const initialStatus = {
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
    allowedMergeMethods,
    behindBy: 0,
    baseRef: 'main',
    baseSha: '1234567890abcdef',
    viewerCanWriteHead: true,
  };

  const Harness = defineComponent({
    setup: () => () =>
      h(MergeBox as Component, {
        owner: 'octo',
        repo: 'app',
        pullNumber: 4,
        initialStatus,
      }),
  });

  return dom.mount(Harness).root;
}

const methodOptions = (root: HTMLElement) =>
  [...root.querySelectorAll('.merge-box__method-option')].map((node) => node.textContent?.trim());

const click = (element: Element | null) =>
  element?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

/** Waits for the defaults request the form opens with, then for the re-render it causes. */
const settle = async () => {
  await Promise.resolve();
  await nextTick();
  await nextTick();
};

async function openCommitForm(root: HTMLElement) {
  click(root.querySelector('.merge-box__merge-btn'));
  await settle();
  return root.querySelector<HTMLFormElement>('.merge-box__commit-form');
}

afterEach(async () => {
  await dom.cleanup();
});

describe('PRMergeBox reread failure', () => {
  test('keeps the merge box, blocks stale mutations, and retries fetchMergeStatus', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    let rereadCalls = 0;
    store.fetchMergeStatus = async () => {
      rereadCalls += 1;
      store.error.value = null;
      return null;
    };

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: openStatus({ behindBy: 2 }),
        }),
    });
    const root = dom.mount(Harness).root;
    store.error.value = 'Failed to read merge status';
    await settle();

    // The status is still on screen, but mutations are blocked until reread succeeds.
    const mergeBtn = root.querySelector<HTMLButtonElement>(
      '.merge-box__actions .merge-box__merge-btn'
    );
    const branchBtn = root.querySelector<HTMLButtonElement>(
      '.merge-box__update .merge-box__merge-btn'
    );
    expect(mergeBtn?.textContent?.trim()).toBe('Merge pull request');
    expect(mergeBtn?.hasAttribute('disabled')).toBe(true);
    expect(branchBtn?.hasAttribute('disabled')).toBe(true);
    expect(root.textContent).toContain('Failed to read merge status');
    expect(root.querySelector('.merge-box__skeleton')).toBeNull();

    const retryBtn = root.querySelector<HTMLButtonElement>('.merge-box__retry-btn');
    expect(retryBtn?.textContent?.trim()).toBe('Retry');
    click(retryBtn);
    await settle();

    expect(rereadCalls).toBe(1);
    expect(mergeBtn?.hasAttribute('disabled')).toBe(false);
    expect(branchBtn?.hasAttribute('disabled')).toBe(false);
  });

  test('shows only the error when no status was ever read', () => {
    store = createMergeStatusStore();
    store.error.value = 'Failed to read merge status';
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: null,
        }),
    });
    const root = dom.mount(Harness).root;

    expect(root.textContent).toContain('Failed to read merge status');
    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
  });
});

describe('PRMergeBox first read', () => {
  test('a Layer reads its status once when it opens', async () => {
    const stack = {
      number: 106,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'not-linear' as const,
      layers: [
        {
          number: 101,
          title: 'Add the model',
          state: 'open' as const,
          headSha: 'head-101',
          baseRef: 'main',
          baseSha: 'base-101',
        },
        {
          number: 102,
          title: 'Add the API',
          state: 'open' as const,
          headSha: 'head-102',
          baseRef: 'main',
          baseSha: 'base-102',
        },
      ],
    };
    store = createMergeStatusStore();
    let reads = 0;
    store.fetchMergeStatus = async () => {
      reads += 1;
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: null,
          stack,
        }),
    });
    dom.mount(Harness);
    await settle();

    // Opening a Layer asks GitHub once, not once per watcher.
    expect(reads).toBe(1);
  });

  test('hydrating stack after mount does not trigger a duplicate status fetch', async () => {
    const stack = shallowRef<Record<string, unknown> | null>(null);
    store = createMergeStatusStore();
    let reads = 0;
    store.fetchMergeStatus = async () => {
      reads += 1;
      store.mergeStatus.value = openStatus();
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: null,
          stack: stack.value,
          git: { available: true },
        }),
    });
    dom.mount(Harness);
    await settle();
    expect(reads).toBe(1);

    stack.value = {
      number: 106,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'not-linear',
      layers: [
        { number: 101, title: 'Add the model', state: 'open', headSha: 'head-101' },
        { number: 102, title: 'Add the API', state: 'open', headSha: 'head-102' },
      ],
    };
    await settle();

    expect(reads).toBe(1);
  });
});

describe('PRMergeBox Git capability', () => {
  const notLinearStack = (history: 'not-linear' | 'unknown' = 'not-linear') => ({
    number: 106,
    trunk: 'main',
    count: 2,
    place: 2,
    history,
    layers: [
      {
        number: 101,
        title: 'Add the model',
        state: 'open' as const,
        headSha: 'head-101',
        baseRef: 'main',
        baseSha: 'base-101',
      },
      {
        number: 102,
        title: 'Add the API',
        state: 'open' as const,
        headSha: 'head-102',
        baseRef: 'main',
        baseSha: 'base-102',
      },
    ],
  });

  function mountLayer(stack: unknown, git: unknown) {
    store = createMergeStatusStore();
    store.mergeStatus.value = openStatus();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: openStatus(),
          stack,
          git,
        }),
    });

    return dom.mount(Harness).root;
  }

  const rebaseButton = (root: HTMLElement) => root.querySelector('.merge-box__rebase-stack-btn');
  const mergeButton = (root: HTMLElement) => root.querySelector('.merge-box__merge-btn');

  test('offers Stack Rebase beside a disabled merge in a single actions footer with visible inline reason', () => {
    const root = mountLayer(notLinearStack(), { available: true });

    expect(root.querySelectorAll('.merge-box__actions')).toHaveLength(1);
    expect(rebaseButton(root)).not.toBeNull();
    expect(rebaseButton(root)?.hasAttribute('disabled')).toBe(false);
    // The merge button stays on screen and says why it cannot be used visibly inline.
    expect(mergeButton(root)?.hasAttribute('disabled')).toBe(true);
    const reasonEl = root.querySelector('.merge-box__blocked-reason');
    expect(reasonEl).not.toBeNull();
    expect(reasonEl?.classList.contains('is-sr-only')).toBe(false);
    expect(reasonEl?.textContent?.trim()).toBe(
      'Only a linear Stack can merge. Rebase the Stack first.'
    );
  });

  test('hides Stack Rebase and explains the disabled merge when Git is switched off', () => {
    const root = mountLayer(notLinearStack(), { available: false, reason: 'disabled' });

    expect(rebaseButton(root)).toBeNull();
    expect(mergeButton(root)?.hasAttribute('disabled')).toBe(true);
    const reasonEl = root.querySelector('.merge-box__blocked-reason');
    expect(reasonEl?.classList.contains('is-sr-only')).toBe(false);
    expect(reasonEl?.textContent?.trim()).toBe(
      'Only a linear Stack can merge. Stack Rebase is switched off on this deployment.'
    );
  });

  test('keeps Stack Rebase on screen but disabled when the server has no Git', () => {
    const root = mountLayer(notLinearStack(), { available: false, reason: 'git_missing' });

    expect(rebaseButton(root)?.hasAttribute('disabled')).toBe(true);
    // A disabled control is not a dead end: the reason is readable inline without hovering.
    const reasons = [...root.querySelectorAll('.merge-box__blocked-reason')];
    expect(reasons.length).toBeGreaterThanOrEqual(1);
    expect(reasons.every((el) => !el.classList.contains('is-sr-only'))).toBe(true);
    expect(root.textContent).toContain('This server has no Git, so it cannot rebase a Stack.');
    expect(mergeButton(root)?.hasAttribute('disabled')).toBe(true);
  });

  test('explains a stack whose history could not be read, instead of rendering nothing', () => {
    const root = mountLayer(notLinearStack('unknown'), { available: true });

    expect(rebaseButton(root)).toBeNull();
    expect(mergeButton(root)?.hasAttribute('disabled')).toBe(true);
    const reasonEl = root.querySelector('.merge-box__blocked-reason');
    expect(reasonEl?.classList.contains('is-sr-only')).toBe(false);
    expect(reasonEl?.textContent?.trim()).toBe('The Stack history could not be read.');
  });

  test('offers no Stack Rebase before the box has been told what the server can do', () => {
    // A click could not open the dialog, so an enabled button would be a lie.
    const root = mountLayer(notLinearStack(), null);

    expect(rebaseButton(root)).toBeNull();
  });

  test('offers no Stack Rebase to a reader who cannot merge', () => {
    store = createMergeStatusStore();
    store.mergeStatus.value = openStatus({ viewerCanMerge: false });
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: openStatus({ viewerCanMerge: false }),
          stack: notLinearStack(),
          git: { available: true },
        }),
    });
    const root = dom.mount(Harness).root;

    expect(rebaseButton(root)).toBeNull();
  });
});

describe('PRMergeBox status reread', () => {
  test('a stack that turns linear re-reads without forgetting the status on screen', async () => {
    const heldAtCall: (Record<string, unknown> | null)[] = [];
    const stack = shallowRef({
      number: 106,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'not-linear' as 'not-linear' | 'linear',
      layers: [
        {
          number: 101,
          title: 'Add the model',
          state: 'open' as const,
          headSha: 'head-101',
          baseRef: 'main',
          baseSha: 'base-101',
        },
        {
          number: 102,
          title: 'Add the API',
          state: 'open' as const,
          headSha: 'head-102',
          baseRef: 'main',
          baseSha: 'base-102',
        },
      ],
    });
    store = createMergeStatusStore();
    // This pull request arrives without a terminal status, so the box reads its own.
    store.fetchMergeStatus = async () => {
      heldAtCall.push(store.mergeStatus.value as Record<string, unknown> | null);
      store.mergeStatus.value = openStatus();
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: null,
          stack: stack.value,
          git: { available: true },
        }),
    });
    const root = dom.mount(Harness).root;
    await settle();
    // While the history is not linear the box offers Stack Rebase, not a merge.
    expect(root.querySelector('.merge-box__rebase-stack-btn')?.textContent).toContain(
      'Rebase stack'
    );
    heldAtCall.length = 0;

    // A Stack Rebase finishes, so the detail reread reports a linear history.
    stack.value = { ...stack.value, history: 'linear' as const };
    await settle();

    // The box re-reads while still holding the status it was showing, so the reader
    // never sees it blank out: the same status keeps answering the new question.
    expect(heldAtCall).toHaveLength(1);
    expect(heldAtCall[0]?.headSha).toBe(HEAD_SHA);
    expect(root.querySelector('.merge-box__skeleton')).toBeNull();
    expect(root.querySelector('.merge-box__merge-btn')?.textContent).toContain(
      'Merge pull request'
    );
  });
});
describe('PRMergeBox merge methods', () => {
  test('offers only the methods the repository allows', async () => {
    const root = mountMergeBox(['squash', 'rebase']);

    expect(root.querySelector('.merge-box__method-toggle')).not.toBeNull();

    click(root.querySelector('.merge-box__method-toggle'));
    await settle();

    expect(methodOptions(root)).toEqual(['Squash and merge', 'Rebase and merge']);
  });

  test('keeps the method picker when the repository allows every method', async () => {
    const root = mountMergeBox(['merge', 'squash', 'rebase']);

    click(root.querySelector('.merge-box__method-toggle'));
    await settle();

    expect(methodOptions(root)).toEqual([
      'Merge pull request',
      'Squash and merge',
      'Rebase and merge',
    ]);
  });

  test('hides the method picker when there is nothing to choose between', () => {
    const root = mountMergeBox(['squash']);
    const button = root.querySelector('.merge-box__merge-btn');

    expect(root.querySelector('.merge-box__method-toggle')).toBeNull();
    expect(button?.textContent?.trim()).toBe('Squash and merge');
    // Nothing sits to its right, so it is not drawn as the left half of a split button.
    expect(button?.classList.contains('merge-box__merge-btn--standalone')).toBe(true);
  });

  test('keeps the split button edge while a method picker sits beside it', () => {
    const root = mountMergeBox(['squash', 'rebase']);

    expect(
      root
        .querySelector('.merge-box__merge-btn')
        ?.classList.contains('merge-box__merge-btn--standalone')
    ).toBe(false);
  });

  test('preselects the first method the repository allows', () => {
    const root = mountMergeBox(['squash', 'rebase']);

    expect(root.querySelector('.merge-box__merge-btn')?.textContent?.trim()).toBe(
      'Squash and merge'
    );
  });
});

describe('PRMergeBox default commit message', () => {
  test('the form opens on the text the repository settings would record', async () => {
    const root = mountMergeBox(['squash']);
    const form = await openCommitForm(root);

    expect(form?.querySelector<HTMLInputElement>('.merge-box__commit-input')?.value).toBe(
      'Add feature (#4)'
    );
    expect(form?.querySelector<HTMLTextAreaElement>('.merge-box__commit-textarea')?.value).toBe(
      '* feat: one\n\n* fix: two'
    );
  });

  test('the merge button carries the progress until the default commit message arrives', async () => {
    const root = mountMergeBox(['squash'], { holdDefaults: true });
    const controlsButton = () => root.querySelector('.merge-box__merge-btn');

    click(controlsButton());
    // Pressing again while the read is in flight asks for nothing new.
    click(controlsButton());
    await settle();

    expect(store.defaultsReads()).toBe(1);
    expect(root.querySelector('.merge-box__commit-form')).toBeNull();
    expect(controlsButton()?.hasAttribute('disabled')).toBe(true);
    expect(controlsButton()?.querySelector('.merge-box__spinner')).not.toBeNull();
    expect(controlsButton()?.getAttribute('aria-busy')).toBe('true');
    // Still the reader's own request: no confirmation is on screen to confirm.
    expect(controlsButton()?.textContent?.trim()).toBe('Squash and merge');
    // The wait stays cancellable.
    expect(root.querySelector('.merge-box__cancel-btn')).not.toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Loading the default commit message...'
    );

    store.releaseDefaults();
    await settle();

    expect(root.querySelector('.merge-box__spinner')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('.merge-box__commit-input')?.value).toBe(
      'Add feature (#4)'
    );
  });

  test('merging without editing sends no commit text, leaving GitHub its own default', async () => {
    const root = mountMergeBox(['squash']);
    const form = await openCommitForm(root);

    form?.dispatchEvent(new dom.window.Event('submit'));
    await settle();

    expect(store.merges).toEqual([{ method: 'squash' }]);
  });

  test('an edited title is sent and the untouched message is not', async () => {
    const root = mountMergeBox(['squash']);
    const form = await openCommitForm(root);

    const input = form?.querySelector<HTMLInputElement>('.merge-box__commit-input');
    if (input) {
      input.value = 'Ship the merge policy';
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    await nextTick();

    form?.dispatchEvent(new dom.window.Event('submit'));
    await settle();

    expect(store.merges).toEqual([{ method: 'squash', commitTitle: 'Ship the merge policy' }]);
  });
});

const BASE_SHA = '1234567890abcdef';
const HEAD_SHA = 'abc123def456';

const passedChecks = {
  state: 'SUCCESS',
  contexts: {
    totalCount: 1,
    nodes: [{ name: 'build', conclusion: 'SUCCESS', status: 'COMPLETED' }],
  },
};

const failedChecks = {
  state: 'FAILURE',
  contexts: {
    totalCount: 1,
    nodes: [{ name: 'build', conclusion: 'FAILURE', status: 'COMPLETED' }],
  },
};

function openStatus(overrides: Record<string, unknown> = {}) {
  return {
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
    headSha: HEAD_SHA,
    headBranch: null,
    viewerCanMerge: true,
    allowedMergeMethods: ['merge', 'squash', 'rebase'],
    behindBy: 0,
    baseRef: 'main',
    baseSha: BASE_SHA,
    viewerCanWriteHead: true,
    ...overrides,
  };
}

function mountCurrency(status: Record<string, unknown>) {
  store = createMergeStatusStore();
  dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
  const events: string[] = [];

  const Harness = defineComponent({
    setup: () => () =>
      h(MergeBox as Component, {
        owner: 'octo',
        repo: 'app',
        pullNumber: 4,
        initialStatus: status,
        onBranchUpdated: () => {
          events.push('branch-updated');
        },
      }),
  });

  return { root: dom.mount(Harness).root, events };
}

const currencyRow = (root: HTMLElement) => root.querySelector('.merge-box__currency');

const currencyText = (root: HTMLElement) =>
  currencyRow(root)?.querySelector('.merge-box__row-title')?.textContent?.trim() ?? '';

const updateRoot = (root: HTMLElement) => root.querySelector('.merge-box__update');

const updateButton = (root: HTMLElement) =>
  updateRoot(root)?.querySelector<HTMLButtonElement>('.merge-box__merge-btn') ?? null;

const updateToggle = (root: HTMLElement) =>
  updateRoot(root)?.querySelector<HTMLButtonElement>('.merge-box__method-toggle') ?? null;

const updateOptions = (root: HTMLElement) =>
  [...(updateRoot(root)?.querySelectorAll('.merge-box__method-option') ?? [])].map((node) =>
    node.textContent?.trim()
  );

const openRowKinds = (root: HTMLElement) =>
  [...root.querySelectorAll('.merge-box__open > .merge-box__row')].map((node) => {
    if (node.classList.contains('merge-box__currency')) return 'currency';
    if (node.classList.contains('merge-box__row--toggle')) return 'checks';
    const title = node.querySelector('.merge-box__row-title')?.textContent?.trim();
    if (title === 'No reviews required' || title === 'Review required') return 'review';
    return 'mergeability';
  });

describe('PRMergeBox branch currency', () => {
  test('says a current head is current with its base, in the success tone', () => {
    const { root } = mountCurrency(openStatus());

    expect(currencyRow(root)?.classList.contains('merge-box__row--success')).toBe(true);
    expect(currencyText(root)).toBe('This branch is current with main.');
    expect(currencyText(root)).not.toContain(BASE_SHA.slice(0, 7));
    expect(updateRoot(root)).toBeNull();
  });

  test('treats a head that is only ahead as current', () => {
    const { root } = mountCurrency(openStatus({ behindBy: 0, baseRef: 'develop' }));

    expect(currencyText(root)).toBe('This branch is current with develop.');
    expect(updateRoot(root)).toBeNull();
  });

  test('names one missing commit, the base ref, and the short base sha', () => {
    const { root } = mountCurrency(openStatus({ behindBy: 1, baseRef: 'develop' }));

    expect(currencyRow(root)?.classList.contains('merge-box__row--warning')).toBe(true);
    expect(currencyText(root)).toBe(
      `This branch is 1 commit behind develop (${BASE_SHA.slice(0, 7)}).`
    );
    expect(currencyText(root)).not.toContain('commits');
    expect(currencyText(root)).not.toContain(BASE_SHA);
  });

  test('uses the plural when more than one base commit is missing', () => {
    const { root } = mountCurrency(openStatus({ behindBy: 3 }));

    expect(currencyText(root)).toBe(
      `This branch is 3 commits behind main (${BASE_SHA.slice(0, 7)}).`
    );
  });

  test('says when branch currency could not be read, with nothing to update', () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: null, baseRef: 'main', baseSha: BASE_SHA })
    );

    expect(currencyRow(root)?.classList.contains('merge-box__row--muted')).toBe(true);
    expect(currencyText(root)).toBe('Branch currency could not be read.');
    expect(currencyText(root)).not.toContain(BASE_SHA.slice(0, 7));
    expect(currencyText(root)).not.toMatch(/\d/);
    expect(updateRoot(root)).toBeNull();
  });

  test('places branch currency between the checks and whether the pull request can merge', () => {
    const { root } = mountCurrency(openStatus({ checkRollup: passedChecks, behindBy: 2 }));

    expect(openRowKinds(root)).toEqual(['review', 'checks', 'currency', 'mergeability']);
  });

  test('places branch currency directly above mergeability when there is no check rollup', () => {
    const { root } = mountCurrency(openStatus({ checkRollup: null, behindBy: 2 }));

    expect(openRowKinds(root)).toEqual(['review', 'currency', 'mergeability']);
  });

  test('states currency on a draft the same way, and still offers the update', () => {
    const { root } = mountCurrency(
      openStatus({ draft: true, viewerCanMerge: true, behindBy: 2, viewerCanWriteHead: true })
    );

    expect(currencyText(root)).toBe(
      `This branch is 2 commits behind main (${BASE_SHA.slice(0, 7)}).`
    );
    expect(root.querySelector('.merge-box__actions')).toBeNull();
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
    expect(updateButton(root)?.hasAttribute('disabled')).toBe(false);
  });

  test('leaves a merged pull request on its merged panel', () => {
    const { root } = mountCurrency(
      openStatus({ state: 'merged', merged: true, behindBy: 4, viewerCanWriteHead: true })
    );

    expect(root.querySelector('.merge-box__panel--merged')).not.toBeNull();
    expect(currencyRow(root)).toBeNull();
    expect(updateRoot(root)).toBeNull();
  });

  test('leaves a closed pull request on its closed panel', () => {
    const { root } = mountCurrency(
      openStatus({ state: 'closed', merged: false, behindBy: 4, viewerCanWriteHead: true })
    );

    expect(root.querySelector('.merge-box__panel--closed')).not.toBeNull();
    expect(currencyRow(root)).toBeNull();
  });

  test('shows the existing skeleton and no currency row while the box is loading', async () => {
    store = createMergeStatusStore();
    store.loading.value = true;
    store.fetchMergeStatus = async () => {
      store.loading.value = true;
      store.mergeStatus.value = null;
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
        }),
    });
    const root = dom.mount(Harness).root;
    await settle();

    expect(root.querySelector('.merge-box__skeleton')).not.toBeNull();
    expect(currencyRow(root)).toBeNull();
  });

  test('shows the existing error and no currency row when merge status fails', async () => {
    store = createMergeStatusStore();
    store.fetchMergeStatus = async () => {
      store.loading.value = false;
      store.mergeStatus.value = null;
      store.error.value = 'Failed to fetch pull request merge status';
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
        }),
    });
    const root = dom.mount(Harness).root;
    await settle();

    expect(root.querySelector('.merge-box__note--danger')?.textContent).toContain(
      'Failed to fetch pull request merge status'
    );
    expect(currencyRow(root)).toBeNull();
  });

  test('offers an enabled update when the reader can write a clean behind head', () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, viewerCanWriteHead: true, viewerCanMerge: false })
    );

    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
    expect(updateButton(root)?.hasAttribute('disabled')).toBe(false);
    expect(root.querySelector('.merge-box__actions .merge-box__update')).toBeNull();
    expect(currencyRow(root)?.querySelector('.merge-box__update')).not.toBeNull();
  });

  test('hides the update when the head conflicts', () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, mergeable: false, mergeableState: 'dirty' })
    );

    expect(currencyText(root)).toContain('2 commits behind');
    expect(updateRoot(root)).toBeNull();
  });

  test('shows the update disabled while mergeability is still unknown', () => {
    const { root } = mountCurrency(
      openStatus({
        behindBy: 2,
        mergeable: null,
        mergeableState: null,
        allowedMergeMethods: ['merge', 'rebase'],
      })
    );

    expect(updateButton(root)?.hasAttribute('disabled')).toBe(true);
    expect(updateToggle(root)?.hasAttribute('disabled')).toBe(true);

    click(updateButton(root));
    click(updateToggle(root));

    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
    expect(updateOptions(root)).toEqual([]);
  });

  test('keeps the update enabled when checks are failing', () => {
    const { root } = mountCurrency(
      openStatus({
        behindBy: 2,
        mergeable: true,
        mergeableState: 'unstable',
        checkRollup: failedChecks,
      })
    );

    expect(root.querySelector('.merge-box__row--toggle')?.textContent).toContain(
      'Some checks were not successful'
    );
    expect(updateButton(root)?.hasAttribute('disabled')).toBe(false);
  });

  test('keeps the update enabled when a review is still required', () => {
    const { root } = mountCurrency(
      openStatus({
        behindBy: 2,
        mergeable: true,
        mergeableState: 'blocked',
        reviewDecision: 'review_required',
      })
    );

    expect(openRowKinds(root)[0]).toBe('review');
    expect(
      root.querySelector('.merge-box__actions .merge-box__merge-btn')?.hasAttribute('disabled')
    ).toBe(true);
    expect(updateButton(root)?.hasAttribute('disabled')).toBe(false);
  });

  test('hides the update when the reader cannot write the head', () => {
    const { root } = mountCurrency(openStatus({ behindBy: 2, viewerCanWriteHead: false }));

    expect(currencyText(root)).toContain('2 commits behind');
    expect(updateRoot(root)).toBeNull();
  });

  test('hides the update when the head is already current', () => {
    const { root } = mountCurrency(openStatus({ behindBy: 0, viewerCanWriteHead: true }));

    expect(updateRoot(root)).toBeNull();
  });

  test('offers merge and rebase, and the main label follows the selection', async () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, allowedMergeMethods: ['squash', 'rebase'] })
    );

    expect(updateButton(root)?.classList.contains('merge-box__merge-btn--standalone')).toBe(false);
    click(updateToggle(root));
    await settle();

    expect(updateOptions(root)).toEqual(['Update with a merge commit', 'Update with rebase']);

    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[1] ?? null);
    await settle();

    expect(updateOptions(root)).toEqual([]);
    expect(updateButton(root)?.textContent?.trim()).toBe('Rebase branch');

    click(updateToggle(root));
    await settle();
    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[0] ?? null);
    await settle();

    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
  });

  test('offers only Update branch when the repository does not allow rebase', () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, allowedMergeMethods: ['merge', 'squash'] })
    );

    expect(updateToggle(root)).toBeNull();
    expect(updateButton(root)?.classList.contains('merge-box__merge-btn--standalone')).toBe(true);
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
  });

  test('confirms before sending, and cancel sends nothing', async () => {
    const { root } = mountCurrency(openStatus({ behindBy: 2, allowedMergeMethods: ['merge'] }));

    click(updateButton(root));
    await settle();

    expect(updateButton(root)?.textContent?.trim()).toBe('Confirm update');
    expect(updateRoot(root)?.querySelector('.merge-box__cancel-btn')).not.toBeNull();
    expect(updateRoot(root)?.querySelector('input, textarea')).toBeNull();
    expect(store.updates).toEqual([]);

    click(updateRoot(root)?.querySelector('.merge-box__cancel-btn') ?? null);
    await settle();

    expect(store.updates).toEqual([]);
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
  });

  test('sends the selected method and the head oid on confirm', async () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, headSha: HEAD_SHA, allowedMergeMethods: ['merge', 'rebase'] })
    );

    click(updateToggle(root));
    await settle();
    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[1] ?? null);
    await settle();
    click(updateButton(root));
    await settle();

    expect(updateButton(root)?.textContent?.trim()).toBe('Confirm rebase');
    expect(updateRoot(root)?.querySelector('input, textarea')).toBeNull();

    click(updateButton(root));
    await settle();

    expect(store.updates).toEqual([{ method: 'rebase', expectedHeadOid: HEAD_SHA }]);
  });

  test('cancel returns the selected method, and a later choice does not send the update', async () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, allowedMergeMethods: ['merge', 'rebase'] })
    );

    click(updateButton(root));
    await settle();
    expect(updateButton(root)?.textContent?.trim()).toBe('Confirm update');

    click(updateRoot(root)?.querySelector('.merge-box__cancel-btn') ?? null);
    await settle();
    click(updateToggle(root));
    await settle();
    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[1] ?? null);
    await settle();

    expect(store.updates).toEqual([]);
    expect(updateButton(root)?.textContent?.trim()).toBe('Rebase branch');
  });

  test('a click outside the update menu closes it', async () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, allowedMergeMethods: ['merge', 'rebase'] })
    );

    click(updateToggle(root));
    await settle();
    expect(updateOptions(root)).toHaveLength(2);

    click(currencyRow(root)?.querySelector('.merge-box__row-title') ?? null);
    await settle();

    expect(updateOptions(root)).toEqual([]);
  });

  test('shows progress while the update is in flight and ignores another click', async () => {
    const { root } = mountCurrency(openStatus({ behindBy: 2, allowedMergeMethods: ['merge'] }));
    const gate = createDeferred();
    store.stageBranchUpdate(async () => {
      await gate.promise;
      return true;
    });

    click(updateButton(root));
    await settle();
    click(updateButton(root));
    click(updateButton(root));
    await settle();

    expect(store.updates).toHaveLength(1);
    expect(updateButton(root)?.querySelector('.merge-box__spinner')).not.toBeNull();
    expect(updateButton(root)?.getAttribute('aria-busy')).toBe('true');
    expect(updateButton(root)?.textContent?.trim()).toBe('Updating...');
    expect(updateButton(root)?.hasAttribute('disabled')).toBe(true);

    gate.resolve();
    await settle();

    expect(store.updates).toHaveLength(1);
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
  });

  test('a failed update stays on this control and leaves the merge error alone', async () => {
    const { root } = mountCurrency(
      openStatus({ behindBy: 2, allowedMergeMethods: ['merge', 'rebase'] })
    );
    store.mergeError.value = 'The merge failed';
    store.stageBranchUpdate(async () => {
      store.branchUpdateError.value = 'The update failed';
      return false;
    });

    click(updateToggle(root));
    await settle();
    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[1] ?? null);
    await settle();
    click(updateButton(root));
    await settle();
    click(updateButton(root));
    await settle();

    expect(updateRoot(root)?.querySelector('[role="alert"]')?.textContent).toContain(
      'The update failed'
    );
    expect(root.querySelector('.merge-box__actions [role="alert"]')?.textContent).toContain(
      'The merge failed'
    );
    expect(root.querySelector('.merge-box__actions [role="alert"]')?.textContent).not.toContain(
      'The update failed'
    );
    expect(updateButton(root)?.textContent?.trim()).toBe('Rebase branch');
  });

  test('a rejected head oid is shown here, and the next confirmation uses the reread oid', async () => {
    const { root, events } = mountCurrency(openStatus({ behindBy: 2, headSha: HEAD_SHA }));
    store.stageBranchUpdate(async () => {
      store.branchUpdateError.value = 'Expected head sha did not match';
      const current = store.mergeStatus.value;
      if (current) {
        store.mergeStatus.value = { ...current, headSha: 'newhead1' };
      }
      return false;
    });

    click(updateButton(root));
    await settle();
    click(updateButton(root));
    await settle();

    expect(store.updates[0]).toEqual({ method: 'merge', expectedHeadOid: HEAD_SHA });
    expect(updateRoot(root)?.querySelector('[role="alert"]')?.textContent).toContain(
      'Expected head sha did not match'
    );
    expect(root.querySelector('.merge-box__actions [role="alert"]')).toBeNull();
    expect(events).toEqual([]);
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');

    click(updateButton(root));
    await settle();
    click(updateButton(root));
    await settle();

    expect(store.updates[1]).toEqual({ method: 'merge', expectedHeadOid: 'newhead1' });
  });

  test('a successful update that leaves the head current drops the control after one reread', async () => {
    const { root, events } = mountCurrency(openStatus({ behindBy: 2 }));
    store.stageBranchUpdate(async () => {
      const current = store.mergeStatus.value;
      if (current) {
        store.mergeStatus.value = { ...current, behindBy: 0 };
      }
      return true;
    });

    click(updateButton(root));
    await settle();
    click(updateButton(root));
    await settle();

    expect(events).toEqual(['branch-updated']);
    expect(currencyRow(root)?.classList.contains('merge-box__row--success')).toBe(true);
    expect(currencyText(root)).toBe('This branch is current with main.');
    expect(updateRoot(root)).toBeNull();
  });

  test('opening another pull request closes the menu, clears confirmation, and selects merge', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const pullNumber = ref(4);
    const status = shallowRef(
      openStatus({ behindBy: 2, allowedMergeMethods: ['merge', 'rebase'], headSha: 'aaaaaaa' })
    );
    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: pullNumber.value,
          initialStatus: status.value,
        }),
    });
    const root = dom.mount(Harness).root;

    click(updateToggle(root));
    await settle();
    click(updateRoot(root)?.querySelectorAll('.merge-box__method-option')[1] ?? null);
    await settle();
    click(updateToggle(root));
    await settle();
    expect(updateButton(root)?.textContent?.trim()).toBe('Rebase branch');
    expect(updateOptions(root)).toHaveLength(2);
    store.branchUpdateError.value = 'stale update';

    pullNumber.value = 9;
    status.value = openStatus({
      behindBy: 2,
      allowedMergeMethods: ['merge', 'rebase'],
      headSha: 'bbbbbbb',
    });
    await settle();

    expect(updateOptions(root)).toEqual([]);
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
    expect(store.branchUpdateError.value).toBeNull();

    click(updateButton(root));
    await settle();
    expect(updateButton(root)?.textContent?.trim()).toBe('Confirm update');

    pullNumber.value = 10;
    status.value = openStatus({
      behindBy: 2,
      allowedMergeMethods: ['merge', 'rebase'],
      headSha: 'ccccccc',
    });
    await settle();

    expect(updateRoot(root)?.querySelector('.merge-box__cancel-btn')).toBeNull();
    expect(updateButton(root)?.textContent?.trim()).toBe('Update branch');
  });
});

describe('PRMergeBox regression suite', () => {
  const linearStack = (
    firstState: 'open' | 'merged' | 'draft' | 'closed' = 'open',
    history: 'linear' | 'not-linear' = 'linear'
  ) => ({
    number: 106,
    trunk: 'main',
    count: 2,
    place: 2,
    history,
    layers: [
      {
        number: 101,
        title: 'Add the model',
        state: firstState,
        headSha: 'head-101',
        baseRef: 'main',
        baseSha: 'base-101',
      },
      {
        number: 102,
        title: 'Add the API',
        state: 'open' as const,
        headSha: 'head-102',
        baseRef: 'feat/model',
        baseSha: 'head-101',
      },
    ],
  });

  test('reopening a closed pull request resets terminal status and fetches fresh merge status', async () => {
    store = createMergeStatusStore();
    let reads = 0;
    store.fetchMergeStatus = async () => {
      reads += 1;
      store.mergeStatus.value = openStatus();
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const initialStatus = shallowRef<Record<string, unknown> | null>(
      openStatus({ state: 'closed', merged: false })
    );

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: initialStatus.value,
        }),
    });
    const root = dom.mount(Harness).root;
    expect(root.querySelector('.merge-box__panel--closed')).not.toBeNull();
    expect(reads).toBe(0);

    // Reopening clears the terminal preload so initialStatus becomes null.
    initialStatus.value = null;
    await settle();

    expect(reads).toBe(1);
    expect(root.querySelector('.merge-box__panel--closed')).toBeNull();
    expect(root.querySelector('.merge-box__merge-btn')?.textContent?.trim()).toBe(
      'Merge pull request'
    );
  });

  test('switching from a closed pull request to an open pull request fetches status only once', async () => {
    store = createMergeStatusStore();
    let reads = 0;
    store.fetchMergeStatus = async () => {
      reads += 1;
      store.mergeStatus.value = openStatus();
      return null;
    };
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const pullNumber = ref(101);
    const initialStatus = shallowRef<Record<string, unknown> | null>(
      openStatus({ state: 'closed', merged: false })
    );

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: pullNumber.value,
          initialStatus: initialStatus.value,
        }),
    });
    dom.mount(Harness);
    expect(reads).toBe(0);

    pullNumber.value = 102;
    initialStatus.value = null;
    await settle();

    expect(reads).toBe(1);
  });

  test('switching pull requests while mergeStack is in flight ignores the stale result', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const pullNumber = ref(102);
    const mergedEvents: number[] = [];
    let resolveOldMerge: ((result: RecordedStackMergeResult | null) => void) | null = null;

    store.stageStackMerge(
      () =>
        new Promise((resolve) => {
          resolveOldMerge = resolve;
        })
    );

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: pullNumber.value,
          initialStatus: openStatus(),
          stack: linearStack('open'),
          git: { available: true },
          onMerged: () => {
            mergedEvents.push(pullNumber.value);
          },
        }),
    });
    const root = dom.mount(Harness).root;

    // Click Merge -> Confirm merge
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();
    expect(root.querySelector('.merge-box__merge-btn')?.getAttribute('aria-busy')).toBe('true');

    // Switch to another PR while mergeStack is still pending
    pullNumber.value = 103;
    await settle();

    expect(root.querySelector('.merge-box__merge-btn')?.getAttribute('aria-busy')).toBeNull();
    resolveOldMerge?.(null);
    await settle();

    expect(mergedEvents).toEqual([]);
    expect(root.querySelector('.merge-box__note--danger')).toBeNull();
    expect(root.querySelector('.merge-box__merge-btn')?.textContent?.trim()).toBe(
      'Merge pull request'
    );
  });

  test('renders stalled Stack Merge status with Check status button and single unified error alert on failure', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const mergedEvents: string[] = [];

    store.stageStackMerge(async () => ({
      outcome: 'stalled',
      id: 'stack-merge-42',
    }));
    store.stageResumeStackMerge(async () => ({
      outcome: 'landed',
      id: 'stack-merge-42',
    }));

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: openStatus(),
          stack: linearStack('open'),
          git: { available: true },
          onMerged: () => {
            mergedEvents.push('merged');
          },
        }),
    });
    const root = dom.mount(Harness).root;

    click(root.querySelector('.merge-box__merge-btn'));
    await settle();
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();

    expect(root.textContent).toContain('Stack merge is still running on GitHub.');
    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
    expect(root.querySelector('.merge-box__actions [role="alert"]')).toBeNull();

    const checkBtn = root.querySelector<HTMLButtonElement>('.merge-box__check-status-btn');
    expect(checkBtn?.textContent?.trim()).toBe('Check status');
    click(checkBtn);
    await settle();

    expect(store.resumedPolls).toEqual([
      { owner: 'octo', repo: 'app', pullNumber: 102, id: 'stack-merge-42' },
    ]);
    expect(root.textContent).toContain('Stack merge landed');
    expect(mergedEvents).toEqual(['merged']);

    // Now test failure produces ONLY ONE role="alert"
    store.stageStackMerge(async () => {
      store.mergeError.value = 'Required status check is failing';
      return { outcome: 'failed', message: 'Required status check is failing' };
    });
    const FailHarness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: openStatus(),
          stack: linearStack('open'),
          git: { available: true },
        }),
    });
    const failRoot = dom.mount(FailHarness).root;
    click(failRoot.querySelector('.merge-box__merge-btn'));
    await settle();
    click(failRoot.querySelector('.merge-box__merge-btn'));
    await settle();

    const alerts = failRoot.querySelectorAll('.merge-box__actions [role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.textContent?.trim()).toBe('Required status check is failing');
  });

  test('preserves commit form on Layer 2 when Layer 1 is already merged, and blocks Layer 2 when Layer 1 is draft or closed', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const stack = shallowRef(linearStack('merged'));

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: openStatus({ allowedMergeMethods: ['squash'] }),
          stack: stack.value,
          git: { available: true },
        }),
    });
    const root = dom.mount(Harness).root;

    // Layer 1 is already merged, so only Layer 2 (#102) is landing -> commit form opens!
    const form = await openCommitForm(root);
    expect(form).not.toBeNull();
    const listedLayers = [...root.querySelectorAll('.merge-box__stack-layer')].map((el) =>
      el.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(listedLayers).toEqual(['#102 Add the API Open']);

    // If Layer 1 is draft, Layer 2 is blocked with visible inline reason
    stack.value = linearStack('draft');
    await settle();

    const mergeBtn = root.querySelector<HTMLButtonElement>('.merge-box__merge-btn');
    expect(mergeBtn?.hasAttribute('disabled')).toBe(true);
    const reasonEl = root.querySelector('.merge-box__blocked-reason');
    expect(reasonEl?.classList.contains('is-sr-only')).toBe(false);
    expect(reasonEl?.textContent?.trim()).toBe(
      'Lower Layers in this Stack must be open and ready before merging.'
    );
  });

  test('atomic PRStackRebaseDialog posts expectedHeads, handles native @close, persists error in PRMergeBox, and disables Rebase stack while refreshing', async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    let nextResponse: unknown = {
      ok: false,
      results: [
        { number: 101, outcome: 'rebased' },
        { number: 102, outcome: 'failed', message: 'Conflict in api.ts' },
      ],
      error: 'Conflict in api.ts',
    };

    store = createMergeStatusStore();
    dom = createVueDom({
      useI18n: () => ({ t, locale: ref('en') }),
      useGitPulseApiFetch: () => async (url: string, init?: { body?: unknown }) => {
        requests.push({ url, body: init?.body });
        return nextResponse;
      },
    });
    const stack = shallowRef(linearStack('open', 'not-linear'));

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 102,
          initialStatus: openStatus(),
          stack: stack.value,
          git: { available: true },
        }),
    });
    const root = dom.mount(Harness).root;

    const rebaseBtn = () => root.querySelector<HTMLButtonElement>('.merge-box__rebase-stack-btn');

    // A failed reread also disables Rebase stack until error clears
    store.error.value = 'Failed to reread';
    await settle();
    expect(rebaseBtn()?.hasAttribute('disabled')).toBe(true);
    store.error.value = null;
    await settle();
    expect(rebaseBtn()?.hasAttribute('disabled')).toBe(false);

    click(rebaseBtn());
    await settle();

    const dialog = root.querySelector<HTMLDialogElement>('dialog.stack-rebase');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('closedby')).toBe('any');
    // Single polite sr-only live region, no per-row role="status"
    expect(dialog?.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(dialog?.querySelector('[role="status"]')?.classList.contains('is-sr-only')).toBe(true);

    const confirmBtn = dialog?.querySelector<HTMLButtonElement>('.stack-rebase__btn--primary');
    click(confirmBtn ?? null);
    await settle();
    expect(dialog?.getAttribute('closedby')).toBe('any');

    expect(requests).toEqual([
      {
        url: '/api/pulls/octo/app/102/stack-rebase',
        body: {
          stackNumber: 106,
          expectedHeads: {
            '101': 'head-101',
            '102': 'head-102',
          },
        },
      },
    ]);

    // Native close event on <dialog> closes the modal and leaves error visible in PRMergeBox
    dialog?.dispatchEvent(new dom.window.Event('close'));
    await settle();

    expect(root.querySelector('dialog.stack-rebase')).toBeNull();
    const persistedAlert = root.querySelector('.merge-box__actions [role="alert"]');
    expect(persistedAlert?.textContent?.trim()).toBe('Conflict in api.ts');

    // Re-opening clears persisted error; succeeding disables button until stack prop updates
    nextResponse = {
      ok: true,
      results: [
        { number: 101, outcome: 'current' },
        { number: 102, outcome: 'rebased' },
      ],
    };
    click(rebaseBtn());
    await settle();
    expect(root.querySelector('.merge-box__actions [role="alert"]')).toBeNull();

    const reopenedDialog = root.querySelector<HTMLDialogElement>('dialog.stack-rebase');
    click(reopenedDialog?.querySelector<HTMLButtonElement>('.stack-rebase__btn--primary') ?? null);
    await settle();
    reopenedDialog?.dispatchEvent(new dom.window.Event('close'));
    await settle();

    expect(rebaseBtn()?.hasAttribute('disabled')).toBe(true);
    stack.value = { ...stack.value };
    await settle();
    expect(rebaseBtn()?.hasAttribute('disabled')).toBe(false);
  });

  test('re-fetches merge status when refreshVersion increments without initialStatus', async () => {
    store = createMergeStatusStore();
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    let fetchCalls = 0;
    store.fetchMergeStatus = async () => {
      fetchCalls += 1;
      return null;
    };

    const refreshVersion = shallowRef(0);
    const initialStatus = shallowRef<Record<string, unknown> | null>(null);

    const Harness = defineComponent({
      setup: () => () =>
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: 4,
          initialStatus: initialStatus.value,
          refreshVersion: refreshVersion.value,
        }),
    });
    dom.mount(Harness);
    await settle();
    expect(fetchCalls).toBe(1);

    refreshVersion.value += 1;
    await settle();
    expect(fetchCalls).toBe(2);

    initialStatus.value = openStatus();
    await settle();
    refreshVersion.value += 1;
    await settle();
    expect(fetchCalls).toBe(2);
  });
});
