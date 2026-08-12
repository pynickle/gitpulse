import { computed } from 'vue';

import type { DashboardNavigationEntry } from '../utils/dashboardUrlNavigationUtils';
import {
  applyLogicalNavigationEvent,
  createLogicalNavigationState,
  getLogicalNavigationSnapshot,
  type LogicalNavigationEvent,
  type LogicalNavigationResult,
  type LogicalNavigationState,
} from '../utils/navigationEntryRouting';

export type NavigationEntry = DashboardNavigationEntry;

/**
 * Vue adapter around Logical Navigation. The stack lives in the pure module;
 * this composable only persists `LogicalNavigationState` and exposes queries.
 */
export function useNavigationHistory() {
  const state = useState<LogicalNavigationState>(
    'gitpulse-logical-navigation',
    createLogicalNavigationState
  );

  const snapshot = computed(() => getLogicalNavigationSnapshot(state.value));

  const applyEvent = (event: LogicalNavigationEvent): LogicalNavigationResult => {
    const result = applyLogicalNavigationEvent(state.value, event);
    state.value = result.state;
    return result;
  };

  return {
    navigationHistory: computed(() => snapshot.value.history),
    currentEntry: computed(() => snapshot.value.current),
    previousEntry: computed(() => snapshot.value.previousEntry),
    canGoBack: computed(() => snapshot.value.canGoBack),
    shouldShowHomeButton: computed(() => snapshot.value.shouldShowHomeButton),
    applyEvent,
  };
}
