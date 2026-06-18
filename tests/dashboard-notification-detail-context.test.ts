import { describe, expect, test } from 'bun:test';

import { ref } from 'vue';

import { useDashboardNotificationDetailContext } from '../app/composables/useDashboardNotificationDetailContext';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createDetailState = () => ({
  issueKey: ref('issue-owner-repo-1'),
  pullRequestKey: ref('pr-owner-repo-2'),
  discussionKey: ref('discussion-owner-repo-3'),
  releaseKey: ref('release-owner-repo-id-4'),
  repositoryKey: ref('repo-owner-repo'),
  issueVisible: ref(true),
  pullRequestVisible: ref(false),
  discussionVisible: ref(false),
  releaseVisible: ref(false),
  repositoryVisible: ref(false),
  issueLoaded: ref({ id: 1 }),
  pullRequestLoaded: ref(null),
  discussionLoaded: ref(null),
  releaseLoaded: ref(null),
  issueLoading: ref(false),
  pullRequestLoading: ref(false),
  discussionLoading: ref(false),
  releaseLoading: ref(false),
});

describe('dashboard notification detail context', () => {
  test('keeps delayed read timers when only the source notification is cleared', async () => {
    const markedIds: string[] = [];
    const context = useDashboardNotificationDetailContext({
      settings: ref({
        notificationBehavior: {
          readMarkMode: 'delayed',
          readMarkDelaySeconds: 0.01,
        },
      }),
      detailState: createDetailState(),
      getNotificationDetails: () => ({
        owner: 'owner',
        repo: 'repo',
        number: 1,
        isIssue: true,
      }),
      openNotification: () => undefined,
      markNotificationAsRead: async (notification) => {
        markedIds.push(String(notification.id));
        return true;
      },
    });

    context.handleNotificationOpen({
      id: 'thread-1',
      unread: true,
    } as any);
    context.clearSourceNotification();

    await sleep(30);

    expect(markedIds).toEqual(['thread-1']);
    expect(context.visibleSourceNotification.value).toBe(null);
  });

  test('cancels delayed read timers when the full notification context is cleared', async () => {
    const markedIds: string[] = [];
    const context = useDashboardNotificationDetailContext({
      settings: ref({
        notificationBehavior: {
          readMarkMode: 'delayed',
          readMarkDelaySeconds: 0.01,
        },
      }),
      detailState: createDetailState(),
      getNotificationDetails: () => ({
        owner: 'owner',
        repo: 'repo',
        number: 1,
        isIssue: true,
      }),
      openNotification: () => undefined,
      markNotificationAsRead: async (notification) => {
        markedIds.push(String(notification.id));
        return true;
      },
    });

    context.handleNotificationOpen({
      id: 'thread-2',
      unread: true,
    } as any);
    context.clearNotificationDetailContext();

    await sleep(30);

    expect(markedIds).toEqual([]);
  });

  test('keeps delayed read timers when navigating to another visible detail', async () => {
    const detailState = createDetailState();
    const markedIds: string[] = [];
    const context = useDashboardNotificationDetailContext({
      settings: ref({
        notificationBehavior: {
          readMarkMode: 'delayed',
          readMarkDelaySeconds: 0.01,
        },
      }),
      detailState,
      getNotificationDetails: () => ({
        owner: 'owner',
        repo: 'repo',
        number: 1,
        isIssue: true,
      }),
      openNotification: () => undefined,
      markNotificationAsRead: async (notification) => {
        markedIds.push(String(notification.id));
        return true;
      },
    });

    context.handleNotificationOpen({
      id: 'thread-3',
      unread: true,
    } as any);

    detailState.issueVisible.value = false;
    detailState.pullRequestVisible.value = true;

    await sleep(30);

    expect(markedIds).toEqual(['thread-3']);
    expect(context.visibleSourceNotification.value).toBe(null);
  });

  test('applies auto-read behavior when opening an unread todo notification', async () => {
    const openedIds: string[] = [];
    const markedIds: string[] = [];
    const context = useDashboardNotificationDetailContext({
      settings: ref({
        notificationBehavior: {
          readMarkMode: 'immediate',
          readMarkDelaySeconds: 0,
        },
      }),
      detailState: createDetailState(),
      getNotificationDetails: () => ({
        owner: 'owner',
        repo: 'repo',
        number: 1,
        isIssue: true,
      }),
      openNotification: (notification) => {
        openedIds.push(String(notification.id));
      },
      markNotificationAsRead: async (notification) => {
        markedIds.push(String(notification.id));
        return true;
      },
    });

    context.handleTodoOpen({
      id: 'thread-4',
      unread: true,
    } as any);

    await sleep(0);

    expect(openedIds).toEqual(['thread-4']);
    expect(markedIds).toEqual(['thread-4']);
  });
});
