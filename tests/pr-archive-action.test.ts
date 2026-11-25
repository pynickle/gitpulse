import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef, type Component } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { usePullRequestArchive } from '../app/composables/usePullRequestArchive';
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

// The composable calls Nuxt's auto-imported fetch by bare name, so a standalone
// mount has to publish it the way Nuxt does.
Object.assign(globalThis, {
  useGitPulseApiFetch: () => async (url: string, options?: { method?: string; body?: unknown }) => {
    apiCalls.push({ url, method: options?.method, body: options?.body });
    return apiImpl(url, options);
  },
});

const ConfirmModal = await compileVue(
  'app/components/dashboard/ConfirmModal.vue',
  {
    '@lucide/vue': icons,
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/stubs': { useModalLifecycle },
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
    '~/components/dashboard/ConfirmModal.vue': { default: ConfirmModal },
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
      usePullRequestArchive,
      getFetchErrorMessage,
      formatDurationFromNow: () => '',
    },
  },
  {
    useCompactCount: 'virtual',
    useRelativeTimeNow: 'virtual',
    useGitPulseApiFetch: 'virtual',
    useNotificationTodos: 'virtual',
    usePullRequestArchive: 'virtual',
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
  htmlUrl: 'https://github.com/acme/widgets/pull/7',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  commits: 1,
  changedFiles: 1,
  additions: 1,
  deletions: 0,
  prState: 'closed',
  merged: false,
  mergedAt: undefined,
  canManageState: true,
  canManageItemState: true,
  repoInfo: { owner: 'acme', repo: 'widgets' },
  prNumber: 7,
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

const mountActions = (overrides?: Record<string, unknown>, archivedNumbers: number[] = []) => {
  dom = createVueDom();
  apiImpl = async (url: string) => {
    if (url.endsWith('/archived-pulls')) return archivedNumbers;
    return { archived: true, state: 'CLOSED' };
  };

  const mounted = dom.mount(
    defineComponent({
      setup: () => () => h(PRActions as Component, { ...baseProps, ...overrides }),
    })
  );

  return mounted.root;
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
const dialogConfirmButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-save') ?? null;
const dialogCancelButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-cancel') ?? null;

const archiveCalls = () => apiCalls.filter((call) => call.url.endsWith('/archive'));

test('offers Archive only to triage or higher', async () => {
  const allowed = mountActions();
  await settle();
  expect(findButtonByText(allowed, 'prReview.archivePullRequest')).not.toBeNull();
  expect(apiCalls.filter((call) => call.url.endsWith('/archived-pulls'))).toHaveLength(1);
  await dom?.cleanup();
  dom = undefined;

  // Without triage GitHub shows no archived pull request at all, so the read is
  // skipped rather than spending a search on a control the viewer cannot use.
  apiCalls.length = 0;
  const denied = mountActions({ canManageItemState: false });
  await settle();
  expect(findButtonByText(denied, 'prReview.archivePullRequest')).toBeNull();
  expect(apiCalls.filter((call) => call.url.endsWith('/archived-pulls'))).toHaveLength(0);
});

test('archives only after confirmation, then reports the new state', async () => {
  const root = mountActions();
  await settle();
  apiCalls.length = 0;

  findButtonByText(root, 'prReview.archivePullRequest')!.click();
  await settle();

  expect(dialog()).not.toBeNull();
  expect(dialogHeading()).toBe('prReview.archivePullRequestConfirm');
  expect(archiveCalls()).toEqual([]);

  dialogCancelButton()!.click();
  await settle();
  expect(dialog()).toBeNull();
  expect(archiveCalls()).toEqual([]);

  findButtonByText(root, 'prReview.archivePullRequest')!.click();
  await settle();
  dialogConfirmButton()!.click();
  await settle();

  expect(archiveCalls()).toEqual([
    { url: '/api/pulls/acme/widgets/7/archive', method: 'POST', body: { action: 'archive' } },
  ]);
  expect(dialog()).toBeNull();
  // The archived state comes from the mutation result, not a lagging search.
  expect(findButtonByText(root, 'prReview.unarchivePullRequest')).not.toBeNull();
});

test('reads an already archived pull request and offers Unarchive, which stays closed', async () => {
  const root = mountActions({ prState: 'closed' }, [7]);
  await settle();

  expect(findButtonByText(root, 'prReview.archivePullRequest')).toBeNull();
  apiCalls.length = 0;

  findButtonByText(root, 'prReview.unarchivePullRequest')!.click();
  await settle();

  expect(dialogHeading()).toBe('prReview.unarchivePullRequestConfirm');

  apiImpl = async (url: string) => {
    if (url.endsWith('/archived-pulls')) return [7];
    return { archived: false, state: 'CLOSED' };
  };
  dialogConfirmButton()!.click();
  await settle();

  expect(archiveCalls()).toEqual([
    { url: '/api/pulls/acme/widgets/7/archive', method: 'POST', body: { action: 'unarchive' } },
  ]);
  expect(findButtonByText(root, 'prReview.archivePullRequest')).not.toBeNull();
});

test('keeps a failed archive in the dialog and leaves the pull request unchanged', async () => {
  const root = mountActions();
  await settle();

  apiImpl = async (url: string) => {
    if (url.endsWith('/archived-pulls')) return [];
    throw { data: { statusMessage: 'Repository was archived so is read-only' } };
  };

  findButtonByText(root, 'prReview.archivePullRequest')!.click();
  await settle();
  dialogConfirmButton()!.click();
  await settle();

  expect(dialog()).not.toBeNull();
  expect(dialog()!.textContent).toContain('Repository was archived so is read-only');
  expect(findButtonByText(root, 'prReview.archivePullRequest')).not.toBeNull();
});

test('does not offer Archive when the archive state could not be read reliably', async () => {
  dom = createVueDom();
  apiImpl = async (url: string) => {
    if (url.endsWith('/archived-pulls')) throw { status: 403 };
    return { archived: true };
  };

  const root = dom.mount(
    defineComponent({
      setup: () => () => h(PRActions as Component, { ...baseProps }),
    })
  ).root;
  await settle();

  // The read failed, so the pull request is not reported as archived; Archive
  // stays offered rather than the control silently vanishing.
  expect(findButtonByText(root, 'prReview.archivePullRequest')).not.toBeNull();
});

test('offers no Archive on a merged pull request, but still lets an archived one be unarchived', async () => {
  const root = mountActions({ merged: true, prState: 'closed' });
  await settle();
  expect(findButtonByText(root, 'prReview.archivePullRequest')).toBeNull();
  await dom?.cleanup();
  dom = undefined;

  const archivedMerged = mountActions({ merged: true, prState: 'closed' }, [7]);
  await settle();
  expect(findButtonByText(archivedMerged, 'prReview.unarchivePullRequest')).not.toBeNull();
});
