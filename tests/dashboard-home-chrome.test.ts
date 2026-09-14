import { describe, expect, test } from 'bun:test';

import {
  reduceDashboardHomeChromeOpenState,
  resolveDashboardHomeChrome,
  type DashboardHomeChromeEvent,
  type DashboardHomeChromeInput,
  type DashboardHomeChromeOpenState,
  type DashboardHomeChromePresentation,
} from '../shared/utils/dashboard-home-chrome';

const closedMenus = {
  dashboardMenuOpen: false,
  accountMenuOpen: false,
} as const;

const wideListInput = {
  viewportWidth: 861,
  ...closedMenus,
  hasCustomSubtitle: false,
  supportsDashboardFilterButton: true,
  isReleaseTimeline: false,
} satisfies DashboardHomeChromeInput;

const narrowListInput = {
  ...wideListInput,
  viewportWidth: 860,
} satisfies DashboardHomeChromeInput;

const wideListChrome = {
  mode: 'wide',
  showNavbar: true,
  showActivityBar: true,
  showTabSidebar: true,
  showWidgets: true,
  showListTitleRow: true,
  showCustomSubtitle: false,
  showFilterPills: true,
  showTopBar: false,
  showTopBarFilterButton: false,
  showFloatingRefresh: true,
  showTopBarRefresh: false,
  dashboardMenuMayBeOpen: false,
  accountMenuMayBeOpen: false,
} satisfies DashboardHomeChromePresentation;

const narrowListChrome = {
  mode: 'narrow',
  showNavbar: false,
  showActivityBar: false,
  showTabSidebar: false,
  showWidgets: false,
  showListTitleRow: false,
  showCustomSubtitle: false,
  showFilterPills: false,
  showTopBar: true,
  showTopBarFilterButton: true,
  showFloatingRefresh: false,
  showTopBarRefresh: true,
  dashboardMenuMayBeOpen: false,
  accountMenuMayBeOpen: false,
} satisfies DashboardHomeChromePresentation;

describe('dashboard home chrome presentation', () => {
  test.each([
    {
      name: 'wide list at 861px',
      input: wideListInput,
      chrome: wideListChrome,
    },
    {
      name: 'narrow list at the 860px breakpoint',
      input: narrowListInput,
      chrome: narrowListChrome,
    },
    {
      name: 'narrow list on a 375px phone',
      input: { ...narrowListInput, viewportWidth: 375 },
      chrome: narrowListChrome,
    },
    {
      name: 'narrow list on a 430px phone',
      input: { ...narrowListInput, viewportWidth: 430 },
      chrome: narrowListChrome,
    },
    {
      name: 'narrow list on a 768px tablet',
      input: { ...narrowListInput, viewportWidth: 768 },
      chrome: narrowListChrome,
    },
    {
      name: 'wide list on a landscape phone at 932px',
      input: { ...wideListInput, viewportWidth: 932 },
      chrome: wideListChrome,
    },
    {
      name: 'wide custom tab keeps its subtitle',
      input: { ...wideListInput, hasCustomSubtitle: true },
      chrome: { ...wideListChrome, showCustomSubtitle: true },
    },
    {
      name: 'narrow custom tab omits the subtitle',
      input: { ...narrowListInput, hasCustomSubtitle: true },
      chrome: narrowListChrome,
    },
    {
      name: 'wide tab without dashboard filters keeps the list chrome',
      input: { ...wideListInput, supportsDashboardFilterButton: false },
      chrome: wideListChrome,
    },
    {
      name: 'narrow tab without dashboard filters omits the top-bar filter',
      input: { ...narrowListInput, supportsDashboardFilterButton: false },
      chrome: { ...narrowListChrome, showTopBarFilterButton: false },
    },
    {
      name: 'wide Release Timeline keeps the Activity Bar and hides side columns',
      input: { ...wideListInput, isReleaseTimeline: true, supportsDashboardFilterButton: false },
      chrome: {
        ...wideListChrome,
        showTabSidebar: false,
        showWidgets: false,
        showFloatingRefresh: false,
      },
    },
    {
      name: 'narrow Release Timeline uses the same top bar as other tabs',
      input: { ...narrowListInput, isReleaseTimeline: true, supportsDashboardFilterButton: false },
      chrome: { ...narrowListChrome, showTopBarFilterButton: false },
    },
    {
      name: 'wide chrome ignores leftover open menus',
      input: {
        ...wideListInput,
        dashboardMenuOpen: true,
        accountMenuOpen: true,
      },
      chrome: wideListChrome,
    },
    {
      name: 'narrow chrome may show the Dashboard Menu when it is open',
      input: { ...narrowListInput, dashboardMenuOpen: true },
      chrome: { ...narrowListChrome, dashboardMenuMayBeOpen: true },
    },
    {
      name: 'narrow chrome may show the account menu when it is open',
      input: { ...narrowListInput, accountMenuOpen: true },
      chrome: { ...narrowListChrome, accountMenuMayBeOpen: true },
    },
  ])('$name', ({ input, chrome }) => {
    expect(resolveDashboardHomeChrome(input)).toEqual(chrome);
  });
});

