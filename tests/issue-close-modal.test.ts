import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { getIssueStateVisual } from '../app/utils/getDashboardSubjectStateVisual';
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
  REPOSITORY_SEARCH_DEBOUNCE_MS: 0,
};

const getFetchErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const FilterSegmentedControl = await compileVue('app/components/ui/FilterSegmentedControl.vue');

const IssueCloseModal = await compileVue(
  'app/components/dashboard/issue/IssueCloseModal.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': { useI18n: () => ({ t }) },
    '~/components/ui/FilterSegmentedControl.vue': { default: FilterSegmentedControl },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
    '~/utils/getDashboardSubjectStateVisual': { getIssueStateVisual },
    'test/stubs': stubs,
  },
  {
    useModalLifecycle: 'test/stubs',
    useGitPulseApiFetch: 'test/stubs',
    REPOSITORY_SEARCH_DEBOUNCE_MS: 'test/stubs',
  }
);

const IssueActions = await compileVue(
  'app/components/dashboard/issue/IssueActions.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': { useI18n: () => ({ t, locale: shallowRef('en') }) },
    '~/components/ui/GitHubIcon.vue': { default: icon },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
    './LockReasonModal.vue': { default: icon },
    './IssueCloseModal.vue': { default: IssueCloseModal },
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
  params: Record<string, string>;
  method: string;
  body?: unknown;
}

let dom: ReturnType<typeof createVueDom>;
afterEach(async () => dom?.cleanup());

const page = (items: unknown[], current = 1, hasNext = false) => ({
  items,
  pagination: {
    page: current,
    perPage: 20,
    hasPrev: current > 1,
    hasNext,
    totalCount: null,
    totalPages: null,
  },
});

const issue = (number: number, title: string, extra: Record<string, unknown> = {}) => ({
  id: number * 100,
  number,
  title,
  state: 'open',
  ...extra,
});

