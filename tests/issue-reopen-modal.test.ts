import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const icons = new Proxy({}, { get: () => icon });
const t = (key: string) => key;

type ApiFetch = (url: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;
let apiFetch: ApiFetch = async () => {
  throw new Error('apiFetch not configured');
};

const stubs = {
  useModalLifecycle,
  useGitPulseApiFetch: () => (url: string, init?: { method?: string; body?: unknown }) =>
    apiFetch(url, init),
  useUserSession: () => ({ user: shallowRef({ login: 'maintainer', avatar_url: '' }) }),
  useNotificationTodos: () => ({
    isNotificationTodo: () => false,
    toggleNotificationTodo: () => {},
  }),
};

const getFetchErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const ConfirmModal = await compileVue(
  'app/components/dashboard/ConfirmModal.vue',
  {
    '@lucide/vue': icons,
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/stubs': stubs,
  },
  { useModalLifecycle: 'test/stubs' }
);

const IssueActions = await compileVue(
  'app/components/dashboard/issue/IssueActions.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': { useI18n: () => ({ t, locale: shallowRef('en') }) },
    '~/components/ui/GitHubIcon.vue': { default: icon },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
    './LockReasonModal.vue': { default: icon },
    './IssueCloseModal.vue': { default: icon },
    '~/components/dashboard/ConfirmModal.vue': { default: ConfirmModal },
    'test/stubs': stubs,
  },
  {
    useUserSession: 'test/stubs',
    useNotificationTodos: 'test/stubs',
    useGitPulseApiFetch: 'test/stubs',
  }
);

interface Call {
  path: string;
  method: string;
  body?: unknown;
}

let dom: ReturnType<typeof createVueDom>;
afterEach(async () => dom?.cleanup());

function mountClosedIssueActions(respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  const emitted: { state: unknown[][]; timeline: unknown[] } = { state: [], timeline: [] };
  apiFetch = async (url, init) => {
    const parsed = new URL(url, 'https://gitpulse.test');
    const call: Call = {
      path: parsed.pathname,
      method: init?.method ?? 'GET',
      body: init?.body,
    };
    calls.push(call);
    return respond(call);
  };

  dom = createVueDom();
  dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueActions, {
          isLocked: false,
          canLockIssue: false,
          canManageState: true,
          issueState: 'closed',
          repoInfo: { owner: 'acme', repo: 'widgets' },
          issueNumber: 7,
          htmlUrl: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          'onUpdate:state': (...args: unknown[]) => emitted.state.push(args),
          onAddTimelineEvent: (event: unknown) => emitted.timeline.push(event),
        }),
    })
  );
  return { calls, emitted };
}

const settle = async () => {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
};

const dialog = () => dom.document.querySelector<HTMLElement>('[role="dialog"]');
const heading = () =>
  dom.document.getElementById(dialog()!.getAttribute('aria-labelledby')!)?.textContent?.trim();
const reopenTrigger = () =>
  Array.from(dom.document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === 'issueDetail.reopenIssue'
  )!;
const cancelButton = () =>
  dialog()!.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-cancel')!;
const confirmButton = () =>
  dialog()!.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-save')!;

test('requires confirmation before reopening and closes without calling API on cancel or Escape', async () => {
  const { calls, emitted } = mountClosedIssueActions(() => ({}));

  reopenTrigger().click();
  await settle();

  expect(calls).toEqual([]);
  expect(dialog()).not.toBeNull();
  expect(heading()).toBe('issueDetail.reopenIssueConfirm');
  expect(dialog()!.querySelectorAll('input[type="radio"]')).toHaveLength(0);

  cancelButton().click();
  await settle();
  expect(dialog()).toBeNull();
  expect(calls).toEqual([]);

  reopenTrigger().click();
  await settle();
  expect(dialog()).not.toBeNull();

  dialog()!.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event
  );
  await settle();
  expect(dialog()).toBeNull();
  expect(calls).toEqual([]);
  expect(emitted.state).toEqual([]);
});

test('reopens after confirmation, prevents duplicate submits while pending, and surfaces errors inside the dialog', async () => {
  let resolvePending: ((value: unknown) => void) | undefined;
  let mode: 'fail' | 'pending' = 'fail';

  const { calls, emitted } = mountClosedIssueActions(() => {
    if (mode === 'fail') throw new Error('Could not reopen issue');
    return new Promise((resolve) => {
      resolvePending = resolve;
    });
  });

  reopenTrigger().click();
  await settle();

  confirmButton().click();
  await settle();

  expect(dialog()).not.toBeNull();
  expect(dialog()!.textContent).toContain('Could not reopen issue');
  expect(dom.document.querySelector('.sidebar-alert--error')).toBeNull();

  mode = 'pending';
  confirmButton().click();
  await nextTick();

  expect(confirmButton().disabled).toBe(true);
  expect(cancelButton().disabled).toBe(true);
  expect(confirmButton().textContent).toContain('issueDetail.reopening');

  confirmButton().click();
  expect(calls).toHaveLength(2);

  resolvePending?.({ state: 'open', stateReason: 'reopened', duplicateOf: null });
  await settle();

  expect(calls).toEqual([
    { path: '/api/repos/acme/widgets/issues/7/state', method: 'PATCH', body: { state: 'open' } },
    { path: '/api/repos/acme/widgets/issues/7/state', method: 'PATCH', body: { state: 'open' } },
  ]);
  expect(emitted.state).toEqual([['open', 'reopened', null]]);
  expect(emitted.timeline).toEqual([
    expect.objectContaining({
      eventType: 'reopened',
      actor: expect.objectContaining({ login: 'maintainer' }),
    }),
  ]);
  expect(dialog()).toBeNull();
});
