import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef, type Component } from 'vue';

import { formatDurationFromNow } from '../app/utils/formatDurationFromNow';
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

function createMergeStatusStore() {
  const mergeStatus = shallowRef<Record<string, unknown> | null>(null);
  const branchUpdateError = ref<string | null>(null);

  return {
    mergeStatus,
    loading: ref(false),
    error: ref<string | null>(null),
    mergeError: ref<string | null>(null),
    branchActionError: ref<string | null>(null),
    branchUpdateError,
    commitDefaults: shallowRef(null),
    setMergeStatus: (value: Record<string, unknown> | null) => {
      mergeStatus.value = value;
      branchUpdateError.value = null;
    },
    fetchMergeStatus: async () => null,
    fetchCommitDefaults: async () => null,
    clearCommitDefaults: () => {},
    mergePullRequest: async (
      _owner: string,
      _repo: string,
      _pullNumber: number,
      _payload: RecordedMerge
    ) => true,
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
let switchedPullRequest: { owner: string; repo: string; pullNumber: number } | null = null;

const i18n = { useI18n: () => ({ t, locale: ref('en') }) };
const relativeTime = { useRelativeTimeNow: () => shallowRef(0) };
const duration = { formatDurationFromNow };

const PickerModal = await compileVue('app/components/dashboard/PickerModal.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
  '~/components/ui/ScrollArea.vue': { default: slotStub },
});

const StackDetail = await compileVue('app/components/dashboard/pr/PRStackDetail.vue', {
  'vue-i18n': i18n,
  '~/components/dashboard/PickerModal.vue': { default: PickerModal },
});

const StackChip = await compileVue('app/components/dashboard/pr/PRStackChip.vue', {
  'vue-i18n': i18n,
  '~/components/dashboard/pr/PRStackDetail.vue': { default: StackDetail },
});

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
    '~/components/ui/GitHubAvatar.vue': { default: slotStub },
    '~/components/ui/ScrollArea.vue': { default: slotStub },
    '~/utils/getCheckStatusToneIcon': { getCheckStatusToneIcon: () => icon },
    '~/composables/usePRMergeStatus': {
      usePRMergeStatus: () => store,
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

const openLayer = {
  title: 'Add the API',
  number: 102,
  state: 'open',
  updated_at: '2026-04-15T10:00:00Z',
  created_at: '2026-04-15T10:00:00Z',
  user: { login: 'octocat', avatar_url: '', html_url: 'https://github.com/octocat' },
  stack: {
    trunk: 'main',
    count: 4,
    place: 2,
    history: 'unknown' as const,
    layers: [
      { number: 101, title: 'Add the model', state: 'open' as const },
      { number: 102, title: 'Add the API', state: 'open' as const },
      { number: 103, title: 'Add the screen', state: 'draft' as const },
      { number: 104, title: 'Add the notes', state: 'closed' as const },
    ],
  },
};

type ConversationPullRequest = Omit<typeof openLayer, 'stack'> & {
  stack?: typeof openLayer.stack | null;
};

function mountConversation(pullRequest: ConversationPullRequest = openLayer) {
  switchedPullRequest = null;
  store = createMergeStatusStore();
  dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

  const Harness = defineComponent({
    setup: () => () =>
      h('div', [
        h(Header as Component, {
          pullRequest,
          repoOwner: 'octo',
          repoName: 'app',
          onSwitchPullRequest: (owner: string, repo: string, pullNumber: number) => {
            switchedPullRequest = { owner, repo, pullNumber };
          },
        }),
        h(MergeBox as Component, {
          owner: 'octo',
          repo: 'app',
          pullNumber: openLayer.number,
          initialStatus: {
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
          },
        }),
      ]),
  });

  return dom.mount(Harness).root;
}

afterEach(async () => {
  await dom.cleanup();
});

describe('pull request conversation', () => {
  test("shows this Layer's place on the Stack Chip", () => {
    const root = mountConversation();

    expect(root.textContent).toContain('Layer 2 of 4');
  });
});

Object.assign(messages, {
  'prReview.stackDetail.title': 'Stack',
  'prReview.stackDetail.close': 'Close',
  'prReview.stackDetail.current': 'Current',
  'prReview.stackDetail.state.open': 'Open',
  'prReview.stackDetail.state.draft': 'Draft',
  'prReview.stackDetail.state.closed': 'Closed',
  'prReview.stackDetail.state.merged': 'Merged',
});

const detailLayer: ConversationPullRequest = {
  ...openLayer,
  stack: {
    trunk: 'main',
    count: 4,
    place: 2,
    history: 'unknown',
    layers: [
      { number: 101, title: 'Add the model', state: 'merged' },
      { number: 102, title: 'Add the API', state: 'open' },
      { number: 103, title: 'Add the screen', state: 'draft' },
      { number: 104, title: 'Add the notes', state: 'closed' },
    ],
  },
};

const layerText = (element: Element) => element.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';

describe('stack detail', () => {
  test('names the Trunk and lists every Layer, and another Layer switches the pull request', async () => {
    const root = mountConversation(detailLayer);
    const chip = root.querySelector<HTMLElement>('.pr-stack-chip');

    expect(chip).not.toBeNull();
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
    const root = mountConversation({ ...openLayer, stack: null });

    expect(root.querySelector('.pr-stack-chip')).toBeNull();
    expect(root.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });
});
