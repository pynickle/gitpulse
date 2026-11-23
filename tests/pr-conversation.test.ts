import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, onScopeDispose, ref, shallowRef, type Component } from 'vue';

const { usePRMergeStatus: readMergeStatus } = await import('../app/composables/usePRMergeStatus');

import { formatDurationFromNow } from '../app/utils/formatDurationFromNow';
import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import { getPullRequestStateVisual } from '../app/utils/getPullRequestStateVisual';
import { resolvePullRequestBranchRef } from '../app/utils/resolvePullRequestBranchRef';
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
  'prReview.noDescription': 'No description provided',
  'prReview.stackChip.place': 'Layer {place} of {count}',
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
  'prReview.mergeBox.confirmMerge': 'Confirm merge',
  'prReview.mergeBox.confirmSquash': 'Confirm squash and merge',
  'prReview.mergeBox.commitTitleLabel': 'Commit title',
  'prReview.mergeBox.commitMessageLabel': 'Commit message',
  'prReview.mergeBox.stackMergeLanded': 'Stack merge landed',
  'prReview.mergeBox.stackMergeQueued': 'Entered the merge queue',
  'prReview.mergeBox.stackMergeFailed': 'Stack merge failed',
  'prReview.stackRebase.title': 'Rebase stack',
  'prReview.stackRebase.description':
    'Rebase each open branch onto the branch below it, starting from {trunk}.',
  'prReview.stackRebase.notice':
    'Each rebased branch is force-pushed. The operation stops at the first failure.',
  'prReview.stackRebase.confirm': 'Confirm rebase',
  'prReview.stackRebase.rebasing': 'Rebasing',
  'prReview.stackRebase.rebased': 'Rebased',
  'prReview.stackRebase.current': 'Up to date',
  'prReview.stackRebase.failed': 'Failed',
  'prReview.stackRebase.pending': 'Pending',
  'prReview.stackRebase.skipped': 'Not rebased',
  'prReview.stackDetail.title': 'Stack',
  'prReview.stackDetail.close': 'Close',
  'prReview.stackDetail.current': 'Current',
  'prReview.stackDetail.state.open': 'Open',
  'prReview.stackDetail.state.draft': 'Draft',
  'prReview.stackDetail.state.closed': 'Closed',
  'prReview.stackDetail.state.merged': 'Merged',
  'prReview.mergeBox.unavailableReason_stack_not_linear':
    'Only a linear Stack can merge. Rebase the Stack first.',
  'prReview.mergeBox.unavailableReason_stack_rebase_disabled':
    'Stack Rebase is switched off on this deployment.',
  'prReview.mergeBox.unavailableReason_stack_history_unknown':
    'The Stack history could not be read.',
  'prReview.mergeBox.unavailableReason_git_missing':
    'This server has no Git, so it cannot rebase a Stack.',
};

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(messages[key] ?? key, params);

interface RecordedMerge {
  method: string;
  commitTitle?: string;
  commitMessage?: string;
}

interface RecordedUpdate {
  method: string;
  expectedHeadOid: string;
}

interface RecordedStackMerge extends RecordedMerge {
  owner: string;
  repo: string;
  pullNumber: number;
}

interface StackMergeResult {
  outcome: 'in-progress' | 'landed' | 'queued' | 'failed';
  message?: string;
}

function createMergeStatusStore() {
  const mergeStatus = shallowRef<Record<string, unknown> | null>(null);
  const branchUpdateError = ref<string | null>(null);
  const merges: RecordedMerge[] = [];
  const stackMerges: RecordedStackMerge[] = [];
  let finishStackMerge: (result: StackMergeResult) => void = () => {};

  return {
    mergeStatus,
    loading: ref(false),
    error: ref<string | null>(null),
    mergeError: ref<string | null>(null),
    branchActionError: ref<string | null>(null),
    branchUpdateError,
    commitDefaults: shallowRef(null),
    merges,
    stackMerges,
    setMergeStatus: (value: Record<string, unknown> | null) => {
      mergeStatus.value = value;
      branchUpdateError.value = null;
    },
    resetMergeStatus: () => {
      mergeStatus.value = null;
      branchUpdateError.value = null;
    },
    fetchMergeStatus: async () => null,
    fetchCommitDefaults: async () => null,
    clearCommitDefaults: () => {},
    mergePullRequest: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      payload: RecordedMerge
    ) => {
      merges.push(payload);
      return true;
    },
    mergeStack: async (owner: string, repo: string, pullNumber: number, payload: RecordedMerge) => {
      stackMerges.push({ owner, repo, pullNumber, ...payload });
      return new Promise<StackMergeResult>((resolve) => {
        finishStackMerge = resolve;
      });
    },
    settleStackMerge: (result: StackMergeResult) => finishStackMerge(result),
    deleteHeadBranch: async () => true,
    restoreHeadBranch: async () => true,
    updatePullRequestBranch: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      _payload: RecordedUpdate
    ) => true,
  };
}

