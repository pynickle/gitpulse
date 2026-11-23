import type { MaybeRefOrGetter } from 'vue';
import { computed, onMounted, shallowRef, toValue, watch } from 'vue';

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

/*
 * Starts at the server's assumption and only narrows after mount: reading the
 * real viewport during setup makes the client's first render disagree with the
 * server's markup, which is a hydration mismatch rather than a late update.
 */
const viewportWidth = shallowRef(DASHBOARD_HOME_NARROW_MAX_WIDTH + 1);
const openState = shallowRef<DashboardHomeChromeOpenState>({
  dashboardMenuOpen: false,
  accountMenuOpen: false,
});

const syncViewport = () => {
  viewportWidth.value = readViewportWidth();
};

/* Listeners are registered once for the whole client, from any consumer's mount. */
let viewportListenersAttached = false;
const attachViewportListeners = () => {
  if (viewportListenersAttached) return;
  viewportListenersAttached = true;

  const media = window.matchMedia(`(max-width: ${DASHBOARD_HOME_NARROW_MAX_WIDTH}px)`);
  media.addEventListener('change', syncViewport);
};

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

  /*
   * The real viewport is read after hydration, so the first client render
   * matches the server markup exactly and the responsive chrome settles on the
   * next tick instead of tearing.
   */
  onMounted(() => {
    syncViewport();
    attachViewportListeners();
  });

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
