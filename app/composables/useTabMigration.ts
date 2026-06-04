import { BellIcon, BookMarkedIcon, CircleDotIcon, GitPullRequestIcon } from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed, ref } from 'vue';

import type { DashboardTab } from '~/composables/useDashboardTabs';
import { BUILTIN_TAB_GROUP_ID } from '~/composables/useTabGroups';

export interface MigratedTabGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface TabItem {
  id: string;
  groupId: string;
  name: string;
  icon: Component;
  badgeCount?: number;
}

const DEFAULT_GROUPS: MigratedTabGroup[] = [
  { id: BUILTIN_TAB_GROUP_ID, name: 'Built-in Views', collapsed: false },
];

const DEFAULT_TABS: TabItem[] = [
  { id: 'notifications', groupId: BUILTIN_TAB_GROUP_ID, name: 'Notifications', icon: BellIcon },
  { id: 'issues', groupId: BUILTIN_TAB_GROUP_ID, name: 'Issues', icon: CircleDotIcon },
  { id: 'pulls', groupId: BUILTIN_TAB_GROUP_ID, name: 'Pull Requests', icon: GitPullRequestIcon },
  { id: 'repos', groupId: BUILTIN_TAB_GROUP_ID, name: 'Repositories', icon: BookMarkedIcon },
];

const DASHBOARD_TABS: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];

export interface UseTabMigrationOptions {
  initialTab?: DashboardTab;
  groups?: MigratedTabGroup[];
  tabs?: TabItem[];
}

const isDashboardTab = (value: string): value is DashboardTab => {
  return DASHBOARD_TABS.includes(value as DashboardTab);
};

const cloneGroups = (groups: MigratedTabGroup[]) => {
  return groups.map((group) => ({ ...group }));
};

const cloneTabs = (tabs: TabItem[]) => {
  return tabs.map((tab) => ({ ...tab }));
};

export function useTabMigration(options: UseTabMigrationOptions = {}) {
  const {
    initialTab = 'notifications',
    groups: inputGroups = DEFAULT_GROUPS,
    tabs: inputTabs = DEFAULT_TABS,
  } = options;

  const groups = ref<MigratedTabGroup[]>(cloneGroups(inputGroups));
  const tabs = ref<TabItem[]>(cloneTabs(inputTabs));
  const activeTabId = ref<string>(initialTab);

  const currentTab = computed<DashboardTab>(() => {
    if (isDashboardTab(activeTabId.value)) {
      return activeTabId.value;
    }

    return 'notifications';
  });

  const getTabsForGroup = (groupId: string) => {
    return tabs.value.filter((tab) => tab.groupId === groupId);
  };

  const toTabItem = (tab: DashboardTab) => {
    return tabs.value.find((item) => item.id === tab);
  };

  const toDashboardTab = (tabId: string): DashboardTab => {
    return isDashboardTab(tabId) ? tabId : 'notifications';
  };

  const setActiveTabId = (tabId: string) => {
    activeTabId.value = tabId;
  };

  const setCurrentTab = (tab: DashboardTab) => {
    activeTabId.value = tab;
  };

  const selectTab = (tabId: string) => {
    setActiveTabId(tabId);
    return toDashboardTab(tabId);
  };

  const switchTab = (tab: DashboardTab) => {
    setCurrentTab(tab);
    return tab;
  };

  const toggleGroup = (groupId: string) => {
    groups.value = groups.value.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      return {
        ...group,
        collapsed: !group.collapsed,
      };
    });
  };

  const setBadgeCount = (tabId: string, badgeCount?: number) => {
    const tab = tabs.value.find((item) => item.id === tabId);
    if (!tab || tab.badgeCount === badgeCount) {
      return;
    }

    tab.badgeCount = badgeCount;
  };

  return {
    groups,
    tabs,
    activeTabId,
    currentTab,
    getTabsForGroup,
    toTabItem,
    toDashboardTab,
    setActiveTabId,
    setCurrentTab,
    selectTab,
    switchTab,
    toggleGroup,
    setBadgeCount,
  };
}