let store: ReturnType<typeof createMergeStatusStore>;
let dom: ReturnType<typeof createVueDom>;
let useRealStackMerge = false;
let switchedPullRequest: { owner: string; repo: string; pullNumber: number } | null = null;

const i18n = { useI18n: () => ({ t, locale: ref('en') }) };
const relativeTime = { useRelativeTimeNow: () => shallowRef(0) };
const duration = { formatDurationFromNow };

const PickerModal = await compileVue('app/components/dashboard/PickerModal.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  '~/components/ui/ScrollArea.vue': { default: slotStub },
});

const StackDetail = await compileVue('app/components/dashboard/pr/PRStackDetail.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  'vue-i18n': i18n,
  '~/components/dashboard/PickerModal.vue': { default: PickerModal },
});

const StackChip = await compileVue('app/components/dashboard/pr/PRStackChip.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  'vue-i18n': i18n,
  '~/components/dashboard/pr/PRStackDetail.vue': { default: StackDetail },
});

const StackRebaseDialog = await compileVue(
  'app/components/dashboard/pr/PRStackRebaseDialog.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': i18n,
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
  },
  { getFetchErrorMessage: '~/utils/getFetchErrorMessage' }
);

const Header = await compileVue(
  'app/components/dashboard/pr/PRHeader.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': i18n,
    '~/components/dashboard/pr/PRStackChip.vue': { default: StackChip },
    '~/components/dashboard/reactions/ReactionBar.vue': { default: slotStub },
    '~/components/ui/GitHubAvatar.vue': { default: slotStub },
    '~/components/ui/MarkdownRenderer.vue': { default: slotStub },
    '~/utils/getPullRequestStateVisual': { getPullRequestStateVisual },
    '~/utils/resolvePullRequestBranchRef': { resolvePullRequestBranchRef },
    '~/composables/useDashboardRepositoryNavigation': {
      useDashboardRepositoryNavigation: () => ({ openRepository: async () => {} }),
    },
    '~/composables/useRelativeTimeNow': relativeTime,
    '~/utils/formatDurationFromNow': duration,
  },
  {
    useDashboardRepositoryNavigation: '~/composables/useDashboardRepositoryNavigation',
    useRelativeTimeNow: '~/composables/useRelativeTimeNow',
    formatDurationFromNow: '~/utils/formatDurationFromNow',
  }
);

const MergeBox = await compileVue(
  'app/components/dashboard/pr/PRMergeBox.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    'vue-i18n': i18n,
    '#shared/utils/pr-checks': prChecks,
    '~/components/dashboard/pr/CheckListRows.vue': { default: slotStub },
    '~/components/dashboard/pr/PRStackRebaseDialog.vue': { default: StackRebaseDialog },
    '~/components/ui/GitHubAvatar.vue': { default: slotStub },
    '~/components/ui/ScrollArea.vue': { default: slotStub },
    '~/utils/getCheckStatusToneIcon': { getCheckStatusToneIcon: () => icon },
    '~/composables/usePRMergeStatus': {
      usePRMergeStatus: () => (useRealStackMerge ? readMergeStatus() : store),
    },
    '~/composables/useRelativeTimeNow': relativeTime,
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => '' },
  },
  {
    getCheckStatusToneIcon: '~/utils/getCheckStatusToneIcon',
    usePRMergeStatus: '~/composables/usePRMergeStatus',
    useRelativeTimeNow: '~/composables/useRelativeTimeNow',
    formatDurationFromNow: '~/utils/formatDurationFromNow',
  }
);

