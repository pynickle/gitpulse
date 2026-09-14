import type { MaybeRefOrGetter } from 'vue';
import { computed, shallowRef, toValue, watch } from 'vue';

import {
  DASHBOARD_HOME_NARROW_MAX_WIDTH,
  reduceDashboardHomeChromeOpenState,
  resolveDashboardHomeChrome,
  type DashboardHomeChromeEvent,
  type DashboardHomeChromeOpenState,
} from '#shared/utils/dashboard-home-chrome';

const readViewportWidth = () => {
  if (!import.meta.client) {
    return DASHBOARD_HOME_NARROW_MAX_WIDTH + 1;
  }

  return window.matchMedia(`(max-width: ${DASHBOARD_HOME_NARROW_MAX_WIDTH}px)`).matches
    ? DASHBOARD_HOME_NARROW_MAX_WIDTH
    : DASHBOARD_HOME_NARROW_MAX_WIDTH + 1;
};

const viewportWidth = shallowRef(readViewportWidth());
const openState = shallowRef<DashboardHomeChromeOpenState>({
  dashboardMenuOpen: false,
  accountMenuOpen: false,
});

if (import.meta.client) {
  const media = window.matchMedia(`(max-width: ${DASHBOARD_HOME_NARROW_MAX_WIDTH}px)`);
  const syncViewport = () => {
    viewportWidth.value = media.matches
      ? DASHBOARD_HOME_NARROW_MAX_WIDTH
      : DASHBOARD_HOME_NARROW_MAX_WIDTH + 1;
  };

  syncViewport();
  media.addEventListener('change', syncViewport);
}

export function useDashboardHomeChrome(options?: {
  hasCustomSubtitle?: MaybeRefOrGetter<boolean>;
  supportsDashboardFilterButton?: MaybeRefOrGetter<boolean>;
  isReleaseTimeline?: MaybeRefOrGetter<boolean>;
}) {
  const presentation = computed(() =>
    resolveDashboardHomeChrome({
      viewportWidth: viewportWidth.value,
      dashboardMenuOpen: openState.value.dashboardMenuOpen,
      accountMenuOpen: openState.value.accountMenuOpen,
      hasCustomSubtitle: options?.hasCustomSubtitle ? toValue(options.hasCustomSubtitle) : false,
      supportsDashboardFilterButton: options?.supportsDashboardFilterButton
        ? toValue(options.supportsDashboardFilterButton)
        : false,
      isReleaseTimeline: options?.isReleaseTimeline ? toValue(options.isReleaseTimeline) : false,
    })
  );

  const dispatch = (event: DashboardHomeChromeEvent) => {
    openState.value = reduceDashboardHomeChromeOpenState(openState.value, event);
  };

  watch(
    () => presentation.value.mode,
    (mode, previousMode) => {
      if (previousMode && mode !== previousMode) {
        dispatch({ type: 'viewport-cross', nextMode: mode });
      }
    }
  );

  return {
    presentation,
    dispatch,
  };
}
