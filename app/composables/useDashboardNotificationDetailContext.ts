import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  toValue,
} from 'vue';

import type { DashboardNotification } from '#shared/types/notifications';

interface NotificationDetails {
  owner: string;
  repo: string;
  number: number;
  isIssue?: boolean;
  isDiscussion?: boolean;
  isRelease?: boolean;
}

interface DetailLoadState {
  issueKey: Ref<string>;
  pullRequestKey: Ref<string>;
  discussionKey: Ref<string>;
  releaseKey: Ref<string>;
  repositoryKey: Ref<string>;
  issueVisible: Ref<boolean>;
  pullRequestVisible: Ref<boolean>;
  discussionVisible: Ref<boolean>;
  releaseVisible: Ref<boolean>;
  repositoryVisible: Ref<boolean>;
  issueLoaded: MaybeRefOrGetter<unknown>;
  pullRequestLoaded: MaybeRefOrGetter<unknown>;
  discussionLoaded: MaybeRefOrGetter<unknown>;
  releaseLoaded: MaybeRefOrGetter<unknown>;
  issueLoading: Ref<boolean>;
  pullRequestLoading: Ref<boolean>;
  discussionLoading: Ref<boolean>;
  releaseLoading: Ref<boolean>;
}

interface NotificationBehaviorSettings {
  notificationBehavior: {
    readMarkMode: 'manual' | 'immediate' | 'delayed';
    readMarkDelaySeconds: number;
  };
}

interface DashboardNotificationDetailContextOptions {
  settings: Ref<NotificationBehaviorSettings>;
  detailState: DetailLoadState;
  getNotificationDetails: (notification: DashboardNotification) => NotificationDetails | null;
  openNotification: (notification: DashboardNotification) => void;
  markNotificationAsRead: (notification: DashboardNotification) => boolean | Promise<boolean>;
}

interface PendingNotificationRead {
  notification: DashboardNotification;
  detailKey: string;
}

const getNotificationThreadId = (notification: DashboardNotification) => {
  return String(notification.id);
};

const buildNotificationDetailKey = (details: NotificationDetails) => {
  if (details.isIssue) {
    return `issue-${details.owner}-${details.repo}-${details.number}`;
  }

  if (details.isDiscussion) {
    return `discussion-${details.owner}-${details.repo}-${details.number}`;
  }

  if (details.isRelease) {
    return `release-${details.owner}-${details.repo}-id-${details.number}`;
  }

  return `pr-${details.owner}-${details.repo}-${details.number}`;
};

