export const DASHBOARD_HOME_NARROW_MAX_WIDTH = 860;

export type DashboardHomeChromeMode = 'wide' | 'narrow';

export interface DashboardHomeChromeInput {
  viewportWidth: number;
  dashboardMenuOpen: boolean;
  accountMenuOpen: boolean;
  hasCustomSubtitle: boolean;
  supportsDashboardFilterButton: boolean;
  isReleaseTimeline: boolean;
}

export interface DashboardHomeChromePresentation {
  mode: DashboardHomeChromeMode;
  showNavbar: boolean;
  showActivityBar: boolean;
  showTabSidebar: boolean;
  showWidgets: boolean;
  showListTitleRow: boolean;
  showCustomSubtitle: boolean;
  showFilterPills: boolean;
  showTopBar: boolean;
  showTopBarFilterButton: boolean;
  showFloatingRefresh: boolean;
  showTopBarRefresh: boolean;
  dashboardMenuMayBeOpen: boolean;
  accountMenuMayBeOpen: boolean;
}

export interface DashboardHomeChromeOpenState {
  dashboardMenuOpen: boolean;
  accountMenuOpen: boolean;
}

export type DashboardHomeChromeEvent =
  | { type: 'open-dashboard-menu' }
  | { type: 'close-dashboard-menu' }
  | { type: 'toggle-dashboard-menu' }
  | { type: 'select-destination' }
  | { type: 'scrim' }
  | { type: 'open-account-menu' }
  | { type: 'close-account-menu' }
  | { type: 'toggle-account-menu' }
  | { type: 'escape' }
  | { type: 'viewport-cross'; nextMode: DashboardHomeChromeMode };

const closedOpenState: DashboardHomeChromeOpenState = {
  dashboardMenuOpen: false,
  accountMenuOpen: false,
};

export function isDashboardHomeNarrowViewport(viewportWidth: number) {
  return viewportWidth <= DASHBOARD_HOME_NARROW_MAX_WIDTH;
}

export function resolveDashboardHomeChrome(
  input: DashboardHomeChromeInput
): DashboardHomeChromePresentation {
  if (!isDashboardHomeNarrowViewport(input.viewportWidth)) {
    return {
      mode: 'wide',
      showNavbar: true,
      showActivityBar: true,
      showTabSidebar: !input.isReleaseTimeline,
      showWidgets: !input.isReleaseTimeline,
      showListTitleRow: true,
      showCustomSubtitle: input.hasCustomSubtitle,
      showFilterPills: true,
      showTopBar: false,
      showTopBarFilterButton: false,
      showFloatingRefresh: !input.isReleaseTimeline,
      showTopBarRefresh: false,
      dashboardMenuMayBeOpen: false,
      accountMenuMayBeOpen: false,
    };
  }

  return {
    mode: 'narrow',
    showNavbar: false,
    showActivityBar: false,
    showTabSidebar: false,
    showWidgets: false,
    showListTitleRow: false,
    showCustomSubtitle: false,
    showFilterPills: false,
    showTopBar: true,
    showTopBarFilterButton: input.supportsDashboardFilterButton,
    showFloatingRefresh: false,
    showTopBarRefresh: true,
    dashboardMenuMayBeOpen: input.dashboardMenuOpen,
    accountMenuMayBeOpen: input.accountMenuOpen,
  };
}

export function reduceDashboardHomeChromeOpenState(
  state: DashboardHomeChromeOpenState,
  event: DashboardHomeChromeEvent
): DashboardHomeChromeOpenState {
  switch (event.type) {
    case 'open-dashboard-menu':
      return { dashboardMenuOpen: true, accountMenuOpen: false };
    case 'close-dashboard-menu':
    case 'scrim':
      return { ...state, dashboardMenuOpen: false };
    case 'select-destination':
      return closedOpenState;
    case 'toggle-dashboard-menu':
      return state.dashboardMenuOpen
        ? closedOpenState
        : { dashboardMenuOpen: true, accountMenuOpen: false };
    case 'open-account-menu':
      return { dashboardMenuOpen: false, accountMenuOpen: true };
    case 'close-account-menu':
      return { ...state, accountMenuOpen: false };
    case 'toggle-account-menu':
      return state.accountMenuOpen
        ? closedOpenState
        : { dashboardMenuOpen: false, accountMenuOpen: true };
    case 'escape':
      if (state.dashboardMenuOpen || state.accountMenuOpen) {
        return closedOpenState;
      }
      return state;
    case 'viewport-cross':
      return closedOpenState;
  }
}
