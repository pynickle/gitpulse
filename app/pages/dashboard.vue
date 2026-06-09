<template>
  <NuxtPage v-if="isDashboardChildRoute" />

  <div v-else-if="showFileBrowsingView && fileBrowsingRepo" class="dashboard-file-browser">
    <KeepAlive>
      <RepoFileView :owner="fileBrowsingRepo.owner" :repo="fileBrowsingRepo.repo" />
    </KeepAlive>
  </div>

  <div v-else class="dashboard-page">
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
          :groups="sidebarGroups"
          :tabs="sidebarTabs"
          :active-tab-id="activeTabId"
          @tab-select="handleSidebarTabSelect"
          @group-toggle="handleSidebarGroupToggle"
          @manage-tabs="handleManageTabs"
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
            <DashboardLoadingList v-if="dashboardListLoading" :current-tab="currentTab" />

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
                  @click="openSearchResult(issue)"
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
    v-if="!showFileBrowsingView"
    :issue="currentIssue"
    :pull-request="currentPR"
    :discussion="currentDiscussion"
    :repository="currentRepo"
    :issue-error="issueError"
    :discussion-error="discussionError"
    :repo-error="repoError"
    :is-issue-visible="isIssueDetailVisible"
    :is-pull-request-visible="isPRDetailVisible"
    :is-discussion-visible="isDiscussionDetailVisible"
    :is-repository-visible="isRepoDetailVisible"
    :is-pull-request-review-route="isPRReviewRoute"
    :issue-detail-key="issueDetailKey"
    :pull-request-detail-key="prDetailKey"
    :discussion-detail-key="discussionDetailKey"
    :repository-detail-key="repoDetailKey"
    :loading-issue="loadingIssue"
    :loading-pull-request="loadingPR"
    :loading-discussion="loadingDiscussion"
    :loading-repository="loadingRepo"
    @back="handleActiveDetailBack"
    @home="handleActiveDetailHome"
    @switch-issue="handleSwitchIssue"
    @switch-pull-request="handleSwitchPR"
    @switch-discussion="handleSwitchDiscussion"
    @open-pull-request-review="handlePRReviewOpen"
    @close-pull-request-review="handlePRReviewClose"
  />
</template>

<script setup lang="ts">
import {
  BellIcon,
  BookMarkedIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-vue-next';
import SimpleBar from 'simplebar-vue';
import { defineAsyncComponent, computed, onMounted, ref, shallowRef, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import ActivityBar from '~/components/dashboard/activity-bar/ActivityBar.vue';
import DashboardLayout from '~/components/dashboard/DashboardLayout.vue';
import DashboardLoadingList from '~/components/dashboard/DashboardLoadingList.vue';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DetailOverlayHost from '~/components/dashboard/detail/DetailOverlayHost.vue';
import RepoFileView from '~/components/dashboard/repo-files/RepoFileView.vue';
import TabSidebar from '~/components/dashboard/tab-sidebar/TabSidebar.vue';
import QuickActions from '~/components/dashboard/widgets/QuickActions.vue';
import QuickFilters from '~/components/dashboard/widgets/QuickFilters.vue';
import TabStats from '~/components/dashboard/widgets/TabStats.vue';
import WidgetsPanel from '~/components/dashboard/widgets/WidgetsPanel.vue';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import { clearDashboardDetailQuery } from '~/utils/dashboard-url-navigation-utils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const AsyncNotificationItem = defineAsyncComponent(
  () => import('~/components/dashboard/NotificationItem.vue')
);
const AsyncSearchItem = defineAsyncComponent(() => import('~/components/dashboard/SearchItem.vue'));
const AsyncRepoItem = defineAsyncComponent(() => import('~/components/dashboard/RepoItem.vue'));

const { loggedIn, ready: sessionReady, user } = useUserSession();
const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const { currentEntry, navigateToFile } = useNavigationHistory();
const { resolveDashboardUrlTarget, getDashboardUrlRoute, trackDashboardUrlNavigation } =
  useDashboardUrlNavigation();

const dashboardTabs: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];
const quickFiltersStorageKey = 'gitpulse:dashboard:quick-filters';

interface DashboardEntity {
  id: PropertyKey;
  pull_request?: unknown;
  [key: string]: unknown;
}

const isDashboardChildRoute = computed(() => {
  return !route.path.replace(/\/$/, '').endsWith('/dashboard');
});

const fileBrowsingRepo = computed(() => {
  const repoQuery = getQueryParamValue(route.query.repo);
  return repoQuery ? parseGitHubRepoPath(repoQuery) : null;
});