export function useDashboardNotificationDetailContext({
  settings,
  detailState,
  getNotificationDetails,
  openNotification,
  markNotificationAsRead,
}: DashboardNotificationDetailContextOptions) {
  const componentInstance = getCurrentInstance();
  const sourceNotification = shallowRef<DashboardNotification | null>(null);
  const pendingNotificationRead = shallowRef<PendingNotificationRead | null>(null);
  const notificationReadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const currentVisibleDetailKey = computed(() => {
    if (detailState.issueVisible.value) return detailState.issueKey.value;
    if (detailState.pullRequestVisible.value) return detailState.pullRequestKey.value;
    if (detailState.discussionVisible.value) return detailState.discussionKey.value;
    if (detailState.releaseVisible.value) return detailState.releaseKey.value;
    if (detailState.repositoryVisible.value) return detailState.repositoryKey.value;
    return null;
  });

  const notificationReadMarkMode = computed(() => settings.value.notificationBehavior.readMarkMode);
  const notificationReadMarkDelayMs = computed(
    () => settings.value.notificationBehavior.readMarkDelaySeconds * 1000
  );

  const getNotificationSourceDetailKey = (notification: DashboardNotification) => {
    const details = getNotificationDetails(notification);
    return details ? buildNotificationDetailKey(details) : null;
  };

  const visibleSourceNotification = computed(() => {
    const notification = sourceNotification.value;
    if (
      !notification ||
      getNotificationSourceDetailKey(notification) !== currentVisibleDetailKey.value
    ) {
      return null;
    }

    return notification;
  });

  const clearNotificationReadTimer = (threadId: string) => {
    const timer = notificationReadTimers.get(threadId);
    if (!timer) return;

    clearTimeout(timer);
    notificationReadTimers.delete(threadId);
  };

  const clearNotificationReadTimers = () => {
    for (const timer of notificationReadTimers.values()) {
      clearTimeout(timer);
    }
    notificationReadTimers.clear();
  };

  const clearNotificationDetailContext = () => {
    sourceNotification.value = null;
    pendingNotificationRead.value = null;
    clearNotificationReadTimers();
  };

  const clearSourceNotification = () => {
    sourceNotification.value = null;
  };

  const markNotificationAsReadFromDashboard = async (notification: DashboardNotification) => {
    clearNotificationReadTimer(getNotificationThreadId(notification));
    return markNotificationAsRead(notification);
  };

  const isPendingNotificationDetailLoaded = (detailKey: string) => {
    if (detailKey === detailState.issueKey.value) {
      return (
        detailState.issueVisible.value &&
        Boolean(toValue(detailState.issueLoaded)) &&
        !detailState.issueLoading.value
      );
    }

    if (detailKey === detailState.pullRequestKey.value) {
      return (
        detailState.pullRequestVisible.value &&
        Boolean(toValue(detailState.pullRequestLoaded)) &&
        !detailState.pullRequestLoading.value
      );
    }

    if (detailKey === detailState.discussionKey.value) {
      return (
        detailState.discussionVisible.value &&
        Boolean(toValue(detailState.discussionLoaded)) &&
        !detailState.discussionLoading.value
      );
    }

    if (detailKey === detailState.releaseKey.value) {
      return (
        detailState.releaseVisible.value &&
        Boolean(toValue(detailState.releaseLoaded)) &&
        !detailState.releaseLoading.value
      );
    }

    return false;
  };

  const scheduleNotificationReadTimer = (notification: DashboardNotification) => {
    const threadId = getNotificationThreadId(notification);
    clearNotificationReadTimer(threadId);

    const timer = setTimeout(() => {
      notificationReadTimers.delete(threadId);
      void markNotificationAsReadFromDashboard(notification);
    }, notificationReadMarkDelayMs.value);

    notificationReadTimers.set(threadId, timer);
  };

  const schedulePendingNotificationReadIfReady = () => {
    const pending = pendingNotificationRead.value;
    const mode = notificationReadMarkMode.value;
    if (!pending || mode === 'manual') return;

    if (!isPendingNotificationDetailLoaded(pending.detailKey)) return;

    pendingNotificationRead.value = null;
    if (mode === 'immediate') {
      void markNotificationAsReadFromDashboard(pending.notification);
      return;
    }

    scheduleNotificationReadTimer(pending.notification);
  };

  const handleNotificationAutoRead = (notification: DashboardNotification) => {
    if (!notification.unread) return;

    if (notificationReadMarkMode.value === 'manual') {
      pendingNotificationRead.value = null;
      return;
    }

    const details = getNotificationDetails(notification);
    if (!details) return;

    pendingNotificationRead.value = {
      notification,
      detailKey: buildNotificationDetailKey(details),
    };
    schedulePendingNotificationReadIfReady();
  };

  const setSourceNotificationForDetail = (notification: DashboardNotification) => {
    const detailKey = getNotificationSourceDetailKey(notification);
    if (!detailKey) {
      clearNotificationDetailContext();
      return false;
    }

    if (detailKey !== currentVisibleDetailKey.value) {
      pendingNotificationRead.value = null;
      clearNotificationReadTimers();
    }

    sourceNotification.value = notification;
    return true;
  };

  const handleNotificationDetailOpen = (notification: DashboardNotification) => {
    const hasDetailTarget = setSourceNotificationForDetail(notification);
    openNotification(notification);
    if (hasDetailTarget) {
      handleNotificationAutoRead(notification);
    }
  };

  watch(
    [
      pendingNotificationRead,
      detailState.issueKey,
      detailState.pullRequestKey,
      detailState.discussionKey,
      detailState.releaseKey,
      detailState.issueLoading,
      detailState.pullRequestLoading,
      detailState.discussionLoading,
      detailState.releaseLoading,
      () => toValue(detailState.issueLoaded),
      () => toValue(detailState.pullRequestLoaded),
      () => toValue(detailState.discussionLoaded),
      () => toValue(detailState.releaseLoaded),
    ],
    schedulePendingNotificationReadIfReady,
    { flush: 'post' }
  );

  watch(notificationReadMarkMode, (mode) => {
    if (mode === 'manual') {
      pendingNotificationRead.value = null;
      clearNotificationReadTimers();
      return;
    }

    if (mode === 'immediate') {
      clearNotificationReadTimers();
    }

    schedulePendingNotificationReadIfReady();
  });

  watch(currentVisibleDetailKey, (detailKey) => {
    if (!detailKey) {
      clearNotificationDetailContext();
      return;
    }

    const notification = sourceNotification.value;
    if (notification && getNotificationSourceDetailKey(notification) !== detailKey) {
      sourceNotification.value = null;
    }

    const pending = pendingNotificationRead.value;
    if (pending && pending.detailKey !== detailKey) {
      pendingNotificationRead.value = null;
    }
  });

  if (componentInstance) {
    onBeforeUnmount(() => {
      clearNotificationReadTimers();
    });
  }

  return {
    visibleSourceNotification,
    markNotificationAsReadFromDashboard,
    handleNotificationOpen: handleNotificationDetailOpen,
    handleTodoOpen: handleNotificationDetailOpen,
    clearSourceNotification,
    clearNotificationDetailContext,
  };
}
