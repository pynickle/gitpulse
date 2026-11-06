import { computed, shallowRef } from 'vue';

import type { DashboardNotification } from '#shared/types/notifications';
import type { NotificationTodoItem } from '#shared/types/user-settings';
import {
  cloneDashboardNotification,
  cloneNotificationTodos,
  normalizeNotificationTodoItem,
  normalizeNotificationTodos,
} from '#shared/utils/user-settings';

export const getNotificationTodoId = (notification: DashboardNotification) => {
  return String(notification.id);
};

/**
 * What a toggle actually did. `failed` matters: the settings save is optimistic and
 * rolls back silently, so a caller that hid its own control needs to know that the
 * change did not land.
 */
export type NotificationTodoToggleResult = 'added' | 'removed' | 'failed';

const withoutTransientSubjectStatus = (
  notification: DashboardNotification
): DashboardNotification => {
  const status = notification.subject?.stateStatus;
  if (status !== 'pending' && status !== 'error') {
    return cloneDashboardNotification(notification);
  }

  return {
    ...cloneDashboardNotification(notification),
    subject: {
      ...notification.subject,
      stateStatus: undefined,
    },
  };
};

export const createNotificationTodoItem = (
  notification: DashboardNotification,
  addedAt = new Date().toISOString()
) => {
  return normalizeNotificationTodoItem({
    id: getNotificationTodoId(notification),
    addedAt,
    notification: {
      ...withoutTransientSubjectStatus(notification),
      unread: false,
    },
  });
};

export function useNotificationTodos() {
  const { settings, loadSettings, updateSettings } = useUserSettings();
  const subjectEnrichment = useNotificationSubjectEnrichment();
  const refreshError = shallowRef(false);
  const transientNotifications = shallowRef<Record<string, DashboardNotification>>({});

  if (import.meta.client) {
    void loadSettings();
  }

  const todos = computed(() => {
    return cloneNotificationTodos(settings.value.notificationTodos).map((item) => {
      const transientNotification = transientNotifications.value[item.id];
      return {
        ...item,
        notification: transientNotification
          ? cloneDashboardNotification(transientNotification)
          : withoutTransientSubjectStatus(item.notification),
      };
    });
  });
  const refreshing = computed(() => {
    return todos.value.some((item) => item.notification.subject?.stateStatus === 'pending');
  });
  const todoIds = computed(() => new Set(todos.value.map((item) => item.id)));

  const setTodos = async (nextTodos: NotificationTodoItem[]) => {
    const normalizedTodos = normalizeNotificationTodos(
      nextTodos.map((item) => ({
        ...item,
        notification: withoutTransientSubjectStatus(item.notification),
      }))
    );
    const savedSettings = await updateSettings({ notificationTodos: normalizedTodos });

    // The store rolls the optimistic write back on its own; reporting the miss is what
    // lets a caller that replaced a visible control say so.
    if (!savedSettings) {
      return null;
    }

    const persistedIds = new Set(normalizedTodos.map((item) => item.id));
    transientNotifications.value = Object.fromEntries(
      Object.entries(transientNotifications.value).filter(([id]) => persistedIds.has(id))
    );

    return normalizedTodos;
  };

  const showEnrichedNotifications = (
    currentTodos: NotificationTodoItem[],
    notifications: DashboardNotification[]
  ) => {
    transientNotifications.value = {
      ...transientNotifications.value,
      ...Object.fromEntries(
        currentTodos.map((item, index) => [
          item.id,
          cloneDashboardNotification(notifications[index] ?? item.notification),
        ])
      ),
    };
  };

  const isNotificationTodo = (notification: DashboardNotification) => {
    return todoIds.value.has(getNotificationTodoId(notification));
  };

  const addNotificationTodo = async (notification: DashboardNotification) => {
    const todo = createNotificationTodoItem(notification);
    if (!todo) return null;

    const { [todo.id]: _previousTransient, ...remainingTransient } = transientNotifications.value;
    transientNotifications.value = remainingTransient;
    const nextTodos = [todo, ...todos.value.filter((item) => item.id !== todo.id)];
    const savedTodos = await setTodos(nextTodos);
    return savedTodos ? todo : null;
  };

  const removeNotificationTodo = async (id: string) => {
    if (!todoIds.value.has(id)) {
      return false;
    }

    const { [id]: _removedTransient, ...remainingTransient } = transientNotifications.value;
    transientNotifications.value = remainingTransient;
    const savedTodos = await setTodos(todos.value.filter((item) => item.id !== id));
    return savedTodos !== null;
  };

  const toggleNotificationTodo = async (
    notification: DashboardNotification
  ): Promise<NotificationTodoToggleResult> => {
    const todoId = getNotificationTodoId(notification);
    if (todoIds.value.has(todoId)) {
      const removed = await removeNotificationTodo(todoId);
      return removed ? 'removed' : 'failed';
    }

    const added = await addNotificationTodo(notification);
    return added ? 'added' : 'failed';
  };

  const refreshNotificationTodos = async () => {
    refreshError.value = false;

    try {
      await loadSettings();
      const currentTodos = todos.value;
      const run = subjectEnrichment.start(
        currentTodos.map((item) => cloneDashboardNotification(item.notification))
      );
      showEnrichedNotifications(currentTodos, run.notifications);

      const outcome = await run.completion;
      if (outcome.outcome === 'stale') {
        return todos.value;
      }

      showEnrichedNotifications(currentTodos, outcome.notifications);
      refreshError.value = outcome.outcome === 'partial' || outcome.outcome === 'failed';

      const completedById = new Map(
        currentTodos.map((item, index) => [item.id, outcome.notifications[index]])
      );
      const latestStoredTodos = cloneNotificationTodos(settings.value.notificationTodos);
      const nextStoredTodos = latestStoredTodos.map((item) => {
        const completedNotification = completedById.get(item.id);
        const status = completedNotification?.subject?.stateStatus;
        if (!completedNotification || (status !== 'loaded' && status !== 'unavailable')) {
          return item;
        }

        return (
          normalizeNotificationTodoItem({
            ...item,
            notification: completedNotification,
          }) ?? item
        );
      });

      if (JSON.stringify(nextStoredTodos) !== JSON.stringify(latestStoredTodos)) {
        await setTodos(nextStoredTodos);
      }

      return todos.value;
    } catch (error) {
      refreshError.value = true;
      console.error('Failed to refresh notification todos:', error);
      return todos.value;
    }
  };

  return {
    todos,
    todoIds,
    refreshing,
    refreshError,
    isNotificationTodo,
    addNotificationTodo,
    removeNotificationTodo,
    toggleNotificationTodo,
    refreshNotificationTodos,
  };
}