const hasFileBrowsingPath = computed(() => Object.hasOwn(route.query, 'path'));

const showFileBrowsingView = computed(() => {
  return Boolean(fileBrowsingRepo.value && hasFileBrowsingPath.value);
});

const normalizeUrlQuery = async () => {
  const rawUrl = getQueryParamValue(route.query.url);
  if (!rawUrl) {
    return;
  }

  const target = resolveDashboardUrlTarget(rawUrl);
  if (!target) {
    return;
  }

  trackDashboardUrlNavigation(target);
  await router.replace(getDashboardUrlRoute(target));
};

watch(
  () => route.query.url,
  () => {
    if (!import.meta.client) {
      return;
    }

    void normalizeUrlQuery();
  },
  { immediate: true }
);

watch(
  () => [route.query.repo, route.query.path, route.query.branch, showFileBrowsingView.value],
  () => {
    if (!import.meta.client || !showFileBrowsingView.value || !fileBrowsingRepo.value) {
      return;
    }

    const path = getQueryParamValue(route.query.path) ?? '';
    const branch = getQueryParamValue(route.query.branch) || undefined;
    if (!branch) {
      return;
    }

    const currentData = currentEntry.value?.data;

    if (
      currentEntry.value?.type === 'file' &&
      currentData?.owner === fileBrowsingRepo.value.owner &&
      currentData?.repo === fileBrowsingRepo.value.repo &&
      currentData?.path === path &&
      currentData?.branch === branch
    ) {
      return;
    }

    navigateToFile(fileBrowsingRepo.value.owner, fileBrowsingRepo.value.repo, path, branch);
  },
  { immediate: true }
);

type QuickFilterMap = Partial<Record<DashboardTab, Record<string, boolean>>>;

const normalizeQuickFilters = (value: unknown): QuickFilterMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const filterSource = value as Partial<Record<DashboardTab, unknown>>;
  const normalizedFilters: QuickFilterMap = {};

  for (const tab of dashboardTabs) {
    const tabFilters = filterSource[tab];
    if (!tabFilters || typeof tabFilters !== 'object' || Array.isArray(tabFilters)) {
      continue;
    }

    const filters = Object.fromEntries(
      Object.entries(tabFilters).filter(([, active]) => typeof active === 'boolean')
    ) as Record<string, boolean>;

    if (Object.keys(filters).length > 0) {
      normalizedFilters[tab] = filters;
    }
  }

  return normalizedFilters;
};

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
  return Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
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

const hasCompletedInitialDashboardLoad = shallowRef(false);
const dashboardListLoading = computed(
  () => !hasCompletedInitialDashboardLoad.value || loading.value
);

const { customTabs, getCustomTabById } = useCustomTabs();

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

const sidebarGroups = computed(() => {
  return groups.value;
});

const customSidebarGroups = computed(() => {
  return groups.value.filter((group) => group.source !== 'system');
});

const customSidebarGroupIds = computed(() => {
  return new Set(customSidebarGroups.value.map((group) => group.id));
});

const fallbackCustomGroupId = computed(() => customSidebarGroups.value[0]?.id ?? '');

const selectedCustomTab = computed(() => {
  const tabId = getQueryParamValue(route.query.tab);

  if (!tabId) {
    return null;
  }

  return getCustomTabById(tabId) ?? null;
});

