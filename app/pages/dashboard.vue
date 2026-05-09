<template>
  <NuxtPage v-if="isDashboardChildRoute" />

  <div v-else class="container is-max-widescreen dashboard-page">
    <DashboardLayout>
      <template #activity-bar>
        <ActivityBar
          :user-avatar="user?.avatar_url"
          :user-name="user?.name"
          :active-group-id="activeTabId"
          :groups="activityGroups"
          @avatar-click="handleAvatarClick"
          @group-select="handleActivityGroupSelect"
          @settings-click="handleSettingsClick"
        />
      </template>

      <template #tab-sidebar>
        <TabSidebar
          :groups="groups"
          :tabs="sidebarTabs"
          :active-tab-id="activeTabId"
          @tab-select="handleSidebarTabSelect"
          @tab-move="handleSidebarTabMove"
          @group-toggle="handleSidebarGroupToggle"
          @new-group="handleNewGroup"
        />
      </template>

      <template #main-content>
        <div class="card dashboard-main-card">
          <div class="dashboard-tabs-header">
            <h2 class="title is-5 dashboard-tab-title">{{ currentTabTitle }}</h2>
            <div class="dashboard-tab-actions">
              <button
                class="button is-ghost is-small dashboard-tab-refresh"
                type="button"
                :aria-label="t('dashboard.actions.refreshCurrentTab')"
                :title="t('dashboard.actions.refreshCurrentTab')"
                @click="refreshCurrentTabSafely"
              >
                <RefreshCwIcon v-once :size="18" class="dashboard-tab-refresh__icon" />
              </button>
            </div>
          </div>

          <div class="card-content dashboard-list-card-content">
            <DashboardLoadingList v-if="loading" :current-tab="currentTab" />

            <div v-else-if="error" class="notification is-danger" style="min-height: 500px">
              <p>{{ error }}</p>
            </div>

            <div
              v-else
              :class="[
                'dashboard-list-shell',
                { 'dashboard-list-shell--without-pagination': !showPagination },
              ]"
            >
              <div
                v-if="showPagination"
                class="dashboard-pagination-wrapper dashboard-pagination-wrapper--top"
              >
                <DashboardPagination :pagination="currentPagination" @change="goToPage" />
              </div>

              <SimpleBar class="dashboard-list-scroll" v-if="currentTab === 'notifications'">
                <div
                  v-for="notification in filteredNotifications"
                  :key="notification.id"
                  class="mb-4 mr-4"
                  @click="openNotification(notification)"
                >
                  <AsyncNotificationItem :notification="notification" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="selectedCustomTab" class="dashboard-list-scroll">
                <div
                  v-for="issue in filteredIssues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openIssue(issue)"
                >
                  <AsyncSearchItem :issue="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'issues'" class="dashboard-list-scroll">
                <div
                  v-for="issue in filteredIssues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openIssue(issue)"
                >
                  <AsyncSearchItem :issue="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'pulls'" class="dashboard-list-scroll">
                <div
                  v-for="pull in filteredPulls"
                  :key="pull.id"
                  class="mb-4 mr-4"
                  @click="openPR(pull)"
                >
                  <AsyncSearchItem :issue="pull" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'repos'" class="dashboard-list-scroll">
                <div v-for="repo in repos" class="mb-4 mr-4" :key="repo.id">
                  <AsyncRepoItem :repo="repo" />
                </div>
              </SimpleBar>
            </div>
          </div>
        </div>
      </template>

      <template #widgets-panel>
        <WidgetsPanel>
          <TabStats :current-tab="currentTab" :stats="currentTabStats" />
          <QuickFilters
            :current-tab="currentTab"
            :filters="currentTabFilters"
            @filter-change="handleFilterChange"
          />
          <QuickActions :current-tab="currentTab" />
        </WidgetsPanel>
      </template>
    </DashboardLayout>
  </div>

  <DetailOverlayHost
    :issue="currentIssue"
    :pull-request="currentPR"
    :issue-error="issueError"
    :is-issue-visible="isIssueDetailVisible"
    :is-pull-request-visible="isPRDetailVisible"
    :issue-detail-key="issueDetailKey"
    :pull-request-detail-key="prDetailKey"
    :loading-issue="loadingIssue"
    :loading-pull-request="loadingPR"
    @back="handleActiveDetailBack"
    @home="handleActiveDetailHome"
    @switch-issue="handleSwitchIssue"
    @switch-pull-request="handleSwitchPR"
  />