const stackLayers = [
  { number: 101, title: 'Add the model', state: 'merged' as const, headSha: 'head-101' },
  { number: 102, title: 'Add the API', state: 'open' as const, headSha: 'head-102' },
  { number: 103, title: 'Add the screen', state: 'draft' as const, headSha: 'head-103' },
  { number: 104, title: 'Add the notes', state: 'closed' as const, headSha: 'head-104' },
].map((layer) => ({ ...layer, baseRef: 'main', baseSha: 'old-base', rebaseProof: 'rebase-proof' }));

type StackHistory = 'linear' | 'not-linear' | 'unknown';

function layerPullRequest(history: StackHistory = 'linear', place = 2) {
  const current = stackLayers[place - 1] ?? stackLayers[1];
  return {
    title: current?.title ?? 'Add the API',
    number: current?.number ?? 102,
    state: 'open',
    updated_at: '2026-04-15T10:00:00Z',
    created_at: '2026-04-15T10:00:00Z',
    user: { login: 'octocat', avatar_url: '', html_url: 'https://github.com/octocat' },
    stack: {
      number: 106,
      trunk: 'main',
      count: stackLayers.length,
      place,
      history,
      layers: stackLayers,
      hasConflicts: false,
    },
  };
}

type ConversationPullRequest = Omit<ReturnType<typeof layerPullRequest>, 'stack'> & {
  stack?: ReturnType<typeof layerPullRequest>['stack'] | null;
};

type StackMergeFetch = (request: unknown, init?: { method?: string; body?: unknown }) => unknown;

const failedChecks = {
  state: 'FAILURE',
  contexts: {
    totalCount: 1,
    nodes: [{ name: 'build', conclusion: 'FAILURE', status: 'COMPLETED' }],
  },
};

function openMergeStatus(options?: {
  viewerCanMerge?: boolean;
  behindBy?: number;
  viewerCanWriteHead?: boolean;
}) {
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
    checkRollup: failedChecks,
    headSha: 'abc123',
    headBranch: null,
    viewerCanMerge: options?.viewerCanMerge ?? true,
    allowedMergeMethods: ['merge', 'squash', 'rebase'],
    behindBy: options?.behindBy ?? 0,
    baseRef: 'main',
    baseSha: '1234567890abcdef',
    viewerCanWriteHead: options?.viewerCanWriteHead ?? true,
  };
}

function mountConversation(options?: {
  pullRequest?: ConversationPullRequest;
  viewerCanMerge?: boolean;
  behindBy?: number;
  viewerCanWriteHead?: boolean;
  fetch?: StackMergeFetch;
  git?: { available: boolean; reason?: string } | null;
}) {
  switchedPullRequest = null;
  useRealStackMerge = Boolean(options?.fetch);
  store = createMergeStatusStore();
  const pullRequest = shallowRef<ConversationPullRequest>(
    options?.pullRequest ?? layerPullRequest()
  );
  const initialStatus = openMergeStatus(options);
  const git = options && 'git' in options ? (options.git ?? null) : { available: true };
  dom = createVueDom({
    useI18n: () => ({ t, locale: ref('en') }),
    ...(options?.fetch
      ? {
          shallowRef,
          onScopeDispose,
          useGitPulseApiFetch: () => options.fetch,
        }
      : {}),
  });

  const Harness = defineComponent({
    setup: () => () =>
      h('div', [
        h(Header as Component, {
          pullRequest: pullRequest.value,
          repoOwner: 'octo',
          repoName: 'app',
          onSwitchPullRequest: (owner: string, repo: string, pullNumber: number) => {
            switchedPullRequest = { owner, repo, pullNumber };
          },
        }),
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: pullRequest.value.number,
          stack: pullRequest.value.stack ?? null,
          git,
          initialStatus,
        }),
      ]),
  });

  const mounted = dom.mount(Harness);
  return Object.assign(mounted.root, {
    unmount: () => {
      mounted.unmount();
    },
    setStack(next: ConversationPullRequest['stack']) {
      pullRequest.value = { ...pullRequest.value, stack: next };
    },
  });
}

afterEach(async () => {
  useRealStackMerge = false;
  await dom.cleanup();
});

const click = (element: Element | null | undefined) =>
  element?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

const settle = async () => {
  await Promise.resolve();
  await nextTick();
  await nextTick();
};

const layerText = (element: Element) => element.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';

function layerTexts(root: HTMLElement) {
  return [...root.querySelectorAll('.merge-box__stack-layer')].map((node) =>
    node.textContent?.replace(/\s+/g, ' ').trim()
  );
}

