import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { getDashboardSubjectStateVisual } from '../app/utils/getDashboardSubjectStateVisual';
import { shouldShowNotificationSubjectNumber } from '../app/utils/shouldShowNotificationSubjectNumber';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import * as prChecks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const stub = defineComponent({ setup: () => () => h('div') });

const NotificationItem = await compileVue(
  'app/components/dashboard/NotificationItem.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    '#shared/utils/linked-pull-requests': linkedPullRequests,
    '#shared/utils/pr-checks': prChecks,
    '~/components/dashboard/issue/IssueTypeBadge.vue': stub,
    '~/components/dashboard/LinkedPullRequestCountControl.vue': stub,
    '~/components/dashboard/pr/CheckStatusChip.vue': stub,
    '~/components/ui/GitHubAvatar.vue': stub,
    '~/components/ui/LoadingIcon.vue': stub,
    '~/utils/getDashboardSubjectStateVisual': { getDashboardSubjectStateVisual },
    '~/utils/shouldShowNotificationSubjectNumber': { shouldShowNotificationSubjectNumber },
    'virtual:app-runtime': {
      useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }),
      useCheckListModal: () => ({ open: () => {} }),
      useRelativeTimeNow: () => shallowRef(new Date().toISOString()),
    },
    'virtual:formatters': {
      formatDurationFromNow: () => '3 hours ago',
      formatCompactNumber: (value: number) => String(value),
    },
    'virtual:subject-utils': {
      getNotificationSubjectEnrichmentPresentation: () => ({
        avatarMode: 'static',
        showsTypeBadge: true,
        animatesSubjectBadge: false,
        showsFailureMessage: false,
      }),
      getNotificationLinkedPullRequestListSummary: () => null,
      parseGitHubNotificationSubjectTarget: () => null,
    },
  },
  {
    useI18n: 'virtual:app-runtime',
    useCheckListModal: 'virtual:app-runtime',
    useRelativeTimeNow: 'virtual:app-runtime',
    formatDurationFromNow: 'virtual:formatters',
    formatCompactNumber: 'virtual:formatters',
    getNotificationSubjectEnrichmentPresentation: 'virtual:subject-utils',
    getNotificationLinkedPullRequestListSummary: 'virtual:subject-utils',
    parseGitHubNotificationSubjectTarget: 'virtual:subject-utils',
  }
);

const notification = {
  id: 'n1',
  unread: false,
  updated_at: new Date().toISOString(),
  reason: 'subscribed',
  repository: { full_name: 'acme/gitpulse' },
  subject: {
    title: 'Flaky notification delivery',
    type: 'Issue',
    number: 12,
    state: 'open',
  },
};

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

function mountItem(props: Record<string, unknown>) {
  const acted = [];
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(NotificationItem as never, {
          notification,
          ...props,
          onTodoAction: (item: unknown) => {
            acted.push(item);
          },
        }),
    })
  );

  return { ...view, acted };
}

const isSavedCard = (root: Element) =>
  root.querySelector('.notification-card')?.classList.contains('notification-card--todo') ?? false;

describe('dashboard Notification item todo state', () => {
  test('fills the control and the card for a notification already in the todos', async () => {
    const view = mountItem({ todoAction: 'remove' });
    await nextTick();

    const button = view.root.querySelector('.notification-card__todo-btn');
    expect(button?.classList.contains('notification-card__todo-btn--saved')).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('dashboard.todos.removeAction');
    expect(isSavedCard(view.root)).toBe(true);
    expect(view.root.querySelector('.notification-card__todo-mark')).toBeNull();
  });

  test('keeps an unsaved notification offering the add action', async () => {
    const view = mountItem({ todoAction: 'add' });
    await nextTick();

    const button = view.root.querySelector('.notification-card__todo-btn');
    expect(button?.classList.contains('notification-card__todo-btn--add')).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('dashboard.todos.addAction');
    expect(isSavedCard(view.root)).toBe(false);
  });

  test('states a saved row itself where the narrow swipe replaced the control', async () => {
    const view = mountItem({ todoAction: 'remove', hideTodoControl: true });
    await nextTick();

    expect(view.root.querySelector('.notification-card__todo-btn')).toBeNull();

    const mark = view.root.querySelector('.notification-card__todo-mark');
    expect(mark?.getAttribute('aria-label')).toBe('dashboard.todos.savedState');
    expect(mark?.getAttribute('role')).toBe('img');
    expect(isSavedCard(view.root)).toBe(true);
  });

  test('still states a saved row when the reason control is hidden', async () => {
    const view = mountItem({ todoAction: 'remove', hideTodoControl: true, showReason: false });
    await nextTick();

    expect(view.root.querySelector('.notification-card__todo-mark')).not.toBeNull();
  });

  test('shows no saved mark on an addable row the gesture replaced the control on', async () => {
    const view = mountItem({ todoAction: 'add', hideTodoControl: true, showReason: false });
    await nextTick();

    expect(view.root.querySelector('.notification-card__todo-mark')).toBeNull();
  });

  test('asks its owner to toggle the todo when the control is pressed', async () => {
    const view = mountItem({ todoAction: 'remove' });
    await nextTick();

    view.root
      .querySelector('.notification-card__todo-btn')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(view.acted).toEqual([notification]);
  });
});