describe('dashboard home chrome open-state', () => {
  const closed: DashboardHomeChromeOpenState = {
    dashboardMenuOpen: false,
    accountMenuOpen: false,
  };
  const dashboardMenuOpen: DashboardHomeChromeOpenState = {
    dashboardMenuOpen: true,
    accountMenuOpen: false,
  };
  const accountMenuOpen: DashboardHomeChromeOpenState = {
    dashboardMenuOpen: false,
    accountMenuOpen: true,
  };

  test.each([
    {
      name: 'opens the Dashboard Menu from closed',
      state: closed,
      event: { type: 'open-dashboard-menu' } satisfies DashboardHomeChromeEvent,
      next: dashboardMenuOpen,
    },
    {
      name: 'opens the Dashboard Menu and closes the account menu',
      state: accountMenuOpen,
      event: { type: 'open-dashboard-menu' } satisfies DashboardHomeChromeEvent,
      next: dashboardMenuOpen,
    },
    {
      name: 'toggles the Dashboard Menu open',
      state: closed,
      event: { type: 'toggle-dashboard-menu' } satisfies DashboardHomeChromeEvent,
      next: dashboardMenuOpen,
    },
    {
      name: 'toggles the Dashboard Menu closed',
      state: dashboardMenuOpen,
      event: { type: 'toggle-dashboard-menu' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the Dashboard Menu on a second menu-button press via toggle',
      state: dashboardMenuOpen,
      event: { type: 'toggle-dashboard-menu' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the Dashboard Menu when a destination is selected',
      state: dashboardMenuOpen,
      event: { type: 'select-destination' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the account menu when a destination is selected',
      state: accountMenuOpen,
      event: { type: 'select-destination' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the Dashboard Menu on scrim',
      state: dashboardMenuOpen,
      event: { type: 'scrim' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the Dashboard Menu on Escape',
      state: dashboardMenuOpen,
      event: { type: 'escape' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'opens the account menu from closed',
      state: closed,
      event: { type: 'open-account-menu' } satisfies DashboardHomeChromeEvent,
      next: accountMenuOpen,
    },
    {
      name: 'opens the account menu and closes the Dashboard Menu',
      state: dashboardMenuOpen,
      event: { type: 'open-account-menu' } satisfies DashboardHomeChromeEvent,
      next: accountMenuOpen,
    },
    {
      name: 'toggles the account menu open',
      state: closed,
      event: { type: 'toggle-account-menu' } satisfies DashboardHomeChromeEvent,
      next: accountMenuOpen,
    },
    {
      name: 'toggles the account menu closed',
      state: accountMenuOpen,
      event: { type: 'toggle-account-menu' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the account menu on Escape',
      state: accountMenuOpen,
      event: { type: 'escape' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes the account menu on outside click',
      state: accountMenuOpen,
      event: { type: 'close-account-menu' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'leaves closed menus closed on Escape',
      state: closed,
      event: { type: 'escape' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'closes both menus when crossing to wide',
      state: dashboardMenuOpen,
      event: { type: 'viewport-cross', nextMode: 'wide' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
    {
      name: 'starts with both menus closed when crossing to narrow',
      state: accountMenuOpen,
      event: { type: 'viewport-cross', nextMode: 'narrow' } satisfies DashboardHomeChromeEvent,
      next: closed,
    },
  ])('$name', ({ state, event, next }) => {
    expect(reduceDashboardHomeChromeOpenState(state, event)).toEqual(next);
  });
});
