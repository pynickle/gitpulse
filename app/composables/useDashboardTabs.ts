import { ref } from 'vue';

export type DashboardTab = 'notifications' | 'issues' | 'pulls' | 'repos';

interface DashboardTabFetchers {
  fetchNotifications: (page?: number, options?: { force?: boolean }) => Promise<void>;
  fetchIssues: (page?: number, options?: { force?: boolean }) => Promise<void>;
  fetchPulls: (page?: number, options?: { force?: boolean }) => Promise<void>;
  fetchRepos: (page?: number, options?: { force?: boolean }) => Promise<void>;
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

  const tabRefreshers: Record<
    DashboardTab,
    (page?: number, options?: { force?: boolean }) => Promise<void>
  > = {
    notifications: fetchNotifications,
    issues: fetchIssues,
    pulls: fetchPulls,
    repos: fetchRepos,
  };

  const refreshCurrentTab = async (page?: number, options?: { force?: boolean }) => {
    await tabRefreshers[currentTab.value](page, options);
  };

  const switchTab = async (tab: DashboardTab, page?: number, options?: { force?: boolean }) => {
    currentTab.value = tab;
    await refreshCurrentTab(page, options);
  };

  return {
    currentTab,
    refreshCurrentTab,
    switchTab,
  };
}
