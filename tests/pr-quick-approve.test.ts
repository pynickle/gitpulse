import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef, type Component } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import * as copilot from '../shared/utils/copilot-review';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });
const icons = new Proxy({}, { get: () => icon });

interface RecordedApiCall {
  url: string;
  method?: string;
  body?: unknown;
}

const apiCalls: RecordedApiCall[] = [];
let apiImpl: (
  url: string,
  options?: { method?: string; body?: unknown }
) => Promise<unknown> = async () => ({});

const modalStubs = { useModalLifecycle };

const IssueOptionModal = await compileVue(
  'app/components/dashboard/issue/IssueOptionModal.vue',
  {
    '@lucide/vue': icons,
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/stubs': modalStubs,
  },
  { useModalLifecycle: 'test/stubs' }
);

const PRActions = await compileVue(
  'app/components/dashboard/pr/PRActions.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }) },
    '#shared/utils/copilot-review': copilot,
    '#shared/types/notifications': {},
    '~/components/dashboard/issue/IssueOptionModal.vue': { default: IssueOptionModal },
    '~/components/dashboard/pr/CopilotReviewEffortPicker.vue': {
      default: defineComponent({ setup: () => () => h('div') }),
    },
    '~/components/ui/GitHubAvatar.vue': {
      default: defineComponent({ setup: () => () => h('span') }),
    },
    '~/components/ui/GitHubIcon.vue': { default: icon },
    '~/composables/usePRReviewers': {},
    virtual: {
      useCompactCount: () => ({
        compact: (value: number) => String(value),
        exact: (value: number) => String(value),
      }),
      useRelativeTimeNow: () => shallowRef(0),
      useGitPulseApiFetch:
        () => async (url: string, options?: { method?: string; body?: unknown }) => {
          apiCalls.push({ url, method: options?.method, body: options?.body });
          return apiImpl(url, options);
        },
      useNotificationTodos: () => ({
        isNotificationTodo: () => false,
        toggleNotificationTodo: () => undefined,
      }),
      getFetchErrorMessage,
      formatDurationFromNow: () => '',
    },
  },
  {
    useCompactCount: 'virtual',
    useRelativeTimeNow: 'virtual',
    useGitPulseApiFetch: 'virtual',
    useNotificationTodos: 'virtual',
    getFetchErrorMessage: 'virtual',
    formatDurationFromNow: 'virtual',
  }
);

const baseProps = {
  requestedReviewers: [],
  requestedTeams: [],
  canRequestReviewers: false,
  canRequestCopilot: false,
  canOpenReview: true,
  htmlUrl: 'https://github.com/acme/widgets/pull/1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  commits: 1,
  changedFiles: 1,
  additions: 1,
  deletions: 0,
  prState: 'open',
  merged: false,
  mergedAt: undefined,
  canManageState: false,
  repoInfo: { owner: 'acme', repo: 'widgets' },
  prNumber: 1,
  draft: false,
  headSha: 'abc1234',
  authorLogin: 'alice',
  viewerLogin: 'bob',
};

let dom: ReturnType<typeof createVueDom> | undefined;

afterEach(async () => {
  apiCalls.length = 0;
  apiImpl = async () => ({});
  await dom?.cleanup();
  dom = undefined;
});

const settle = async () => {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
};

const mountActions = (initialOverrides?: Record<string, unknown>) => {
  dom = createVueDom();
  const state = ref<Record<string, unknown>>({ ...baseProps, ...initialOverrides });
  const reviewSubmittedCount = ref(0);

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(PRActions as Component, {
          ...state.value,
          onReviewSubmitted: () => {
            reviewSubmittedCount.value += 1;
          },
        }),
    })
  );

  return { root: mounted.root, state, reviewSubmittedCount };
};

const findButtonByText = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  ) ?? null;

const dialog = () => dom?.document.querySelector<HTMLElement>('[role="dialog"]') ?? null;
const dialogHeading = () =>
  dialog()
    ? dom?.document.getElementById(dialog()!.getAttribute('aria-labelledby')!)?.textContent?.trim()
    : undefined;
const dialogCancelButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-cancel') ?? null;
const dialogConfirmButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-save') ?? null;

