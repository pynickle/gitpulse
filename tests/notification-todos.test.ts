import { describe, expect, mock, test } from 'bun:test';

import type { DashboardNotification } from '../shared/types/notifications';
import type { NotificationTodoItem } from '../shared/types/user-settings';

const userSettingsUtils = await import('../shared/utils/user-settings');
const notificationUtils = await import('../shared/utils/notifications');
const notificationSubjectTargetUtils =
  await import('../app/utils/parseGitHubNotificationSubjectTarget');

mock.module('#shared/utils/notifications', () => notificationUtils);
mock.module('#shared/utils/user-settings', () => userSettingsUtils);
mock.module('~/utils/parseGitHubNotificationSubjectTarget', () => notificationSubjectTargetUtils);

const {
  applyNotificationTodoSubjectStates,
  collectNotificationTodoSubjectStateTargets,
  createNotificationTodoItem,
} = await import('../app/composables/useNotificationTodos');

const createIssueNotification = (id: string): DashboardNotification => ({
  id,
  unread: true,
  updated_at: '2026-06-17T12:00:00.000Z',
  subject: {
    title: 'Old title',
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

const createDiscussionNotification = (id: string): DashboardNotification => ({
  id,
  unread: true,
  updated_at: '2026-06-17T13:00:00.000Z',
  subject: {
    title: 'Old discussion',
    type: 'Discussion',
    url: 'https://github.com/owner/repo/discussions/8',
  },
  repository: {
    full_name: 'owner/repo',
    owner: {
      login: 'owner',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
  },
});

describe('notification todos', () => {
  test('creates read notification todo snapshots', () => {
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
          title: 'Old title',
          type: 'Issue',
        },
      },
    });
  });

  test('collects unique GraphQL refresh targets for todo issues, pull requests, and discussions', () => {
    const firstTodo = createNotificationTodoItem(
      createIssueNotification('123'),
      '2026-06-18T00:00:00.000Z'
    );
    const duplicateTodo = createNotificationTodoItem(
      createIssueNotification('456'),
      '2026-06-18T00:01:00.000Z'
    );
    const discussionTodo = createNotificationTodoItem(
      createDiscussionNotification('987'),
      '2026-06-18T00:01:30.000Z'
    );
    const releaseTodo = createNotificationTodoItem(
      {
        id: '789',
        subject: {
          type: 'Release',
          url: 'https://api.github.com/repos/owner/repo/releases/9',
        },
      },
      '2026-06-18T00:02:00.000Z'
    );

    expect(
      collectNotificationTodoSubjectStateTargets(
        [firstTodo, duplicateTodo, discussionTodo, releaseTodo].filter(
          (item): item is NotificationTodoItem => item !== null
        )
      )
    ).toEqual([
      {
        key: 'owner/repo/issues/12',
        owner: 'owner',
        repo: 'repo',
        type: 'issues',
        number: 12,
      },
      {
        key: 'owner/repo/discussions/8',
        owner: 'owner',
        repo: 'repo',
        type: 'discussions',
        number: 8,
      },
    ]);
  });

  test('applies latest GraphQL subject data to stored todo snapshots', () => {
    const todo = createNotificationTodoItem(
      createIssueNotification('123'),
      '2026-06-18T00:00:00.000Z'
    );
    if (!todo) throw new Error('Expected todo fixture');

    const updated = applyNotificationTodoSubjectStates(
      [todo],
      [
        {
          key: 'owner/repo/issues/12',
          title: 'New title',
          updatedAt: '2026-06-18T09:30:00.000Z',
          state: 'closed',
          labels: [{ name: 'bug', color: 'd73a4a' }],
          authorLogin: 'octocat',
          authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
        },
      ]
    );

    expect(updated).toEqual([
      {
        id: '123',
        addedAt: '2026-06-18T00:00:00.000Z',
        notification: {
          id: '123',
          unread: false,
          updated_at: '2026-06-18T09:30:00.000Z',
          reason: undefined,
          html_url: undefined,
          subject: {
            title: 'New title',
            type: 'Issue',
            url: 'https://api.github.com/repos/owner/repo/issues/12',
            number: undefined,
            state: 'closed',
            isAnswered: undefined,
            stateStatus: 'loaded',
            labels: [{ name: 'bug', color: 'd73a4a' }],
            authorLogin: 'octocat',
            authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
          },
          repository: {
            full_name: 'owner/repo',
            url: undefined,
            owner: {
              login: 'owner',
              avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
            },
          },
        },
      },
    ]);
  });

  test('applies discussion author and answer state to stored todo snapshots', () => {
    const todo = createNotificationTodoItem(
      createDiscussionNotification('987'),
      '2026-06-18T00:00:00.000Z'
    );
    if (!todo) throw new Error('Expected todo fixture');

    const updated = applyNotificationTodoSubjectStates(
      [todo],
      [
        {
          key: 'owner/repo/discussions/8',
          title: 'New discussion',
          updatedAt: '2026-06-18T10:30:00.000Z',
          isAnswered: false,
          authorLogin: 'maintainer',
          authorAvatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
        },
      ]
    );

    expect(updated[0]?.notification.subject).toEqual({
      title: 'New discussion',
      type: 'Discussion',
      url: 'https://github.com/owner/repo/discussions/8',
      number: undefined,
      state: undefined,
      isAnswered: false,
      stateStatus: 'loaded',
      labels: undefined,
      authorLogin: 'maintainer',
      authorAvatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
    });
  });
});
