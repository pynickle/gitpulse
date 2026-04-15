import { ref } from 'vue';

export type DashboardTab = 'notifications' | 'issues' | 'pulls' | 'repos';

interface DashboardTabFetchers {
  fetchNotifications: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  fetchPulls: () => Promise<void>;
  fetchRepos: () => Promise<void>;
  initialTab?: DashboardTab;
}

export function useDashboardTabs({
  fetchNotifications,
  fetchIssues,
  fetchPulls,
  fetchRepos,
  initialTab = 'notifications',
}: DashboardTabFetchers) {
  const currentTab = ref<DashboardTab>(initialTab);

  const tabRefreshers: Record<DashboardTab, () => Promise<void>> = {
    notifications: fetchNotifications,
    issues: fetchIssues,
    pulls: fetchPulls,
    repos: fetchRepos,
  };

  const refreshCurrentTab = async () => {
    await tabRefreshers[currentTab.value]();
  };

  const switchTab = async (tab: DashboardTab) => {
    currentTab.value = tab;
    await refreshCurrentTab();
  };

  return {
    currentTab,
    refreshCurrentTab,
    switchTab,
  };
}