</template>

<script setup lang="ts">
import { RefreshCwIcon, SearchIcon } from 'lucide-vue-next';
import { defineAsyncComponent, computed, onMounted, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import ActivityBar from '~/components/dashboard/activity-bar/ActivityBar.vue';
import DashboardLayout from '~/components/dashboard/DashboardLayout.vue';
import DashboardLoadingList from '~/components/dashboard/DashboardLoadingList.vue';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DetailOverlayHost from '~/components/dashboard/DetailOverlayHost.vue';
import TabSidebar from '~/components/dashboard/tab-sidebar/TabSidebar.vue';
import QuickActions from '~/components/dashboard/widgets/QuickActions.vue';
import QuickFilters from '~/components/dashboard/widgets/QuickFilters.vue';
import TabStats from '~/components/dashboard/widgets/TabStats.vue';
import WidgetsPanel from '~/components/dashboard/widgets/WidgetsPanel.vue';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import getQueryParamValue from '~/utils/getQueryParamValue';

const AsyncNotificationItem = defineAsyncComponent(
  () => import('~/components/dashboard/NotificationItem.vue')
);
const AsyncSearchItem = defineAsyncComponent(() => import('~/components/dashboard/SearchItem.vue'));
const AsyncRepoItem = defineAsyncComponent(() => import('~/components/dashboard/RepoItem.vue'));

const { user } = useUserSession();
const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();

const dashboardTabs: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];
const quickFiltersStorageKey = 'gitpulse:dashboard:quick-filters';

const isDashboardChildRoute = computed(() => {
  return !route.path.replace(/\/$/, '').endsWith('/dashboard');
});

type QuickFilterMap = Partial<Record<DashboardTab, Record<string, boolean>>>;

const parseDashboardTab = (value: unknown): DashboardTab => {
  const tab = getQueryParamValue(value);
  return dashboardTabs.includes(tab as DashboardTab) ? (tab as DashboardTab) : 'notifications';
};

const parseDashboardPage = (value: unknown) => {
  const rawValue = getQueryParamValue(value);

  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return 1;
  }

  const parsedPage = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
};

const buildDashboardQuery = (query: LocationQueryRaw) => {
  const nextQuery: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
};

const {
  loading,
  error,
  notifications,
  issues,
  pulls,
  repos,
  pagination,
  stats,
  fetchNotifications,
  fetchIssues,
  fetchPulls,
  fetchRepos,
  fetchCustomTab,
} = useGithubData();

const { customTabs, getCustomTabById, updateCustomTab } = useCustomTabs();

const {
  currentTab: currentBuiltinTab,
  refreshCurrentTab,
  switchTab,
} = useDashboardTabs({
  fetchNotifications,
  fetchIssues,
  fetchPulls,
  fetchRepos,
  initialTab: parseDashboardTab(route.query.tab),
});

const {
  tabs,
  activeTabId,
  toDashboardTab,
  setActiveTabId,
  setCurrentTab,
  selectTab,
  setBadgeCount,
} = useTabMigration({
  initialTab: parseDashboardTab(route.query.tab),
});

const { groups, toggleGroupCollapsed } = useTabGroups();

const selectedCustomTab = computed(() => {
  const tabId = getQueryParamValue(route.query.tab);

  if (!tabId) {
    return null;
  }

  return getCustomTabById(tabId) ?? null;
});

const sidebarTabs = computed(() => {
  const customSidebarTabs = customTabs.value.map((tab) => ({
    id: tab.id,
    groupId: tab.groupId,
    name: tab.name,
    icon: SearchIcon,
  }));

  return [...tabs.value, ...customSidebarTabs];
});

