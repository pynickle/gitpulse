import { computed } from 'vue';

import type { DashboardNavigationEntry } from '../utils/dashboardUrlNavigationUtils';
import {
  applyNavigationHistoryChange,
  type NavigationHistoryChange,
} from '../utils/navigationEntryRouting';

export type NavigationEntry = DashboardNavigationEntry;
export type PageType = DashboardNavigationEntry['type'];

export type NavigationIntent = 'back' | 'home';

/**
 * Logical navigation history, derived from the route. The stack is maintained
 * exclusively by plugins/navigation-history.client.ts via `applyRouteChange`;
 * `useNavigationRouting` drives logical Back/Home. Everything else only reads.
 */
export function useNavigationHistory() {
  const navigationHistory = useState<NavigationEntry[]>('gitpulse-navigation-history', () => []);
  const currentEntry = useState<NavigationEntry | null>('gitpulse-navigation-current', () => null);
  const pendingIntent = useState<NavigationIntent | null>('gitpulse-navigation-intent', () => null);

  const hasHistory = computed(() => navigationHistory.value.length > 0);

  const previousEntry = computed(() => {
    if (navigationHistory.value.length > 0) {
      return navigationHistory.value[navigationHistory.value.length - 1];
    }
    return null;
  });

  const canGoBack = computed(() => hasHistory.value);

  const shouldShowHomeButton = computed(() => {
    if (!currentEntry.value) return false;
    if (!hasHistory.value) return false;
    return previousEntry.value?.type !== 'dashboard';
  });

  const applyRouteChange = (entry: NavigationEntry | null, change: NavigationHistoryChange) => {
    const next = applyNavigationHistoryChange(
      { history: navigationHistory.value, current: currentEntry.value },
      entry,
      change
    );
    navigationHistory.value = next.history;
    currentEntry.value = next.current;
  };

  /** Pops the previous entry ahead of a logical Back navigation. */
  const popEntry = () => {
    if (navigationHistory.value.length === 0) {
      currentEntry.value = { type: 'dashboard' };
      return null;
    }

    const previous = navigationHistory.value[navigationHistory.value.length - 1]!;
    navigationHistory.value = navigationHistory.value.slice(0, -1);
    currentEntry.value = previous;
    return previous;
  };

  /** Clears the stack ahead of a logical Home navigation. */
  const resetToHome = () => {
    navigationHistory.value = [];
    currentEntry.value = { type: 'dashboard' };
  };

  const setPendingIntent = (intent: NavigationIntent) => {
    pendingIntent.value = intent;
  };

  const consumePendingIntent = () => {
    const intent = pendingIntent.value;
    pendingIntent.value = null;
    return intent;
  };

  return {
    navigationHistory,
    currentEntry,
    previousEntry,
    canGoBack,
    shouldShowHomeButton,
    applyRouteChange,
    popEntry,
    resetToHome,
    setPendingIntent,
    consumePendingIntent,
  };
}
