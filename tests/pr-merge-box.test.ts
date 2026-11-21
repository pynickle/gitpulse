import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef, type Component } from 'vue';

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

const messages: Record<string, string> = {
  'prReview.mergeBox.methodMerge': 'Merge pull request',
  'prReview.mergeBox.methodSquash': 'Squash and merge',
  'prReview.mergeBox.methodRebase': 'Rebase and merge',
  'prReview.mergeBox.selectMethod': 'Select merge method',
  'prReview.mergeBox.reviewNone': 'No reviews required',
  'prReview.mergeBox.reviewRequired': 'Review required',
  'prReview.mergeBox.mergeableClean': 'This branch has no conflicts with the base branch',
  'prReview.mergeBox.mergeableDirty': 'This branch has conflicts that must be resolved',
  'prReview.mergeBox.mergeableChecking': 'Checking mergeability...',
  'prReview.mergeBox.checksFailed': 'Some checks were not successful',
  'prReview.mergeBox.cancel': 'Cancel',
  'prReview.mergeBox.loading': 'Loading merge status...',
  'prReview.mergeBox.loadingCommitDefaults': 'Loading the default commit message...',
  'prReview.mergeBox.merged': 'Merged',
  'prReview.mergeBox.closedTitle': 'Closed without merging',
  'prReview.mergeBox.branchCurrent': 'This branch is current with {base}.',
  'prReview.mergeBox.branchBehindOne': 'This branch is 1 commit behind {base} ({sha}).',
  'prReview.mergeBox.branchBehindMany': 'This branch is {count} commits behind {base} ({sha}).',
  'prReview.mergeBox.branchUnreadable': 'Branch currency could not be read.',
  'prReview.mergeBox.updateBranch': 'Update branch',
  'prReview.mergeBox.rebaseBranch': 'Rebase branch',
  'prReview.mergeBox.confirmUpdateBranch': 'Confirm update',
  'prReview.mergeBox.confirmRebaseBranch': 'Confirm rebase',
  'prReview.mergeBox.updating': 'Updating...',
  'prReview.mergeBox.selectUpdateMethod': 'Select update method',
  'prReview.mergeBox.updateWithMerge': 'Update with a merge commit',
  'prReview.mergeBox.updateWithRebase': 'Update with rebase',
};

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(messages[key] ?? key, params);

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
function createMergeStatusStore({ holdDefaults = false } = {}) {
  const mergeStatus = shallowRef<Record<string, unknown> | null>(null);
  const merges: RecordedMerge[] = [];
  const updates: RecordedUpdate[] = [];
  const branchUpdateError = ref<string | null>(null);
  const defaults = shallowRef<CommitDefaults | null>(null);
  const defaultsGate = holdDefaults ? createDeferred() : null;
  let defaultsReads = 0;
  let finishUpdate = async (_payload: RecordedUpdate): Promise<boolean> => true;

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
  };

  return store;
}

let store: ReturnType<typeof createMergeStatusStore>;
let dom: ReturnType<typeof createVueDom>;

const MergeBox = await compileVue(
  'app/components/dashboard/pr/PRMergeBox.vue',
  {
    ...githubProfileLinkModules,
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
