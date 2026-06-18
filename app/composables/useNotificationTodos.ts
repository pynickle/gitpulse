import type {
  DashboardNotification,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';
import type { NotificationTodoItem } from '#shared/types/user-settings';
import { isNotificationSubjectStateResultLoaded } from '#shared/utils/notifications';
import {
  cloneNotificationTodos,
  normalizeDashboardNotification,
  normalizeNotificationTodoItem,
  normalizeNotificationTodos,
} from '#shared/utils/user-settings';
import parseGitHubNotificationSubjectTarget, {
  toNotificationSubjectStateTarget,
} from '~/utils/parseGitHubNotificationSubjectTarget';

const notificationTodoSubjectStateChunkSize = 50;

export const getNotificationTodoId = (notification: DashboardNotification) => {
  return String(notification.id);
};

export const createNotificationTodoItem = (
  notification: DashboardNotification,
  addedAt = new Date().toISOString()
) => {
  return normalizeNotificationTodoItem({
    id: getNotificationTodoId(notification),
    addedAt,
    notification: {
      ...notification,
      unread: false,
    },
  });
};

export const collectNotificationTodoSubjectStateTargets = (items: NotificationTodoItem[]) => {
  const targetsByKey = new Map<string, NotificationSubjectStateTarget>();

  for (const item of items) {
    const target = parseGitHubNotificationSubjectTarget(item.notification.subject);
    const subjectStateTarget = target ? toNotificationSubjectStateTarget(target) : null;
    if (subjectStateTarget) {
      targetsByKey.set(subjectStateTarget.key, subjectStateTarget);
    }
  }

  return Array.from(targetsByKey.values());
};

const chunkItems = <T>(items: T[], chunkSize: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const toSubjectStateTarget = (notification: DashboardNotification) => {
  const target = parseGitHubNotificationSubjectTarget(notification.subject);
  return target ? toNotificationSubjectStateTarget(target) : null;
};

const applyNotificationTodoState = (
  item: NotificationTodoItem,
  result: NotificationSubjectStateResult,
  target: NotificationSubjectStateTarget
) => {
  const nextNotification = normalizeDashboardNotification({
    ...item.notification,
    unread: false,
    updated_at: result.updatedAt ?? item.notification.updated_at,
    subject: item.notification.subject
      ? {
          ...item.notification.subject,
          title: result.title ?? item.notification.subject.title,
          state: result.state,
          isAnswered: result.isAnswered,
          labels: result.labels,
          authorLogin: result.authorLogin,
          authorAvatarUrl: result.authorAvatarUrl,
          stateStatus: isNotificationSubjectStateResultLoaded(target, result) ? 'loaded' : 'error',
        }
      : item.notification.subject,
  });

  return normalizeNotificationTodoItem({
    ...item,
    notification: nextNotification ?? item.notification,
  });
};

export const applyNotificationTodoSubjectStates = (
  items: NotificationTodoItem[],
  states: NotificationSubjectStateResult[]
) => {
  if (items.length === 0 || states.length === 0) {
    return items;
  }

  const statesByKey = new Map(states.map((state) => [state.key, state]));
  let changed = false;
  const nextItems = items.map((item) => {
    const target = toSubjectStateTarget(item.notification);
    const result = target ? statesByKey.get(target.key) : undefined;
    if (!target || !result) return item;

    const nextItem = applyNotificationTodoState(item, result, target);
    if (!nextItem) return item;

    if (JSON.stringify(nextItem) !== JSON.stringify(item)) {
      changed = true;
    }

    return nextItem;
  });

  return changed ? nextItems : items;
};

export function useNotificationTodos() {
  const { settings, loadSettings, updateSettings } = useUserSettings();
  const apiFetch = useGitPulseApiFetch();
  const refreshing = shallowRef(false);
  const refreshError = shallowRef<string | null>(null);

  if (import.meta.client) {
    void loadSettings();
  }

  const todos = computed(() => cloneNotificationTodos(settings.value.notificationTodos));
  const todoIds = computed(() => new Set(todos.value.map((item) => item.id)));

  const setTodos = async (nextTodos: NotificationTodoItem[]) => {
    const normalizedTodos = normalizeNotificationTodos(nextTodos);
    await updateSettings({ notificationTodos: normalizedTodos });
    return normalizedTodos;
  };

  const isNotificationTodo = (notification: DashboardNotification) => {
    return todoIds.value.has(getNotificationTodoId(notification));
  };

  const addNotificationTodo = async (notification: DashboardNotification) => {
    const todo = createNotificationTodoItem(notification);
    if (!todo) return null;

    const nextTodos = [todo, ...todos.value.filter((item) => item.id !== todo.id)];
    await setTodos(nextTodos);
    return todo;
  };

  const removeNotificationTodo = async (id: string) => {
    if (!todoIds.value.has(id)) {
      return false;
    }

    await setTodos(todos.value.filter((item) => item.id !== id));
    return true;
  };

  const toggleNotificationTodo = async (notification: DashboardNotification) => {
    const todoId = getNotificationTodoId(notification);
    if (todoIds.value.has(todoId)) {
      await removeNotificationTodo(todoId);
      return false;
    }

    await addNotificationTodo(notification);
    return true;
  };

  const refreshNotificationTodos = async () => {
    const currentTodos = todos.value;
    const targets = collectNotificationTodoSubjectStateTargets(currentTodos);
    refreshError.value = null;

    if (targets.length === 0) {
      return currentTodos;
    }

    refreshing.value = true;

    try {
      const responses = await Promise.all(
        chunkItems(targets, notificationTodoSubjectStateChunkSize).map((chunk) =>
          apiFetch<{ items: NotificationSubjectStateResult[] }>(
            '/api/notifications/subject-states',
            {
              method: 'POST',
              body: { targets: chunk },
            }
          )
        )
      );
      const nextTodos = applyNotificationTodoSubjectStates(
        currentTodos,
        responses.flatMap((response) => response.items)
      );

      if (nextTodos !== currentTodos) {
        await setTodos(nextTodos);
      }

      return nextTodos;
    } catch (error) {
      refreshError.value = error instanceof Error ? error.message : 'Unable to refresh todos.';
      console.error('Failed to refresh notification todos:', error);
      return currentTodos;
    } finally {
      refreshing.value = false;
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
