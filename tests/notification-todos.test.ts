import { describe, expect, mock, test } from 'bun:test';

import type { DashboardNotification } from '../shared/types/notifications';

const userSettingsUtils = await import('../shared/utils/user-settings');
mock.module('#shared/utils/user-settings', () => userSettingsUtils);

const { createNotificationTodoItem, getNotificationTodoId } =
  await import('../app/composables/useNotificationTodos');

const createIssueNotification = (id: string): DashboardNotification => ({
  id,
  unread: true,
  updated_at: '2026-06-17T12:00:00.000Z',
  subject: {
    title: 'Saved title',
    type: 'Issue',
    url: 'https://api.github.com/repos/owner/repo/issues/12',
  },
  repository: {
    full_name: 'owner/repo',
    owner: {
      login: 'owner',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
  },
});

describe('Notification Todos', () => {
  test('uses the GitHub Notification id as the Todo identity', () => {
    expect(getNotificationTodoId(createIssueNotification('123'))).toBe('123');
  });

  test('creates a read Notification Todo snapshot', () => {
    const todo = createNotificationTodoItem(
      createIssueNotification('123'),
      '2026-06-18T00:00:00.000Z'
    );

    expect(todo).toMatchObject({
      id: '123',
      addedAt: '2026-06-18T00:00:00.000Z',
      notification: {
        id: '123',
        unread: false,
        subject: {
          title: 'Saved title',
          type: 'Issue',
        },
      },
    });
  });

  test('does not persist pending or error enrichment status in a snapshot', () => {
    const pending = createIssueNotification('pending');
    if (pending.subject) pending.subject.stateStatus = 'pending';
    const errored = createIssueNotification('error');
    if (errored.subject) errored.subject.stateStatus = 'error';

    expect(createNotificationTodoItem(pending)?.notification.subject?.stateStatus).toBeUndefined();
    expect(createNotificationTodoItem(errored)?.notification.subject?.stateStatus).toBeUndefined();
  });
});
