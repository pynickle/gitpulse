import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef, type Component } from 'vue';

import * as prChecks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });
const slotStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
});

const messages: Record<string, string> = {
  'prReview.mergeBox.methodMerge': 'Merge pull request',
  'prReview.mergeBox.methodSquash': 'Squash and merge',
  'prReview.mergeBox.methodRebase': 'Rebase and merge',
  'prReview.mergeBox.selectMethod': 'Select merge method',
  'prReview.mergeBox.reviewNone': 'No reviews required',
  'prReview.mergeBox.mergeableClean': 'This branch has no conflicts with the base branch',
  'prReview.mergeBox.cancel': 'Cancel',
  'prReview.mergeBox.loadingCommitDefaults': 'Loading the default commit message...',
};

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(messages[key] ?? key, params);

type MergeMethod = 'merge' | 'squash' | 'rebase';

interface RecordedMerge {
  method: string;
  commitTitle?: string;
  commitMessage?: string;
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
function createMergeStatusStore({ holdDefaults = false } = {}) {
  const mergeStatus = shallowRef<Record<string, unknown> | null>(null);
  const merges: RecordedMerge[] = [];
  const defaults = shallowRef<CommitDefaults | null>(null);
  const defaultsGate = holdDefaults ? createDeferred() : null;
  let defaultsReads = 0;

  const store = {
    mergeStatus,
    loading: ref(false),
    error: ref<string | null>(null),
    mergeError: ref<string | null>(null),
    branchActionError: ref<string | null>(null),
    commitDefaults: defaults,
    setMergeStatus: (value: Record<string, unknown> | null) => {
      mergeStatus.value = value;
    },
    fetchMergeStatus: async () => null,
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
    deleteHeadBranch: async () => true,
    restoreHeadBranch: async () => true,
    merges,
  };

  return store;
}

let store: ReturnType<typeof createMergeStatusStore>;
let dom: ReturnType<typeof createVueDom>;

const MergeBox = await compileVue(
  'app/components/dashboard/pr/PRMergeBox.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': { useI18n: () => ({ t, locale: ref('en') }) },
    '#shared/utils/pr-checks': prChecks,
    '~/components/dashboard/pr/CheckListRows.vue': { default: slotStub },
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

function mountMergeBox(allowedMergeMethods: MergeMethod[], options?: { holdDefaults?: boolean }) {
  store = createMergeStatusStore(options);
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