function stackRebaseControl(root: ParentNode) {
  return (
    [...root.querySelectorAll('button, [role="button"]')].find((control) =>
      /rebase stack/i.test(
        `${control.textContent ?? ''} ${control.getAttribute('aria-label') ?? ''}`
      )
    ) ?? null
  );
}

/** The Stack Merge wait is two seconds. Collapse it so a slow landing stays in this test. */
function collapseStackMergeWait() {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
    original(handler, timeout === 2_000 ? 0 : timeout, ...args)) as typeof setTimeout;
  return () => {
    globalThis.setTimeout = original;
  };
}

const flushMacrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

async function chooseSquash(root: HTMLElement) {
  click(root.querySelector('.merge-box__method-toggle'));
  await settle();
  const option = [...root.querySelectorAll('.merge-box__method-option')].find((node) =>
    node.textContent?.includes('Squash and merge')
  );
  click(option);
  await settle();
}

async function openStackConfirmation(root: HTMLElement) {
  await chooseSquash(root);
  click(root.querySelector('.merge-box__merge-btn'));
  await settle();
}

describe('Stack Merge', () => {
  test('confirms the Layers from the first through this one and sends no commit text', async () => {
    const root = mountConversation({ behindBy: 2 });

    expect(root.textContent).toContain('Layer 2 of 4');
    const chip = root.querySelector<HTMLElement>('.pr-stack-chip');
    expect(chip).not.toBeNull();
    chip?.click();
    await nextTick();

    const dialog = root.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('main');
    expect([...dialog!.querySelectorAll('.pr-stack-detail__layer')].map(layerText)).toEqual([
      '#101 Add the model Merged',
      '#102 Add the API Open Current',
      '#103 Add the screen Draft',
      '#104 Add the notes Closed',
    ]);
    dialog?.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
    await nextTick();

    expect(root.textContent).toContain('No reviews required');
    expect(root.textContent).toContain('Some checks were not successful');
    expect(root.textContent).toContain('This branch has no conflicts with the base branch');
    expect(root.textContent).toContain('This branch is 2 commits behind main (1234567).');
    expect(root.querySelector('.merge-box__update')).toBeNull();

    await openStackConfirmation(root);

    expect(layerTexts(root)).toEqual(['#101 Add the model Merged', '#102 Add the API Open']);
    expect(root.querySelector('.merge-box__commit-form')).toBeNull();
    expect(store.stackMerges).toEqual([]);
    expect(store.merges).toEqual([]);

    click(root.querySelector('.merge-box__merge-btn'));
    await settle();

    expect(store.stackMerges).toEqual([
      { owner: 'octo', repo: 'app', pullNumber: 102, method: 'squash' },
    ]);
    expect(store.merges).toEqual([]);
    // The merge button's spinner is the progress; no second line repeats it.
    expect(root.querySelector('.merge-box__merge-btn')?.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.merge-box__stack-outcome')).toBeNull();

    store.settleStackMerge({ outcome: 'landed' });
    await settle();

    expect(root.textContent).toContain('Stack merge landed');
    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
  });

  test('sends the commit title and message when only the first Layer lands', async () => {
    const root = mountConversation({ pullRequest: layerPullRequest('linear', 1) });

    await openStackConfirmation(root);

    expect(layerTexts(root)).toEqual(['#101 Add the model Merged']);
    const form = root.querySelector<HTMLFormElement>('.merge-box__commit-form');
    const title = form?.querySelector<HTMLInputElement>('.merge-box__commit-input');
    const message = form?.querySelector<HTMLTextAreaElement>('.merge-box__commit-textarea');
    if (title) {
      title.value = 'Land the model';
      title.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    if (message) {
      message.value = 'Keep the schema change.';
      message.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    await nextTick();

    form?.dispatchEvent(new dom.window.Event('submit'));
    await settle();

    expect(store.merges).toEqual([]);
    expect(store.stackMerges).toEqual([
      {
        owner: 'octo',
        repo: 'app',
        pullNumber: 101,
        method: 'squash',
        commitTitle: 'Land the model',
        commitMessage: 'Keep the schema change.',
      },
    ]);
  });

  test('shows that the Stack Merge entered the merge queue', async () => {
    const root = mountConversation();

    await openStackConfirmation(root);
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();
    store.settleStackMerge({ outcome: 'queued' });
    await settle();

    expect(root.textContent).toContain('Entered the merge queue');
    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
    expect(
      [...root.querySelectorAll('button')].some((button) => /queue/i.test(button.textContent ?? ''))
    ).toBe(false);
  });

  test('shows that the Stack Merge failed', async () => {
    const root = mountConversation();

    await openStackConfirmation(root);
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();
    store.settleStackMerge({ outcome: 'failed' });
    await settle();

    expect(root.textContent).toContain('Stack merge failed');
  });

  test('offers no Stack Merge to a reader who cannot merge', () => {
    const root = mountConversation({ viewerCanMerge: false, behindBy: 2 });

    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
    expect(root.querySelector('.merge-box__stack-layer')).toBeNull();
    expect(root.querySelector('.merge-box__update')).toBeNull();
    expect(root.textContent).toContain('No reviews required');
    expect(root.textContent).toContain('Some checks were not successful');
  });

  test('confirms before rebasing each active layer from the bottom and stops at a failure', async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    let finishFirst: (result: { outcome: 'rebased' }) => void = () => {};
    const pullRequest = layerPullRequest('not-linear');
    const layers = [
      ...pullRequest.stack.layers,
      {
        number: 105,
        title: 'Add the footer',
        state: 'open' as const,
        headSha: 'head-105',
        baseRef: 'main',
        baseSha: 'old-base',
        rebaseProof: 'rebase-proof',
      },
    ];
    const root = mountConversation({
      pullRequest: {
        ...pullRequest,
        stack: { ...pullRequest.stack, layers, count: layers.length },
      },
      behindBy: 2,
      fetch: (path, options) => {
        const url = String(path);
        if (!url.endsWith('/stack-rebase')) return openMergeStatus();
        requests.push({ path: url, body: options?.body });
        if (url.includes('/102/')) return new Promise((resolve) => (finishFirst = resolve));
        throw new Error('Rebase conflict');
      },
    });

    // The merge action stays on screen for a reader who may merge, but a Stack that
    // is not linear has nothing to land here, so it answers with a refusal.
    expect(root.querySelector('.merge-box__merge-btn')?.hasAttribute('disabled')).toBe(true);
    const trigger = stackRebaseControl(root);
    expect(trigger).not.toBeNull();
    click(trigger);
    await settle();
    const dialog = root.ownerDocument.querySelector('dialog, [role="dialog"]');
    expect(dialog?.textContent).toContain('Add the notes');
    expect(requests).toEqual([]);
    click(
      [...dialog!.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('Confirm rebase')
      )
    );
    await settle();
    expect(requests).toEqual([
      {
        path: '/api/pulls/octo/app/102/stack-rebase',
        body: {
          expectedHeadOid: 'head-102',
          stackNumber: 106,
          baseRef: 'main',
          baseSha: 'old-base',
          proof: 'rebase-proof',
        },
      },
    ]);
    const row = (number: number) =>
      [...dialog!.querySelectorAll('li')].find((item) => item.textContent?.includes(`#${number}`));
    expect(row(102)?.textContent).toContain('Rebasing');
    expect(row(102)?.getAttribute('data-state')).toBe('rebasing');
    finishFirst({ outcome: 'rebased' });
    await settle();
    expect(requests.map((request) => request.path)).toEqual([
      '/api/pulls/octo/app/102/stack-rebase',
      '/api/pulls/octo/app/103/stack-rebase',
    ]);
    expect(row(102)?.textContent).toContain('Rebased');
    expect(row(103)?.textContent).toContain('Failed');
    expect(row(105)?.textContent).toContain('Not rebased');
    expect(row(105)?.getAttribute('data-state')).toBe('skipped');
    expect(dialog?.textContent).toContain('Rebase conflict');
    expect(root.querySelector('.merge-box__update')).toBeNull();
  });

  test('hides Rebase stack when a different layer has a known conflict', async () => {
    const pullRequest = layerPullRequest('not-linear');
    const root = mountConversation({ pullRequest });
    expect(stackRebaseControl(root)).not.toBeNull();

    root.setStack({ ...pullRequest.stack, hasConflicts: true });
    await settle();
    expect(stackRebaseControl(root)).toBeNull();
    // The merge action does not vanish with it; a conflicting Stack still owes an answer.
    expect(root.querySelector('.merge-box__merge-btn')).not.toBeNull();
  });

  test('offers no Stack Rebase when the history is unknown, then offers Stack Merge once it is linear', async () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('unknown'),
      behindBy: 2,
    });

    expect(stackRebaseControl(root)).toBeNull();
    expect(root.textContent).not.toContain('Stack Rebase');
    // Nothing can land while the history is unknown, and the button says so instead
    // of disappearing.
    expect(root.querySelector('.merge-box__merge-btn')?.hasAttribute('disabled')).toBe(true);
    expect(root.querySelector('.merge-box__update')).toBeNull();
    expect(store.merges).toEqual([]);
    expect(store.stackMerges).toEqual([]);

    root.setStack(layerPullRequest().stack);
    await settle();

    expect(stackRebaseControl(root)).toBeNull();
    expect(root.textContent).not.toContain('Stack Rebase');
    expect(root.querySelector('.merge-box__actions .merge-box__merge-btn')?.textContent).toContain(
      'Merge pull request'
    );
    expect(root.querySelector('.merge-box__update')).toBeNull();
  });

  test('hides Rebase stack on a deployment that switched Git off', () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('not-linear'),
      behindBy: 2,
      git: { available: false, reason: 'disabled' },
    });

    expect(stackRebaseControl(root)).toBeNull();
    // The merge button stays, and carries the reason Stack Rebase is not offered.
    expect(root.querySelector('.merge-box__merge-btn')?.hasAttribute('disabled')).toBe(true);
    expect(root.textContent).toContain('Stack Rebase is switched off on this deployment.');
  });

  test('keeps Rebase stack visible but disabled when the server has no Git', () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('not-linear'),
      behindBy: 2,
      git: { available: false, reason: 'git_missing' },
    });

    const trigger = stackRebaseControl(root);
    expect(trigger).not.toBeNull();
    expect(trigger?.hasAttribute('disabled')).toBe(true);
    expect(trigger?.getAttribute('title')).toBe(
      'This server has no Git, so it cannot rebase a Stack.'
    );
    expect(root.textContent).toContain('This server has no Git, so it cannot rebase a Stack.');
  });

  test('offers Rebase stack on a deployment whose server has Git', () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('not-linear'),
      behindBy: 2,
      git: { available: true },
    });

    const trigger = stackRebaseControl(root);
    expect(trigger).not.toBeNull();
    expect(trigger?.hasAttribute('disabled')).toBe(false);
    expect(trigger?.hasAttribute('title')).toBe(false);
  });

  test('offers no Stack Rebase to a reader who cannot merge', () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('not-linear'),
      viewerCanMerge: false,
      behindBy: 2,
    });

    expect(stackRebaseControl(root)).toBeNull();
    expect(root.textContent).not.toContain('Stack Rebase');
    expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
    expect(root.querySelector('.merge-box__update')).toBeNull();
    expect(root.textContent).toContain('No reviews required');
    expect(root.textContent).toContain('Some checks were not successful');
  });

  test('a pull request that is not a Layer keeps its merge and branch update', () => {
    const root = mountConversation({
      pullRequest: { ...layerPullRequest(), stack: null },
      behindBy: 2,
    });

    expect(root.querySelector('.merge-box__actions .merge-box__merge-btn')?.textContent).toContain(
      'Merge pull request'
    );
    expect(root.textContent).toContain('Update branch');
    expect(root.querySelector('.merge-box__stack-layer')).toBeNull();
  });

  const stackMergeId = '11111111-1111-4111-8111-111111111111';

  test('waits until a slow Stack Merge lands instead of staying in progress', async () => {
    let reads = 0;
    const restoreWait = collapseStackMergeWait();
    try {
      const root = mountConversation({
        fetch: (request, init) => {
          const url = String(request);
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url.endsWith('/stack-merge')) {
            return { outcome: 'in-progress', id: stackMergeId };
          }
          if (url.includes(`/stack-merge/${stackMergeId}`)) {
            reads += 1;
            return reads > 15
              ? { outcome: 'landed' }
              : { outcome: 'in-progress', id: stackMergeId };
          }
          return openMergeStatus();
        },
      });

      await openStackConfirmation(root);
      click(root.querySelector('.merge-box__merge-btn'));

      for (
        let turn = 0;
        turn < 40 && !root.textContent?.includes('Stack merge landed');
        turn += 1
      ) {
        await flushMacrotask();
        await settle();
      }

      expect(reads).toBeGreaterThan(15);
      expect(root.textContent).toContain('Stack merge landed');
      expect(root.querySelector('.merge-box__merge-btn')).toBeNull();
    } finally {
      restoreWait();
    }
  });

  test('shows that a Stack Merge which cannot be polled failed', async () => {
    const root = mountConversation({
      fetch: (request, init) => {
        const url = String(request);
        if ((init?.method ?? 'GET') === 'POST' && url.endsWith('/stack-merge')) {
          return { outcome: 'in-progress' };
        }
        return openMergeStatus();
      },
    });

    await openStackConfirmation(root);
    click(root.querySelector('.merge-box__merge-btn'));
    await settle();

    expect(root.textContent).toContain('Stack merge failed');
  });

  test('shows that a failed Stack Merge read failed', async () => {
    const restoreWait = collapseStackMergeWait();
    try {
      const root = mountConversation({
        fetch: (request, init) => {
          const url = String(request);
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url.endsWith('/stack-merge')) {
            return { outcome: 'in-progress', id: stackMergeId };
          }
          if (url.includes('/stack-merge/')) {
            throw new Error('GitHub did not answer');
          }
          return openMergeStatus();
        },
      });

      await openStackConfirmation(root);
      click(root.querySelector('.merge-box__merge-btn'));
      for (
        let turn = 0;
        turn < 10 && !root.textContent?.includes('Stack merge failed');
        turn += 1
      ) {
        await flushMacrotask();
        await settle();
      }

      expect(root.textContent).toContain('Stack merge failed');
    } finally {
      restoreWait();
    }
  });

  test('stops waiting on a Stack Merge when the conversation goes away', async () => {
    let reads = 0;
    let releaseRead: (value: unknown) => void = () => {};
    const restoreWait = collapseStackMergeWait();
    try {
      const root = mountConversation({
        fetch: (request, init) => {
          const url = String(request);
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url.endsWith('/stack-merge')) {
            return { outcome: 'in-progress', id: stackMergeId };
          }
          if (url.includes('/stack-merge/')) {
            reads += 1;
            return new Promise((resolve) => {
              releaseRead = resolve;
            });
          }
          return openMergeStatus();
        },
      });

      await openStackConfirmation(root);
      click(root.querySelector('.merge-box__merge-btn'));
      for (let turn = 0; turn < 10 && reads < 1; turn += 1) {
        await flushMacrotask();
        await settle();
      }
      expect(reads).toBe(1);

      root.unmount();
      releaseRead({ outcome: 'in-progress', id: stackMergeId });
      await settle();
      await flushMacrotask();
      await settle();

      expect(reads).toBe(1);
    } finally {
      restoreWait();
    }
  });
});