function mountActions(respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  const emitted: { state: unknown[][]; timeline: unknown[] } = { state: [], timeline: [] };
  apiFetch = async (url, init) => {
    const parsed = new URL(url, 'https://gitpulse.test');
    const call: Call = {
      path: parsed.pathname,
      params: Object.fromEntries(parsed.searchParams),
      method: init?.method ?? 'GET',
      body: init?.body,
    };
    calls.push(call);
    return respond(call);
  };

  dom = createVueDom({
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueActions, {
          isLocked: false,
          canLockIssue: false,
          canManageState: true,
          issueState: 'open',
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
  return { calls, emitted, document: dom.document };
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
const buttonNamed = (name: string) =>
  Array.from(dialog()!.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === name || button.textContent?.trim() === name
  )!;
const fieldNamed = (name: string) =>
  dialog()!.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
const rowTexts = () =>
  Array.from(dialog()!.querySelectorAll<HTMLElement>('[data-picker-row]')).map((row) =>
    row.textContent!.replace(/\s+/g, ' ').trim()
  );
const rowNamed = (text: string) =>
  Array.from(dialog()!.querySelectorAll<HTMLElement>('[data-picker-row]')).find((row) =>
    row.textContent!.includes(text)
  )!;
const radio = (value: string) =>
  dialog()!.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!;
const type = async (field: HTMLInputElement, value: string) => {
  field.value = value;
  field.dispatchEvent(new dom.window.Event('input') as unknown as Event);
  await settle();
};
const click = async (element: HTMLElement) => {
  element.click();
  await settle();
};
const openCloseModal = async () => {
  const sidebarClose = Array.from(dom.document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'issueDetail.closeIssue'
  )!;
  await click(sidebarClose);
};
const confirmButton = () =>
  dialog()!.querySelector<HTMLButtonElement>('.label-editor-footer .label-btn-save')!;

const searchIssueCalls = (calls: Call[]) =>
  calls.filter((call) => call.path === '/api/search/issues').map((call) => call.params);

test('closes as Completed or Not planned without choosing a Duplicate Target', async () => {
  const { calls, emitted } = mountActions(() => ({
    state: 'closed',
    stateReason: 'not_planned',
    closedAt: '2026-11-20T10:00:00Z',
    duplicateOf: null,
  }));

  await openCloseModal();
  expect(heading()).toBe('issueDetail.closeIssueReason');
  expect(
    Array.from(dialog()!.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(
      (input) => input.value
    )
  ).toEqual(['completed', 'not_planned', 'duplicate']);
  expect(radio('completed').checked).toBe(true);
  expect(confirmButton().disabled).toBe(false);

  await click(radio('not_planned'));
  await click(confirmButton());

  expect(calls).toEqual([
    {
      path: '/api/repos/acme/widgets/issues/7/state',
      params: {},
      method: 'PATCH',
      body: { state: 'closed', state_reason: 'not_planned' },
    },
  ]);
  expect(emitted.state).toEqual([['closed', 'not_planned', null]]);
  expect(dialog()).toBeNull();
});

test('finds a Duplicate Target in the current repository by title or number', async () => {
  const { calls } = mountActions((call) => {
    if (call.path !== '/api/search/issues') throw new Error(`unexpected ${call.path}`);
    if (call.params.q!.includes(' 5 ')) {
      return page([issue(5, 'Login fails'), issue(15, 'Session expires early')]);
    }
    if (call.params.page === '2') return page([issue(3, 'Older report')], 2);
    return page(
      [
        issue(7, 'The issue being closed'),
        issue(6, 'A pull request', { pull_request: { url: 'x' } }),
        issue(5, 'Login fails'),
      ],
      1,
      true
    );
  });

  await openCloseModal();
  await click(radio('duplicate'));
  expect(confirmButton().disabled).toBe(true);

  await click(buttonNamed('issueDetail.chooseDuplicateTarget'));
  expect(heading()).toBe('issueDetail.duplicateOf');
  expect(buttonNamed('issueDetail.changeRepository').textContent).toContain('acme/widgets');
  expect(rowTexts()).toEqual(['#5 Login fails']);

  await click(buttonNamed('dashboard.pagination.next'));
  expect(rowTexts()).toEqual(['#3 Older report']);

  await type(fieldNamed('issueDetail.searchIssues'), 'login');
  await type(fieldNamed('issueDetail.searchIssues'), '#5');
  expect(rowTexts()).toEqual(['#5 Login fails']);

  expect(searchIssueCalls(calls)).toEqual([
    { q: 'repo:acme/widgets is:issue sort:updated-desc', page: '1', per_page: '20' },
    { q: 'repo:acme/widgets is:issue sort:updated-desc', page: '2', per_page: '20' },
    { q: 'repo:acme/widgets is:issue login in:title sort:updated-desc', page: '1', per_page: '20' },
    { q: 'repo:acme/widgets is:issue 5 sort:updated-desc', page: '1', per_page: '20' },
  ]);

  // Back returns to the reason page; reopening the picker keeps the query and results.
  await click(buttonNamed('issueDetail.back'));
  expect(heading()).toBe('issueDetail.closeIssueReason');
  expect(radio('duplicate').checked).toBe(true);
  await click(buttonNamed('issueDetail.chooseDuplicateTarget'));
  expect(fieldNamed('issueDetail.searchIssues').value).toBe('#5');
  expect(rowTexts()).toEqual(['#5 Login fails']);
  expect(searchIssueCalls(calls)).toHaveLength(4);
});

test('chooses a cross-repository Duplicate Target through accessible and GitHub-wide repository search', async () => {
  const { calls, emitted } = mountActions((call) => {
    switch (call.path) {
      case '/api/search/issues':
        return call.params.q!.startsWith('repo:other/lib')
          ? page([issue(42, 'Original report')])
          : page([issue(5, 'Login fails')]);
      case '/api/repos':
        return call.params.q
          ? page([{ full_name: 'acme/lib-tools', name: 'lib-tools', owner: { login: 'acme' } }])
          : page([{ full_name: 'acme/widgets', name: 'widgets', owner: { login: 'acme' } }]);
      case '/api/search/repositories':
        return page([{ full_name: 'other/lib', name: 'lib', owner: { login: 'other' } }]);
      case '/api/repos/acme/widgets/issues/7/state':
        return {
          state: 'closed',
          stateReason: 'duplicate',
          closedAt: '2026-11-20T10:00:00Z',
          duplicateOf: { resourceType: 'issue', number: 42, title: 'Original report' },
        };
      default:
        throw new Error(`unexpected ${call.path}`);
    }
  });

  await openCloseModal();
  await click(radio('duplicate'));
  await click(buttonNamed('issueDetail.chooseDuplicateTarget'));
  await click(buttonNamed('issueDetail.changeRepository'));

  expect(heading()).toBe('issueDetail.chooseRepository');
  expect(rowTexts()).toEqual(['acme/widgets']);

  await type(fieldNamed('issueDetail.searchRepositories'), 'lib');
  expect(rowTexts()).toEqual(['acme/lib-tools']);

  const scopes = Array.from(dialog()!.querySelectorAll<HTMLElement>('[role="tab"]'));
  expect(scopes.map((scope) => scope.textContent?.trim())).toEqual([
    'issueDetail.yourRepositories',
    'issueDetail.searchAllGitHub',
  ]);
  expect(scopes[0]!.getAttribute('aria-selected')).toBe('true');
  await click(scopes[1]!);
  expect(rowTexts()).toEqual(['other/lib']);

  // GitHub-wide search never enumerates every repository for an empty query.
  await type(fieldNamed('issueDetail.searchRepositories'), '');
  expect(rowTexts()).toEqual([]);
  expect(dialog()!.textContent).toContain('issueDetail.searchAllGitHubHint');
  await type(fieldNamed('issueDetail.searchRepositories'), 'lib');

  await click(rowNamed('other/lib'));
  expect(heading()).toBe('issueDetail.duplicateOf');
  expect(buttonNamed('issueDetail.changeRepository').textContent).toContain('other/lib');
  await click(rowNamed('#42'));

  expect(heading()).toBe('issueDetail.closeIssueReason');
  expect(dialog()!.textContent).toContain('other/lib#42');

  // A Duplicate Target survives a detour through another reason, and is sent only for Duplicate.
  await click(radio('completed'));
  await click(radio('duplicate'));
  expect(dialog()!.textContent).toContain('other/lib#42');
  await click(confirmButton());

  expect(calls.map((call) => [call.path, call.params])).toEqual([
    [
      '/api/search/issues',
      { q: 'repo:acme/widgets is:issue sort:updated-desc', page: '1', per_page: '20' },
    ],
    ['/api/repos', { scope: 'accessible', page: '1', per_page: '20' }],
    ['/api/repos', { scope: 'accessible', q: 'lib', page: '1', per_page: '20' }],
    ['/api/search/repositories', { q: 'lib', page: '1', per_page: '20' }],
    ['/api/search/repositories', { q: 'lib', page: '1', per_page: '20' }],
    [
      '/api/search/issues',
      { q: 'repo:other/lib is:issue sort:updated-desc', page: '1', per_page: '20' },
    ],
    ['/api/repos/acme/widgets/issues/7/state', {}],
  ]);
  expect(calls.at(-1)!.body).toEqual({
    state: 'closed',
    state_reason: 'duplicate',
    duplicate_of: { owner: 'other', repo: 'lib', number: 42 },
  });
  expect(emitted.state).toEqual([
    ['closed', 'duplicate', { resourceType: 'issue', number: 42, title: 'Original report' }],
  ]);
  expect(emitted.timeline).toEqual([
    expect.objectContaining({
      eventType: 'closed',
      stateReason: 'duplicate',
      duplicate: { resourceType: 'issue', number: 42, title: 'Original report' },
    }),
  ]);
});

test('a cleared Duplicate Target blocks confirmation, and a failed close keeps the choice', async () => {
  let failClose = true;
  const { calls } = mountActions((call) => {
    if (call.path === '/api/search/issues') return page([issue(5, 'Login fails')]);
    if (failClose) throw new Error('Issue could not be closed');
    return { state: 'closed', stateReason: 'duplicate', closedAt: null, duplicateOf: null };
  });

  await openCloseModal();
  await click(radio('duplicate'));
  await click(buttonNamed('issueDetail.chooseDuplicateTarget'));
  await click(rowNamed('#5'));
  expect(confirmButton().disabled).toBe(false);

  await click(buttonNamed('issueDetail.clearDuplicateTarget'));
  expect(dialog()!.textContent).not.toContain('acme/widgets#5');
  expect(confirmButton().disabled).toBe(true);

  await click(buttonNamed('issueDetail.chooseDuplicateTarget'));
  await click(rowNamed('#5'));
  await click(confirmButton());

  expect(dialog()!.textContent).toContain('Issue could not be closed');
  expect(radio('duplicate').checked).toBe(true);
  expect(dialog()!.textContent).toContain('acme/widgets#5');

  failClose = false;
  await click(confirmButton());
  expect(calls.filter((call) => call.method === 'PATCH').map((call) => call.body)).toEqual([
    {
      state: 'closed',
      state_reason: 'duplicate',
      duplicate_of: { owner: 'acme', repo: 'widgets', number: 5 },
    },
    {
      state: 'closed',
      state_reason: 'duplicate',
      duplicate_of: { owner: 'acme', repo: 'widgets', number: 5 },
    },
  ]);
  expect(dialog()).toBeNull();

  // Dismissing and reopening starts from a clean choice.
  await openCloseModal();
  expect(radio('completed').checked).toBe(true);
  expect(dialog()!.textContent).not.toContain('acme/widgets#5');
});