const currentTab = computed<DashboardTab>(() => {
  return selectedCustomTab.value ? 'issues' : currentBuiltinTab.value;
});

const currentTabTitle = computed(() => {
  if (selectedCustomTab.value) return selectedCustomTab.value.name;
  const foundTab = tabs.value.find((t) => t.id === currentTab.value);
  if (foundTab) return foundTab.name;
  // fallback map if translation is needed but not found in tabs
  const tabNames: Record<string, string> = {
    notifications: 'Notifications',
    issues: 'Issues',
    pulls: 'Pull Requests',
    repos: 'Repositories',
  };
  return tabNames[currentTab.value] || currentTab.value;
});

const currentRouteTabId = computed(() => selectedCustomTab.value?.id ?? currentTab.value);

const activityGroups = computed(() => {
  const iconByTab: Record<DashboardTab, string> = {
    notifications: 'bell',
    issues: 'circle-dot',
    pulls: 'git-pull-request',
    repos: 'book-marked',
  };

  return tabs.value.map((tab) => {
    return {
      id: tab.id,
      name: tab.name,
      icon: iconByTab[tab.id as DashboardTab] ?? 'inbox',
    };
  });
});

const currentPage = computed(() => parseDashboardPage(route.query.page));

const currentPagination = computed(() => pagination.value[currentTab.value]);

const showPagination = computed(() => {
  const activePagination = currentPagination.value;
  return activePagination.totalPages !== 1 || activePagination.hasPrev || activePagination.hasNext;
});

const quickFilters = ref<QuickFilterMap>({});

const currentTabFilters = computed(() => {
  return quickFilters.value[currentTab.value] ?? {};
});

// Filtered data based on active filters
const filteredNotifications = computed(() => {
  const filters = currentTabFilters.value;
  const activeFilters = Object.entries(filters)
    .filter(([_, active]) => active)
    .map(([key]) => key);

  // If no filters active, show all
  if (activeFilters.length === 0) {
    return notifications.value;
  }

  return notifications.value.filter((notification) => {
    if (activeFilters.includes('unread') && notification.unread) return true;
    if (activeFilters.includes('read') && !notification.unread) return true;
    return false;
  });
});

const filteredIssues = computed(() => {
  const filters = currentTabFilters.value;
  const activeFilters = Object.entries(filters)
    .filter(([_, active]) => active)
    .map(([key]) => key);

  // If no filters active, show all
  if (activeFilters.length === 0) {
    return issues.value;
  }

  return issues.value.filter((issue) => {
    if (activeFilters.includes('open') && issue.state === 'open') return true;
    if (activeFilters.includes('closed') && issue.state === 'closed') return true;
    return false;
  });
});

const filteredPulls = computed(() => {
  const filters = currentTabFilters.value;
  const activeFilters = Object.entries(filters)
    .filter(([_, active]) => active)
    .map(([key]) => key);

  // If no filters active, show all
  if (activeFilters.length === 0) {
    return pulls.value;
  }

  return pulls.value.filter((pull) => {
    if (activeFilters.includes('open') && pull.state === 'open') return true;
    if (activeFilters.includes('closed') && pull.state === 'closed') return true;
    if (activeFilters.includes('merged') && pull.merged_at) return true;
    return false;
  });
});

const currentTabStats = computed<Record<string, number>>(() => {
  if (currentTab.value === 'notifications') {
    let unread = 0;

    for (const item of notifications.value) {
      if (item.unread) {
        unread += 1;
      }
    }

    const total = notifications.value.length;
    return {
      unread,
      read: Math.max(total - unread, 0),
      total,
    };
  }

  if (currentTab.value === 'pulls') {
    let open = 0;
    let closed = 0;
    let merged = 0;

    for (const item of pulls.value) {
      if (item.state === 'open') {
        open += 1;
      }

      if (item.state === 'closed') {
        closed += 1;
      }

      if (item.merged_at) {
        merged += 1;
      }
    }

    return {
      open,
      closed,
      merged,
      total: pulls.value.length,
    };
  }

  if (currentTab.value === 'issues') {
    let open = 0;
    let closed = 0;

    for (const item of issues.value) {
      if (item.state === 'open') {
        open += 1;
      }

      if (item.state === 'closed') {
        closed += 1;
      }
    }

    return {
      open,
      closed,
      total: issues.value.length,
    };
  }

  return {
    total: repos.value.length,
    open: 0,
    closed: 0,
  };
});