describe('stack detail', () => {
  test('names the Trunk and lists every Layer, and another Layer switches the pull request', async () => {
    const root = mountConversation();
    const chip = root.querySelector<HTMLElement>('.pr-stack-chip');

    expect(chip).not.toBeNull();
    expect(chip?.closest('.header-meta')).not.toBeNull();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    chip?.click();
    await nextTick();

    const dialog = root.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('main');
    expect([...dialog!.querySelectorAll('.pr-stack-detail__layer')].map(layerText)).toEqual([
      '#101 Add the model Merged',
      '#102 Add the API Open Current',
      '#103 Add the screen Draft',
      '#104 Add the notes Closed',
    ]);

    const current = dialog?.querySelector<HTMLElement>('[aria-current="true"]');
    expect(current?.matches('button')).toBe(false);
    current?.click();
    expect(switchedPullRequest).toBeNull();

    const actionable = [...(dialog?.querySelectorAll('button') ?? [])]
      .map(layerText)
      .filter(Boolean);
    expect(actionable).toEqual([
      '#101 Add the model Merged',
      '#103 Add the screen Draft',
      '#104 Add the notes Closed',
    ]);
    expect(dialog?.textContent).not.toContain('Stack Merge');
    expect(dialog?.textContent).not.toContain('Stack Rebase');

    [...(dialog?.querySelectorAll('button') ?? [])]
      .find((button) => layerText(button).includes('Add the model'))
      ?.click();
    expect(switchedPullRequest).toEqual({ owner: 'octo', repo: 'app', pullNumber: 101 });
  });

  test('a pull request that is not a Layer has no Stack Chip', () => {
    const root = mountConversation({
      pullRequest: { ...layerPullRequest(), stack: null },
    });

    expect(root.querySelector('.pr-stack-chip')).toBeNull();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });
});
