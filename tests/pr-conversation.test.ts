import { afterEach, describe, expect, test } from 'bun:test';

import {
  computed,
  defineComponent,
  h,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  type Component,
} from 'vue';

const { usePRMergeStatus: readMergeStatus } = await import('../app/composables/usePRMergeStatus');

import { useCompactCount } from '../app/composables/useCompactCount';
import { formatDurationFromNow } from '../app/utils/formatDurationFromNow';
import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import { getPullRequestStateVisual } from '../app/utils/getPullRequestStateVisual';
import { parseGridTemplateColumnWidths } from '../app/utils/parseGridTemplateColumnWidths';
import { resolvePullRequestBranchRef } from '../app/utils/resolvePullRequestBranchRef';
import enMessages from '../i18n/locales/en.json';
import * as prChecks from '../shared/utils/pr-checks';
import * as prReviewWorkspacePresentation from '../shared/utils/pr-review-workspace-presentation';
import * as prStack from '../shared/utils/pr-stack';
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

function lookupMessage(catalog: Record<string, unknown>, key: string): string {
  let current: unknown = catalog;
  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return key;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : key;
}

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(lookupMessage(enMessages, key), params);

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

const StackLayerList = await compileVue('app/components/dashboard/pr/PRStackLayerList.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  'vue-i18n': i18n,
  '#shared/utils/pr-stack': prStack,
});

const StackDetail = await compileVue('app/components/dashboard/pr/PRStackDetail.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  'vue-i18n': i18n,
  '#shared/utils/pr-stack': prStack,
  '~/components/dashboard/PickerModal.vue': { default: PickerModal },
  '~/components/dashboard/pr/PRStackLayerList.vue': { default: StackLayerList },
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
    '#shared/utils/pr-stack': prStack,
    '~/components/dashboard/pr/CheckListRows.vue': { default: slotStub },
    '~/components/dashboard/pr/PRStackLayerList.vue': { default: StackLayerList },
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
  { number: 102, title: 'Add the API', state: 'open' as const, headSha: 'head-102', behindBy: 0 },
  {
    number: 103,
    title: 'Add the screen',
    state: 'draft' as const,
    headSha: 'head-103',
    behindBy: 2,
  },
  { number: 104, title: 'Add the notes', state: 'closed' as const, headSha: 'head-104' },
].map((layer) => ({ ...layer, baseRef: 'main', baseSha: 'old-base' }));

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