const {
  currentIssue,
  currentPR,
  issueError,
  isIssueDetailVisible,
  isPRDetailVisible,
  issueDetailKey,
  loadingIssue,
  loadingPR,
  openIssue,
  openNotification,
  openPR,
  handleIssueDetailBack,
  handleIssueDetailHome,
  handlePRDetailBack,
  handlePRDetailHome,
  handleSwitchIssue,
  handleSwitchPR,
  prDetailKey,
} = useDashboardDetails(currentTab);

const refreshCurrentTabSafely = async () => {
  try {
    if (selectedCustomTab.value) {
      await fetchCustomTab(selectedCustomTab.value.query, currentPage.value, {
        force: true,
      });
      return;
    }

    await refreshCurrentTab(currentPage.value, { force: true });
  } catch (error) {
    console.error('Error refreshing tab:', error);
  }
};

const handleActiveDetailBack = async () => {
  if (isIssueDetailVisible.value) {
    await handleIssueDetailBack();
    return;
  }

  await handlePRDetailBack();
};

const handleActiveDetailHome = async () => {
  if (isIssueDetailVisible.value) {
    await handleIssueDetailHome();
    return;
  }

  await handlePRDetailHome();
};

const loadRouteTabSafely = async (tab: unknown, page: number) => {
  try {
    const customTabId = getQueryParamValue(tab);
    const customTab = customTabId ? getCustomTabById(customTabId) : null;

    if (customTab) {
      setActiveTabId(customTab.id);
      await fetchCustomTab(customTab.query, page);
      return;
    }

    const dashboardTab = parseDashboardTab(tab);

    if (dashboardTab === currentBuiltinTab.value) {
      setCurrentTab(dashboardTab);
      await refreshCurrentTab(page);
      return;
    }

    setCurrentTab(dashboardTab);
    await switchTab(dashboardTab, page);
  } catch (error) {
    console.error('Error switching tab:', error);
  }
};

const switchTabSafely = async (tabId: string) => {
  try {
    await router.push({
      path: localePath('/dashboard'),
      query: buildDashboardQuery({
        ...route.query,
        tab: tabId,
        page: undefined,
        issue: undefined,
        pr: undefined,
      }),
    });
  } catch (error) {
    console.error('Error updating dashboard tab route:', error);
  }
};

const goToPage = async (page: number) => {
  if (page < 1 || page === currentPage.value) {
    return;
  }

  try {
    await router.push({
      path: localePath('/dashboard'),
      query: buildDashboardQuery({
        ...route.query,
        tab: selectedCustomTab.value?.id ?? currentTab.value,
        page,
      }),
    });
  } catch (error) {
    console.error('Error updating dashboard page route:', error);
  }
};

const handleLogout = async () => {
  await navigateTo('/auth/logout', {
    external: true,
  });
};

const handleAvatarClick = async () => {
  await handleLogout();
};

const handleSettingsClick = async () => {
  await router.push(localePath('/dashboard/settings/tabs'));
};

const handleNewGroup = () => {
  console.info('New group action is reserved for a future phase.');
};

const handleSidebarGroupToggle = (groupId: string) => {
  toggleGroupCollapsed(groupId);
};

const handleSidebarTabSelect = async (tabId: string) => {
  if (getCustomTabById(tabId)) {
    setActiveTabId(tabId);
    await switchTabSafely(tabId);
    return;
  }

  const tab = selectTab(tabId);
  await switchTabSafely(tab);
};

