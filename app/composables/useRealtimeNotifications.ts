import { onUnmounted, ref } from 'vue';

interface DashboardNotification {
  id?: number | string;
  [key: string]: unknown;
}

interface UseRealtimeNotificationsOptions {
  intervalMs?: number;
  page?: number;
}

interface RealtimeNotificationsEvents {
  onNewNotifications: (notifications: DashboardNotification[]) => void;
}

const DEFAULT_INTERVAL_MS = 60_000;

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { intervalMs = DEFAULT_INTERVAL_MS, page = 1 } = options;

  const { fetchNotifications, notifications } = useGithubData();

  const isPolling = ref(false);
  const hasInitialized = ref(false);
  const previousNotificationIds = ref<Set<string>>(new Set());
  const listeners = ref<Set<RealtimeNotificationsEvents['onNewNotifications']>>(new Set());

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const toNotificationId = (notification: DashboardNotification, fallbackIndex: number) => {
    if (notification.id === undefined || notification.id === null) {
      return `fallback-${fallbackIndex}`;
    }

    return String(notification.id);
  };

  const emitNewNotifications = (newNotifications: DashboardNotification[]) => {
    if (newNotifications.length === 0) return;

    for (const listener of listeners.value) {
      listener(newNotifications);
    }
  };

  const captureNotificationIds = (items: DashboardNotification[]) => {
    return new Set(items.map((item, index) => toNotificationId(item, index)));
  };

  const poll = async () => {
    await fetchNotifications(page, { force: true });

    const currentNotifications = notifications.value as DashboardNotification[];
    const currentIds = captureNotificationIds(currentNotifications);

    if (!hasInitialized.value) {
      previousNotificationIds.value = currentIds;
      hasInitialized.value = true;
      return;
    }

    const newNotifications = currentNotifications.filter((item, index) => {
      const id = toNotificationId(item, index);
      return !previousNotificationIds.value.has(id);
    });

    if (newNotifications.length > 0) {
      emitNewNotifications(newNotifications);
    }

    previousNotificationIds.value = currentIds;
  };

  const start = async () => {
    if (isPolling.value) return;

    isPolling.value = true;
    await poll();
    intervalId = setInterval(poll, intervalMs);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    isPolling.value = false;
  };

  const onNewNotifications = (callback: RealtimeNotificationsEvents['onNewNotifications']) => {
    listeners.value.add(callback);

    return () => {
      listeners.value.delete(callback);
    };
  };

  onUnmounted(() => {
    stop();
    listeners.value.clear();
  });

  return {
    isPolling,
    start,
    stop,
    onNewNotifications,
  };
}
