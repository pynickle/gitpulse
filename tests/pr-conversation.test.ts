import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, ref, shallowRef, type Component } from 'vue';

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

const i18n = { useI18n: () => ({ t, locale: ref('en') }) };
const relativeTime = { useRelativeTimeNow: () => shallowRef(0) };
const duration = { formatDurationFromNow };

const StackChip = await compileVue('app/components/dashboard/pr/PRStackChip.vue', {
  'vue-i18n': i18n,
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

function mountConversation() {
  store = createMergeStatusStore();
  dom = createVueDom({ useI18n: () => ({ t, locale: ref('en') }) });

  const Harness = defineComponent({
    setup: () => () =>
      h('div', [
        h(Header as Component, {
          pullRequest: openLayer,
          repoOwner: 'octo',
          repoName: 'app',
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