const sidebarTabs = computed(() => {
  const iconByTab: Record<DashboardTab, Component> = {
    notifications: BellIcon,
    issues: CircleDotIcon,
    pulls: GitPullRequestIcon,
    repos: BookMarkedIcon,
  };

  const builtinSidebarTabs = tabs.value.map((tab) => ({
    id: tab.id,
    groupId: tab.groupId,
    name: tab.name,
    icon: iconByTab[tab.id as DashboardTab] ?? BellIcon,
    badgeCount: tab.badgeCount,
  }));

  const customSidebarTabs = customTabs.value.map((tab) => ({
    id: tab.id,
    groupId: customSidebarGroupIds.value.has(tab.groupId)
      ? tab.groupId
      : fallbackCustomGroupId.value,
    name: tab.name,
    icon: SearchIcon,
  }));

  return [...builtinSidebarTabs, ...customSidebarTabs];
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

const getActiveFilterKeys = (filters: Record<string, boolean>) => {
  return Object.entries(filters)
    .filter(([, active]) => active)
    .map(([key]) => key);
};

const filteredNotifications = computed(() => {
  const activeFilters = getActiveFilterKeys(currentTabFilters.value);

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
  const activeFilters = getActiveFilterKeys(currentTabFilters.value);

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
  const activeFilters = getActiveFilterKeys(currentTabFilters.value);

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

const currentTabStats = computed((): Record<string, number> => {
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

const isPullRequestResult = (item: DashboardEntity) => {
  return typeof item.pull_request === 'object' && item.pull_request !== null;
};

const {
  currentIssue,
  currentPR,
  currentDiscussion,
  currentRepo,
  issueError,
  discussionError,
  repoError,
  isIssueDetailVisible,
  isPRDetailVisible,
  isDiscussionDetailVisible,
  isRepoDetailVisible,
  issueDetailKey,
  discussionDetailKey,
  loadingIssue,
  loadingPR,
  loadingDiscussion,
  loadingRepo,
  openIssue,
  openNotification,
  openPR,
  handleIssueDetailBack,
  handleIssueDetailHome,
  handlePRDetailBack,
  handlePRDetailHome,
  handleDiscussionDetailBack,
  handleDiscussionDetailHome,
  handleRepoDetailBack,
  handleRepoDetailHome,
  handleSwitchIssue,
  handleSwitchPR,
  handleSwitchDiscussion,
  handlePRReviewOpen,
  handlePRReviewClose,
  isPRReviewRoute,
  repoDetailKey,
  prDetailKey,
} = useDashboardDetails(currentRouteTabId);

const openSearchResult = async (item: DashboardEntity) => {
  if (isPullRequestResult(item)) {
    await openPR(item);
    return;
  }

  await openIssue(item);
};

const refreshCurrentTabSafely = async () => {
  try {
    if (selectedCustomTab.value) {
      await fetchCustomTab(
        selectedCustomTab.value.query,
        currentPage.value,
        {
          force: true,
        },
        selectedCustomTab.value.source
      );
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

  if (isRepoDetailVisible.value) {
    await handleRepoDetailBack();
    return;
  }

  if (isDiscussionDetailVisible.value) {
    await handleDiscussionDetailBack();
    return;
  }

  await handlePRDetailBack();
};

const handleActiveDetailHome = async () => {
  if (isIssueDetailVisible.value) {
    await handleIssueDetailHome();
    return;
  }

  if (isRepoDetailVisible.value) {
    await handleRepoDetailHome();
    return;
  }

  if (isDiscussionDetailVisible.value) {
    await handleDiscussionDetailHome();
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
      await fetchCustomTab(customTab.query, page, {}, customTab.source);
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
  } finally {
    hasCompletedInitialDashboardLoad.value = true;
  }
};

const switchTabSafely = async (tabId: string) => {
  try {
    await router.push({
      path: localePath('/dashboard'),
      query: buildDashboardQuery({
        ...clearDashboardDetailQuery(route.query),
        tab: tabId,
        page: undefined,
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
  await $fetch('/auth/logout', {
    method: 'POST',
  });

  await navigateTo(localePath('/'));
};

const handleAvatarClick = async () => {
  await handleLogout();
};

const handleSettingsClick = async () => {
  await router.push(localePath('/dashboard/settings'));
};

const handleManageTabs = async () => {
  await router.push(localePath('/dashboard/tabs'));
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
    quickFilters.value = normalizeQuickFilters(JSON.parse(storedFilters));
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
      path: localePath('/dashboard'),
      query: buildDashboardQuery({
        ...route.query,
        tab: currentRouteTabId.value,
        page: resolvedPage,
      }),
    });
  }
);

watch(
  () => [route.query.tab, route.query.page, sessionReady.value, loggedIn.value],
  ([tab, page]) => {
    if (!import.meta.client || !sessionReady.value || !loggedIn.value) {
      return;
    }

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
  height: calc(100vh - var(--bulma-navbar-height, 3.25rem));
  min-height: calc(100vh - var(--bulma-navbar-height, 3.25rem));
  overflow: hidden;
  background: var(--gitpulse-page-bg);
}

.dashboard-file-browser {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  background: var(--gitpulse-page-bg);
}

.dashboard-main-card {
  display: flex;
  width: 100%;
  max-width: 54rem;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  flex: 1;
}

.dashboard-tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--gitpulse-border);
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
  color: var(--gitpulse-text-muted);
}

.dashboard-tab-refresh:hover,
.dashboard-tab-refresh:focus-visible {
  color: var(--gitpulse-link);
  background: var(--gitpulse-info-soft);
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
  height: 100%;
  min-height: 0;
  flex: 1;
  gap: 0.85rem;
}

.dashboard-list-scroll {
  min-height: 0;
  height: 100%;
}

.dashboard-pagination-wrapper {
  z-index: 1;
  min-height: 0;
  padding: 0;
  background: var(--gitpulse-surface);
}
</style>