describe('PRActions quick approval', () => {
  test('hides quick approve for self-authored, closed, merged, or unauthenticated views', async () => {
    const { root, state } = mountActions({ viewerLogin: 'OctoCat', authorLogin: 'octocat' });
    await settle();
    expect(findButtonByText(root, 'prReview.quickApprove')).toBeNull();

    state.value = { ...baseProps, viewerLogin: 'bob', authorLogin: 'alice', prState: 'closed' };
    await settle();
    expect(findButtonByText(root, 'prReview.quickApprove')).toBeNull();

    state.value = { ...baseProps, viewerLogin: 'bob', authorLogin: 'alice', merged: true };
    await settle();
    expect(findButtonByText(root, 'prReview.quickApprove')).toBeNull();

    state.value = { ...baseProps, viewerLogin: '' };
    await settle();
    expect(findButtonByText(root, 'prReview.quickApprove')).toBeNull();
  });

  test('renders disabled states for draft PRs, already approved viewers, and missing headSha', async () => {
    const { root, state } = mountActions({ draft: true });
    await settle();
    const draftButton = findButtonByText(root, 'prReview.quickApprove');
    expect(draftButton).not.toBeNull();
    expect(draftButton?.hasAttribute('disabled')).toBe(true);
    expect(draftButton?.getAttribute('title')).toBe('prReview.quickApproveDraftDisabled');

    state.value = {
      ...baseProps,
      viewerLogin: 'OctoCat',
      authorLogin: 'alice',
      reviewers: {
        items: [
          {
            key: 'user:octocat',
            kind: 'user',
            login: 'octocat',
            name: 'octocat',
            status: 'approved',
            reviewCount: 1,
            commentCount: 0,
            requested: false,
            removable: false,
          },
        ],
      },
    };
    await settle();
    const approvedButton = findButtonByText(root, 'prReview.quickApproveApproved');
    expect(approvedButton).not.toBeNull();
    expect(approvedButton?.hasAttribute('disabled')).toBe(true);

    state.value = { ...baseProps, headSha: '' };
    await settle();
    const missingShaButton = findButtonByText(root, 'prReview.quickApprove');
    expect(missingShaButton).not.toBeNull();
    expect(missingShaButton?.hasAttribute('disabled')).toBe(true);
  });

  test('opens IssueOptionModal for confirmation and closes on Cancel, Escape, or headSha change without calling API', async () => {
    const { root, state } = mountActions({
      reviewers: {
        items: [
          {
            key: 'user:bob',
            kind: 'user',
            login: 'bob',
            name: 'bob',
            status: 'changes_requested',
            reviewCount: 1,
            commentCount: 0,
            requested: false,
            removable: false,
          },
        ],
      },
    });
    await settle();

    const trigger = findButtonByText(root, 'prReview.quickApprove');
    expect(trigger).not.toBeNull();
    expect(trigger?.hasAttribute('disabled')).toBe(false);

    // First click opens confirmation modal without sending request
    trigger!.click();
    await settle();
    expect(apiCalls).toHaveLength(0);
    expect(dialog()).not.toBeNull();
    expect(dialogHeading()).toBe('prReview.quickApproveConfirm');
    expect(dialog()!.querySelectorAll('input[type="radio"]')).toHaveLength(0);

    // Cancel closes dialog
    dialogCancelButton()!.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(apiCalls).toHaveLength(0);

    // Escape closes dialog
    findButtonByText(root, 'prReview.quickApprove')!.click();
    await settle();
    expect(dialog()).not.toBeNull();
    dialog()!.dispatchEvent(
      new dom!.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event
    );
    await settle();
    expect(dialog()).toBeNull();
    expect(apiCalls).toHaveLength(0);

    // Changing headSha or draft closes dialog cleanly
    findButtonByText(root, 'prReview.quickApprove')!.click();
    await settle();
    expect(dialog()).not.toBeNull();
    state.value = { ...state.value, headSha: 'def5678' };
    await settle();
    expect(dialog()).toBeNull();
    expect(apiCalls).toHaveLength(0);
  });

  test('prevents duplicate submits while pending, surfaces errors inside modal, and closes on approve', async () => {
    let resolvePending: ((value: unknown) => void) | undefined;
    let mode: 'fail' | 'pending' = 'fail';

    apiImpl = () => {
      if (mode === 'fail') {
        return Promise.reject({ data: { statusMessage: 'Review failed on GitHub' } });
      }
      return new Promise((resolve) => {
        resolvePending = resolve;
      });
    };

    const { root, reviewSubmittedCount } = mountActions();
    await settle();

    findButtonByText(root, 'prReview.quickApprove')!.click();
    await settle();

    dialogConfirmButton()!.click();
    await settle();

    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain('Review failed on GitHub');
    expect(root.querySelector('.sidebar-alert--error')).toBeNull();

    mode = 'pending';
    dialogConfirmButton()!.click();
    await nextTick();

    expect(dialogConfirmButton()!.disabled).toBe(true);
    expect(dialogCancelButton()!.disabled).toBe(true);
    expect(dialogConfirmButton()!.textContent).toContain('prReview.quickApproving');

    dialogConfirmButton()!.click();
    expect(apiCalls).toHaveLength(2);

    resolvePending?.({});
    await settle();

    expect(apiCalls).toEqual([
      {
        url: '/api/repos/acme/widgets/pulls/1/reviews',
        method: 'POST',
        body: { commitId: 'abc1234', event: 'APPROVE' },
      },
      {
        url: '/api/repos/acme/widgets/pulls/1/reviews',
        method: 'POST',
        body: { commitId: 'abc1234', event: 'APPROVE' },
      },
    ]);
    expect(reviewSubmittedCount.value).toBe(1);
    expect(dialog()).toBeNull();
  });

  test('closes modal when headSha changes while an in-flight approval rejects', async () => {
    let rejectPending: ((reason?: unknown) => void) | undefined;
    apiImpl = () =>
      new Promise((_resolve, reject) => {
        rejectPending = reject;
      });

    const { root, state } = mountActions({ headSha: 'abc1234' });
    await settle();

    findButtonByText(root, 'prReview.quickApprove')!.click();
    await settle();
    dialogConfirmButton()!.click();
    await nextTick();

    state.value = { ...state.value, headSha: 'def5678' };
    await settle();

    rejectPending?.({ data: { statusMessage: 'Stale SHA' } });
    await settle();

    expect(apiCalls).toEqual([
      {
        url: '/api/repos/acme/widgets/pulls/1/reviews',
        method: 'POST',
        body: { commitId: 'abc1234', event: 'APPROVE' },
      },
    ]);
    expect(dialog()).toBeNull();
  });
});