/** Collapse Stack Merge polling waits (2–4s) so a slow landing stays in this test. */
function collapseStackMergeWait() {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
    original(
      handler,
      typeof timeout === 'number' && timeout >= 2_000 ? 0 : timeout,
      ...args
    )) as typeof setTimeout;
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
    const pullRequest = layerPullRequest();
    const openFirstLayers = pullRequest.stack.layers.map((layer, index) =>
      index === 0 ? { ...layer, state: 'open' as const } : layer
    );
    const root = mountConversation({
      pullRequest: {
        ...pullRequest,
        stack: { ...pullRequest.stack, layers: openFirstLayers },
      },
      behindBy: 2,
    });

    expect(root.textContent).toContain('Layer 2 of 4');
    const chip = root.querySelector<HTMLElement>('.pr-stack-chip');
    expect(chip).not.toBeNull();
    chip?.click();
    await nextTick();

    const dialog = root.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('main');
    expect(dialog?.querySelector('.pr-stack-detail__history')?.textContent?.trim()).toBe('Linear');
    expect([...dialog!.querySelectorAll('.pr-stack-detail__layer')].map(layerText)).toEqual([
      'Add the model Layer 1 #101 Open',
      'Add the API Layer 2 #102 Open Current',
      'Add the screen Layer 3 #103 Draft Behind 2',
      'Add the notes Layer 4 #104 Closed',
    ]);
    dialog?.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
    await nextTick();

    expect(root.textContent).toContain('No reviews required');
    expect(root.textContent).toContain('Some checks were not successful');
    expect(root.textContent).toContain('Ready to merge');
    // Multi-active stack hides the separate Branch Currency row; the Stack row owns sync state.
    expect(root.querySelector('.merge-box__currency')).toBeNull();
    expect(root.querySelector('.merge-box__update')).toBeNull();

    await openStackConfirmation(root);

    expect(layerTexts(root)).toEqual(['Add the model #101 Open', 'Add the API #102 Open']);
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

  test('sends the commit title and message when lower Layers are already merged so only this Layer lands', async () => {
    const root = mountConversation({ pullRequest: layerPullRequest('linear', 2) });

    await openStackConfirmation(root);

    expect(layerTexts(root)).toEqual(['Add the API #102 Open']);
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
        pullNumber: 102,
        method: 'squash',
        commitTitle: 'Land the model',
        commitMessage: 'Keep the schema change.',
      },
    ]);
  });

  test('blocks merging when a lower Layer in the Stack is draft or closed', () => {
    const pullRequest = layerPullRequest('linear', 2);
    const draftFirstLayers = pullRequest.stack.layers.map((layer, index) =>
      index === 0 ? { ...layer, state: 'draft' as const } : layer
    );
    const root = mountConversation({
      pullRequest: {
        ...pullRequest,
        stack: { ...pullRequest.stack, layers: draftFirstLayers },
      },
    });

    const mergeBtn = root.querySelector<HTMLButtonElement>('.merge-box__merge-btn');
    expect(mergeBtn?.hasAttribute('disabled')).toBe(true);
    const reasonEl = root.querySelector('.merge-box__blocked-reason');
    expect(reasonEl?.classList.contains('is-sr-only')).toBe(false);
    expect(reasonEl?.textContent?.trim()).toBe(
      'Lower Layers in this Stack must be open and ready before merging.'
    );
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

  test('confirms before rebasing the stack atomically and persists a failure in the Merge Box', async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    let finishRebase: (result: unknown) => void = () => {};
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
        return new Promise((resolve) => {
          finishRebase = resolve;
        });
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
          stackNumber: 106,
          expectedHeads: {
            '102': 'head-102',
            '103': 'head-103',
            '105': 'head-105',
          },
        },
      },
    ]);
    const row = (number: number) =>
      [...dialog!.querySelectorAll('li')].find((item) => item.textContent?.includes(`#${number}`));
    expect(row(102)?.textContent).toContain('Rebasing…');
    expect(row(102)?.getAttribute('data-state')).toBe('rebasing');
    expect(row(103)?.getAttribute('data-state')).toBe('rebasing');
    expect(row(105)?.getAttribute('data-state')).toBe('rebasing');
    finishRebase({
      ok: false,
      results: [
        { number: 101, outcome: 'merged' },
        { number: 102, outcome: 'rebased' },
        { number: 103, outcome: 'failed', message: 'Rebase conflict' },
        { number: 104, outcome: 'closed' },
        { number: 105, outcome: 'skipped' },
      ],
      error: 'Rebase conflict',
    });
    await settle();
    expect(row(102)?.textContent).toContain('Rebased');
    expect(row(103)?.textContent).toContain('Rebase failed');
    expect(row(105)?.textContent).toContain('Not rebased');
    expect(row(105)?.getAttribute('data-state')).toBe('skipped');
    expect(dialog?.textContent).toContain('Rebase conflict');
    expect(root.querySelector('.merge-box__update')).toBeNull();

    // Closing the dialog leaves the error visible in the Merge Box
    dialog?.dispatchEvent(new dom.window.Event('close'));
    await settle();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Rebase conflict');
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

  test('explains inline on the Stack row when the server has no Git instead of rendering a disabled Rebase stack button', () => {
    const root = mountConversation({
      pullRequest: layerPullRequest('not-linear'),
      behindBy: 2,
      git: { available: false, reason: 'git_missing' },
    });

    expect(stackRebaseControl(root)).toBeNull();
    expect(root.textContent).toContain(
      'This server has no Git, so it cannot rebase a Stack. Rebase the Stack locally.'
    );
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

  test('shows that a Stack Merge with repeated poll read errors is stalled and can check status again', async () => {
    const restoreWait = collapseStackMergeWait();
    let shouldFailPoll = true;
    try {
      const root = mountConversation({
        fetch: (request, init) => {
          const url = String(request);
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url.endsWith('/stack-merge')) {
            return { outcome: 'in-progress', id: stackMergeId };
          }
          if (url.includes('/stack-merge/')) {
            if (shouldFailPoll) {
              throw new Error('GitHub did not answer');
            }
            return { outcome: 'landed', id: stackMergeId };
          }
          return openMergeStatus();
        },
      });

      await openStackConfirmation(root);
      click(root.querySelector('.merge-box__merge-btn'));
      for (
        let turn = 0;
        turn < 10 && !root.textContent?.includes('Stack merge is still running on GitHub.');
        turn += 1
      ) {
        await flushMacrotask();
        await settle();
      }

      expect(root.textContent).toContain('Stack merge is still running on GitHub.');
      const checkBtn = root.querySelector<HTMLButtonElement>('.merge-box__check-status-btn');
      expect(checkBtn?.textContent?.trim()).toBe('Check status');

      shouldFailPoll = false;
      click(checkBtn);
      for (
        let turn = 0;
        turn < 10 && !root.textContent?.includes('Stack merge landed');
        turn += 1
      ) {
        await flushMacrotask();
        await settle();
      }

      expect(root.textContent).toContain('Stack merge landed');
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
    expect(dialog?.querySelector('.pr-stack-detail__history')?.textContent?.trim()).toBe('Linear');
    expect(
      [...dialog!.querySelectorAll('.pr-stack-detail__node')].map((el) =>
        el.getAttribute('data-state')
      )
    ).toEqual(['merged', 'open', 'draft', 'closed']);
    expect([...dialog!.querySelectorAll('.pr-stack-detail__layer')].map(layerText)).toEqual([
      'Add the model Layer 1 #101 Merged',
      'Add the API Layer 2 #102 Open Current',
      'Add the screen Layer 3 #103 Draft Behind 2',
      'Add the notes Layer 4 #104 Closed',
    ]);

    const current = dialog?.querySelector<HTMLElement>('[aria-current="true"]');
    expect(current?.matches('button')).toBe(false);
    current?.click();
    expect(switchedPullRequest).toBeNull();

    const actionable = [...(dialog?.querySelectorAll('button') ?? [])]
      .map(layerText)
      .filter(Boolean);
    expect(actionable).toEqual([
      'Add the model Layer 1 #101 Merged',
      'Add the screen Layer 3 #103 Draft Behind 2',
      'Add the notes Layer 4 #104 Closed',
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

  test('shows the unavailable label when stack layers are empty', async () => {
    const pullRequest = layerPullRequest();
    const root = mountConversation({
      pullRequest: {
        ...pullRequest,
        stack: { ...pullRequest.stack, layers: [] },
      },
    });

    root.querySelector<HTMLElement>('.pr-stack-chip')?.click();
    await nextTick();

    const dialog = root.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Stack layers could not be loaded.');
    expect(dialog?.querySelectorAll('.pr-stack-detail__layer').length).toBe(0);
  });

  test('matches the current layer by currentPullNumber and falls back to stack.place when absent or unmatched', async () => {
    dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });
    const currentPullNumber = shallowRef<number | undefined>(103);
    const stack = { ...layerPullRequest('linear', 1).stack };

    dom.mount(
      defineComponent({
        setup: () => () =>
          h(StackDetail as Component, {
            stack,
            currentPullNumber: currentPullNumber.value,
          }),
      })
    );
    await nextTick();

    const currentLayerText = () =>
      layerText(dom.document.querySelector('[role="dialog"] [aria-current="true"]')!);

    expect(currentLayerText()).toContain('Add the screen Layer 3 #103 Draft Current Behind 2');

    currentPullNumber.value = 999;
    await nextTick();
    expect(currentLayerText()).toContain('Add the model Layer 1 #101 Merged Current');

    currentPullNumber.value = undefined;
    await nextTick();
    expect(currentLayerText()).toContain('Add the model Layer 1 #101 Merged Current');
  });

  test('closes the open Stack Detail dialog when stack becomes null', async () => {
    const pullRequest = layerPullRequest();
    const root = mountConversation({ pullRequest });

    root.querySelector<HTMLElement>('.pr-stack-chip')?.click();
    await nextTick();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).not.toBeNull();

    root.setStack(null);
    await nextTick();
    expect(root.querySelector('.pr-stack-chip')).toBeNull();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    root.setStack(pullRequest.stack);
    await nextTick();
    expect(root.querySelector('.pr-stack-chip')).not.toBeNull();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('review workspace Stack Chip', () => {
  const createWorkspaceReviewState = () => {
    const pendingCount = ref(0);
    const activeDraftTarget = ref<Record<string, unknown> | null>(null);
    return {
      pendingCount,
      activeDraftTarget,
      review: {
        files: ref([]),
        reviewComments: ref([]),
        activeFilename: shallowRef(''),
        pagination: ref({ hasNext: false }),
        loading: shallowRef(false),
        loadingMore: shallowRef(false),
        submitting: shallowRef(false),
        resolvingReviewThreadId: shallowRef(null),
        errorMessage: shallowRef(''),
        submitError: shallowRef(''),
        draftBody: shallowRef(''),
        selectedEvent: shallowRef('COMMENT'),
        draftComments: ref([]),
        activeDraftTarget,
        allDiffSections: computed(() => []),
        reviewCommentThreads: computed(() => []),
        pendingCommentCount: computed(() => pendingCount.value),
        canSubmit: computed(() => false),
        loadMoreFiles: () => {},
        retryLoad: () => {},
        selectFile: () => {},
        syncVisibleFile: () => {},
        openDraftEditor: () => {},
        closeDraftEditor: () => {},
        saveDraftComment: () => {},
        removeDraftComment: () => {},
        toggleReviewThreadResolved: () => {},
        submitReview: () => {},
      },
    };
  };

  async function mountReviewWorkspace(options?: {
    pendingCount?: number;
    hasActiveDraft?: boolean;
    draftBody?: string;
  }) {
    const reviewState = createWorkspaceReviewState();
    reviewState.pendingCount.value = options?.pendingCount ?? 0;
    reviewState.activeDraftTarget.value = options?.hasActiveDraft
      ? { path: 'a.ts', line: 1 }
      : null;
    reviewState.review.draftBody.value = options?.draftBody ?? '';

    const presentation = {
      presentation: ref({
        mode: 'wide',
        diffArrangement: 'split',
        showFileColumn: true,
        showSubmitColumn: true,
        wrapCode: true,
      }),
      keyboardInsetPx: ref(0),
      keyboardVisibleHeightPx: ref(null),
    };
    const navigation = {
      canGoBack: ref(false),
      goBackToPreviousPage: async () => {},
      goToDashboardHome: async () => {},
      previousEntry: ref(null),
    };

    const Workspace = await compileVue(
      'app/components/dashboard/pr/PRReviewWorkspace.vue',
      {
        '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
        '#shared/utils/pr-review-workspace-presentation': prReviewWorkspacePresentation,
        '~/components/dashboard/pr/PRReviewBottomBar.vue': { default: slotStub },
        '~/components/dashboard/pr/PRReviewDiffViewer.vue': { default: slotStub },
        '~/components/dashboard/pr/PRReviewFileSidebar.vue': { default: slotStub },
        '~/components/dashboard/pr/PRReviewSubmitBar.vue': { default: slotStub },
        '~/components/dashboard/pr/PRStackChip.vue': { default: StackChip },
        '~/utils/prReviewNavigation': { shouldCloseReviewWorkspaceAfterSubmit: () => false },
        '~/utils/parseGridTemplateColumnWidths': { parseGridTemplateColumnWidths },
        '~/composables/usePRReview': { usePRReview: () => reviewState.review },
        '~/composables/usePRReviewWorkspacePresentation': {
          usePRReviewWorkspacePresentation: () => presentation,
        },
        '~/composables/useNavigationRouting': { useNavigationRouting: () => navigation },
        'vue-i18n': i18n,
      },
      {
        useI18n: 'vue-i18n',
        useNavigationRouting: '~/composables/useNavigationRouting',
        usePRReview: '~/composables/usePRReview',
        usePRReviewWorkspacePresentation: '~/composables/usePRReviewWorkspacePresentation',
        parseGridTemplateColumnWidths: '~/utils/parseGridTemplateColumnWidths',
      }
    );

    const emitted: Array<{
      owner: string;
      repo: string;
      pullNumber: number;
      openReview?: boolean;
    }> = [];
    dom = createVueDom({ useI18n: i18n.useI18n, useCompactCount });
    const mounted = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Workspace, {
            owner: 'octo',
            repo: 'app',
            pullNumber: 102,
            commitId: 'abc123',
            title: 'Add the API',
            stack: layerPullRequest('linear', 2).stack,
            onSwitchPullRequest: (
              owner: string,
              repo: string,
              pullNumber: number,
              openReview?: boolean
            ) => {
              emitted.push({ owner, repo, pullNumber, openReview });
            },
          }),
      })
    );
    await nextTick();

    const selectLayerFromChip = async (titleFragment: string) => {
      mounted.root.querySelector<HTMLElement>('.pr-stack-chip')?.click();
      await nextTick();
      const pickerDialog = dom.document.querySelector('[role="dialog"]');
      [...(pickerDialog?.querySelectorAll('button') ?? [])]
        .find((button) => layerText(button).includes(titleFragment))
        ?.click();
      await settle();
    };

    return { root: mounted.root, emitted, selectLayerFromChip };
  }

  test('switches immediately with openReview=true when there are no pending comments or active draft', async () => {
    const { root, emitted, selectLayerFromChip } = await mountReviewWorkspace();

    await selectLayerFromChip('Add the model');

    expect(root.querySelector('dialog.pr-review-discard-dialog')).toBeNull();
    expect(emitted).toEqual([{ owner: 'octo', repo: 'app', pullNumber: 101, openReview: true }]);
  });

  test('prompts before switching when pending comments exist, respects Cancel, and emits openReview=true on Discard', async () => {
    const { root, emitted, selectLayerFromChip } = await mountReviewWorkspace({ pendingCount: 2 });

    await selectLayerFromChip('Add the model');

    const dialog = root.querySelector<HTMLDialogElement>('dialog.pr-review-discard-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Discard pending review comments?');
    expect(dialog?.textContent).toContain(
      'Switching to #101 will discard 2 pending comment(s) on this pull request.'
    );
    expect(emitted).toEqual([]);

    const cancelButton = [...dialog!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    click(cancelButton);
    await settle();

    expect(root.querySelector('dialog.pr-review-discard-dialog')).toBeNull();
    expect(emitted).toEqual([]);

    await selectLayerFromChip('Add the model');
    const reopened = root.querySelector<HTMLDialogElement>('dialog.pr-review-discard-dialog');
    expect(reopened).not.toBeNull();

    const discardButton = [...reopened!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Discard and switch'
    );
    click(discardButton);
    await settle();

    expect(root.querySelector('dialog.pr-review-discard-dialog')).toBeNull();
    expect(emitted).toEqual([{ owner: 'octo', repo: 'app', pullNumber: 101, openReview: true }]);
  });

  test('prompts before switching when an active inline draft composer is open', async () => {
    const { root, emitted, selectLayerFromChip } = await mountReviewWorkspace({
      pendingCount: 0,
      hasActiveDraft: true,
    });

    await selectLayerFromChip('Add the screen');

    const dialog = root.querySelector<HTMLDialogElement>('dialog.pr-review-discard-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(
      'Switching to #103 will discard 1 pending comment(s) on this pull request.'
    );
    expect(emitted).toEqual([]);

    const discardButton = [...dialog!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Discard and switch'
    );
    click(discardButton);
    await settle();

    expect(emitted).toEqual([{ owner: 'octo', repo: 'app', pullNumber: 103, openReview: true }]);
  });

  test('prompts before switching when unsaved top-level review summary draftBody text exists', async () => {
    const { root, emitted, selectLayerFromChip } = await mountReviewWorkspace({
      pendingCount: 0,
      hasActiveDraft: false,
      draftBody: 'Overall LGTM with one note',
    });

    await selectLayerFromChip('Add the screen');

    const dialog = root.querySelector<HTMLDialogElement>('dialog.pr-review-discard-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('closedby')).toBe('any');
    expect(emitted).toEqual([]);

    const discardButton = [...dialog!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Discard and switch'
    );
    click(discardButton);
    await settle();

    expect(emitted).toEqual([{ owner: 'octo', repo: 'app', pullNumber: 103, openReview: true }]);
  });
});
