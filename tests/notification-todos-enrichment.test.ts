import { describe, expect, mock, test } from 'bun:test';

import { shallowRef } from 'vue';

import parseGitHubNotificationSubjectTarget from '../app/utils/parseGitHubNotificationSubjectTarget';
import type { DashboardNotification } from '../shared/types/notifications';
import type { NotificationTodoItem } from '../shared/types/user-settings';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import { InMemoryNotificationSubjectEnrichmentAdapter } from './support/inMemoryNotificationSubjectEnrichmentAdapter';

const userSettingsUtils = await import('../shared/utils/user-settings');

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);
mock.module('#shared/utils/user-settings', () => userSettingsUtils);

const { createNotificationSubjectEnrichmentSession } =
  await import('../app/composables/notification-subject-enrichment/session');

const { useNotificationTodos } = await import('../app/composables/useNotificationTodos');

const todo = (
  id: string,
  number: number,
  subject: DashboardNotification['subject'] = {}
): NotificationTodoItem => ({
  id,
  addedAt: '2026-08-12T00:00:00.000Z',
  notification: {
    id,
    unread: false,
    updated_at: '2026-08-11T00:00:00.000Z',
    subject: {
      title: `Saved ${number}`,
      type: 'Issue',
      url: `https://api.github.com/repos/acme/widgets/issues/${number}`,
      number,
      state: 'closed',
      stateStatus: 'loaded',
      authorLogin: `saved-author-${number}`,
      ...subject,
    },
  },
});

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createHarness = (
  initialTodos: NotificationTodoItem[],
  adapter: InMemoryNotificationSubjectEnrichmentAdapter
) => {
  const settings = shallowRef({ notificationTodos: structuredClone(initialTodos) });
  const persisted: NotificationTodoItem[][] = [];

  (
    globalThis as unknown as {
      useUserSettings: typeof useUserSettings;
    }
  ).useUserSettings = () =>
    ({
      settings,
      loadSettings: async () => settings.value,
      updateSettings: async (patch: { notificationTodos?: NotificationTodoItem[] }) => {
        if (patch.notificationTodos) {
          const nextTodos = structuredClone(patch.notificationTodos);
          persisted.push(nextTodos);
          settings.value = { notificationTodos: nextTodos };
        }
        return settings.value;
      },
    }) as ReturnType<typeof useUserSettings>;
  (
    globalThis as unknown as {
      useNotificationSubjectEnrichment: typeof useNotificationSubjectEnrichment;
    }
  ).useNotificationSubjectEnrichment = () =>
    createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

  return {
    composable: useNotificationTodos(),
    persisted,
  };
};

describe('Notification Todo enrichment', () => {
  test('shows pending state without persisting it and keeps the saved snapshot visible', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    const { composable, persisted } = createHarness([todo('one', 1)], adapter);

    const refresh = composable.refreshNotificationTodos();
    await flushPromises();

    expect(composable.todos.value[0]?.notification.subject).toMatchObject({
      title: 'Saved 1',
      state: 'closed',
      authorLogin: 'saved-author-1',
      stateStatus: 'pending',
    });
    expect(persisted).toEqual([]);

    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Current 1',
        state: 'open',
      },
    ]);
    await refresh;
  });

  test('persists successful partial results while failed snapshots remain view-only errors', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets) => {
      return targets
        .filter((target) => target.number === 1)
        .map((target) => ({
          key: target.key,
          title: 'Current 1',
          state: 'open',
          authorLogin: 'current-author',
        }));
    });
    const { composable, persisted } = createHarness([todo('one', 1), todo('two', 2)], adapter);

    await composable.refreshNotificationTodos();

    expect(composable.refreshError.value).toBe(true);
    expect(composable.todos.value[0]?.notification.subject).toMatchObject({
      title: 'Current 1',
      state: 'open',
      authorLogin: 'current-author',
      stateStatus: 'loaded',
    });
    expect(composable.todos.value[1]?.notification.subject).toMatchObject({
      title: 'Saved 2',
      state: 'closed',
      authorLogin: 'saved-author-2',
      stateStatus: 'error',
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.[0]?.notification.subject?.title).toBe('Current 1');
    expect(persisted[0]?.[1]?.notification.subject).toMatchObject({
      title: 'Saved 2',
      stateStatus: 'loaded',
    });

    const fresh = createHarness(
      persisted[0] ?? [],
      new InMemoryNotificationSubjectEnrichmentAdapter()
    ).composable;
    expect(fresh.refreshError.value).toBe(false);
    expect(fresh.todos.value[1]?.notification.subject?.stateStatus).toBe('loaded');
  });

  test('keeps the newer refresh pending when an older refresh becomes stale', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    const { composable } = createHarness([todo('one', 1)], adapter);

    const firstRefresh = composable.refreshNotificationTodos();
    await flushPromises();
    const secondRefresh = composable.refreshNotificationTodos();
    await flushPromises();

    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Stale title',
        state: 'closed',
      },
    ]);
    await firstRefresh;
    expect(composable.refreshing.value).toBe(true);
    expect(composable.todos.value[0]?.notification.subject?.stateStatus).toBe('pending');

    adapter.pending[1]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Current title',
        state: 'open',
      },
    ]);
    await secondRefresh;
    expect(composable.refreshing.value).toBe(false);
    expect(composable.todos.value[0]?.notification.subject?.title).toBe('Current title');
  });
});