const moveBuiltInSidebarTab = (tabId: string, groupId: string) => {
  tabs.value = tabs.value.map((tab) => {
    if (tab.id !== tabId) {
      return tab;
    }

    return {
      ...tab,
      groupId,
    };
  });
};

const handleSidebarTabMove = (tabId: string, groupId: string) => {
  if (getCustomTabById(tabId)) {
    updateCustomTab(tabId, { groupId });
    return;
  }

  moveBuiltInSidebarTab(tabId, groupId);
};

const handleActivityGroupSelect = async (groupId: string) => {
  const tab = toDashboardTab(groupId);
  await switchTabSafely(tab);
};

const persistQuickFilters = () => {
  if (!import.meta.client) {
    return;
  }

  sessionStorage.setItem(quickFiltersStorageKey, JSON.stringify(quickFilters.value));
};

const handleFilterChange = (filters: Record<string, boolean>) => {
  quickFilters.value = {
    ...quickFilters.value,
    [currentTab.value]: filters,
  };
  persistQuickFilters();
};

const hydrateQuickFilters = () => {
  if (!import.meta.client) {
    return;
  }

  const storedFilters = sessionStorage.getItem(quickFiltersStorageKey);
  if (!storedFilters) {
    return;
  }

  try {
    const parsed = JSON.parse(storedFilters) as QuickFilterMap;
    quickFilters.value = parsed ?? {};
  } catch (error) {
    console.warn('Failed to hydrate dashboard quick filters from sessionStorage.', error);
  }
};

onMounted(() => {
  hydrateQuickFilters();
});

watch(
  () => currentPagination.value.page,
  (resolvedPage) => {
    if (resolvedPage === currentPage.value) {
      return;
    }

    void router.replace({
      path: '/dashboard',
      query: buildDashboardQuery({
        ...route.query,
        tab: currentRouteTabId.value,
        page: resolvedPage,
      }),
    });
  }
);

watch(
  () => [route.query.tab, route.query.page],
  ([tab, page]) => {
    void loadRouteTabSafely(tab, parseDashboardPage(page));
  },
  { immediate: true }
);

watch(
  () => ({
    notifications: notifications.value.length,
    issues: stats.value.issues,
    pulls: stats.value.prs,
    repos: stats.value.repos,
  }),
  ({ notifications, issues, pulls, repos }) => {
    setBadgeCount('notifications', notifications);
    setBadgeCount('issues', issues);
    setBadgeCount('pulls', pulls);
    setBadgeCount('repos', repos);
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  width: 100%;
  min-height: 100%;
}

.dashboard-main-card {
  display: flex;
  width: 100%;
  min-height: 0;
  flex-direction: column;
  flex: 1;
}

.dashboard-tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--bulma-border-light, rgba(0, 0, 0, 0.05));
  margin-bottom: 0.5rem;
}

.dashboard-tab-title {
  margin-bottom: 0;
  font-weight: 600;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
}

.dashboard-tab-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-tab-refresh {
  flex-shrink: 0;
  color: #4a4a4a;
}

.dashboard-tab-refresh:hover,
.dashboard-tab-refresh:focus-visible {
  color: #1f6feb;
  background: rgba(31, 111, 235, 0.08);
}

.dashboard-tab-refresh:hover .dashboard-tab-refresh__icon,
.dashboard-tab-refresh:focus-visible .dashboard-tab-refresh__icon {
  transform: rotate(15deg);
}

.dashboard-tab-refresh__icon {
  transition: transform 0.2s ease;
}

.dashboard-list-card-content {
  display: flex;
  min-height: 0;
  padding-top: 0.75rem;
  flex: 1;
}

.dashboard-list-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: calc(100vh - 12rem);
  min-height: 0;
  flex: 1;
  gap: 0.85rem;
}

.dashboard-list-shell--without-pagination {
  grid-template-rows: minmax(0, 1fr);
}

.dashboard-list-scroll {
  min-height: 0;
  height: 100%;
}

.dashboard-pagination-wrapper {
  z-index: 1;
  min-height: 0;
  padding: 0;
  background: white;
}
</style>
