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
            <span
              v-if="currentTabSubtitle"
              class="dashboard-tab-subtitle"
              :title="currentTabSubtitle"
            >
              · {{ currentTabSubtitle }}
            </span>
            <div class="dashboard-tab-actions">
              <button
                class="button is-ghost is-small dashboard-tab-filter"
                :class="{ 'is-active': hasActiveVisibleFilters }"
                type="button"
                :aria-label="t('dashboard.filters.openDrawer')"
                :title="t('dashboard.filters.openDrawer')"
                @click="isFilterDrawerOpen = true"
              >
                <FilterIcon v-once :size="18" aria-hidden="true" />
              </button>
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

          <div v-if="showPagination || visibleDashboardFilters" class="dashboard-controls-row">
            <FilterPills
              :current-tab="activeFilterSource"
              :filters="visibleDashboardFilters"
              @update="handleFilterUpdate"
            />
            <DashboardPagination
              v-if="showPagination"
              :pagination="currentPagination"
              :current-page-only="currentTab === 'notifications' && notificationUsesBatchedFetch"
              @change="goToPage"
            />
          </div>

          <div class="card-content dashboard-list-card-content">
            <DashboardLoadingList v-if="dashboardListLoading" :current-tab="currentTab" />

            <div v-else-if="error" class="dashboard-error-state">
              <div class="dashboard-error-state__content">
                <div class="dashboard-error-state__icon" aria-hidden="true">
                  <AlertTriangleIcon :size="40" />
                </div>
                <p class="dashboard-error-state__title">
                  {{ t('dashboard.error.title') }}
                </p>
                <p class="dashboard-error-state__description">
                  {{ t('dashboard.error.description') }}
                </p>
                <div class="dashboard-error-state__actions">
                  <Button color="primary" size="normal" @click="refreshCurrentTabSafely">
                    {{ t('dashboard.error.retry') }}
                  </Button>
                  <button
                    type="button"
                    class="dashboard-error-state__details-toggle"
                    :aria-expanded="showErrorDetails"
                    @click="showErrorDetails = !showErrorDetails"
                  >
                    {{
                      showErrorDetails
                        ? t('dashboard.error.hideDetails')
                        : t('dashboard.error.showDetails')
                    }}
                  </button>
                  <pre v-if="showErrorDetails" class="dashboard-error-state__details">{{
                    error
                  }}</pre>
                </div>
              </div>
            </div>

            <div
              v-else
              :class="[
                'dashboard-list-shell',
                { 'dashboard-list-shell--without-pagination': !showPagination },
              ]"
            >
              <SimpleBar class="dashboard-list-scroll" v-if="currentTab === 'notifications'">
                <div v-if="filteredNotifications.length === 0" class="dashboard-empty-state">
                  {{ notificationEmptyMessage }}
                </div>
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
                  v-for="issue in issues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openSearchResult(issue)"
                >
                  <AsyncSearchItem :issue="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'issues'" class="dashboard-list-scroll">
                <div
                  v-for="issue in issues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openIssue(issue)"
                >
                  <AsyncIssuePrNotificationItem :item="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'pulls'" class="dashboard-list-scroll">
                <div v-for="pull in pulls" :key="pull.id" class="mb-4 mr-4" @click="openPR(pull)">
                  <AsyncIssuePrNotificationItem :item="pull" />
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
          <DashboardAdvancedFilters
            :current-tab="activeFilterSource"
            :filters="visibleDashboardFilters"
            :label-suggestions="labelFilterSuggestions"
            :repo-suggestions="repoFilterSuggestions"
            :author-suggestions="authorFilterSuggestions"
            @update="handleFilterUpdate"
          />
          <QuickActions :current-tab="currentTab" />
        </WidgetsPanel>
      </template>
    </DashboardLayout>
  </div>

  <DetailOverlayHost
    v-if="hasOpenedDetailOverlay && !showFileBrowsingView"
    :issue="currentIssue"
    :pull-request="currentPR"
    :discussion="currentDiscussion"
    :release="currentRelease"
    :repository="currentRepo"
    :issue-error="issueError"
    :discussion-error="discussionError"
    :release-error="releaseError"
    :repo-error="repoError"
    :is-issue-visible="isIssueDetailVisible"
    :is-pull-request-visible="isPRDetailVisible"
    :is-discussion-visible="isDiscussionDetailVisible"
    :is-release-visible="isReleaseDetailVisible"
    :is-repository-visible="isRepoDetailVisible"
    :is-pull-request-review-route="isPRReviewRoute"
    :issue-detail-key="issueDetailKey"
    :pull-request-detail-key="prDetailKey"
    :discussion-detail-key="discussionDetailKey"
    :release-detail-key="releaseDetailKey"
    :repository-detail-key="repoDetailKey"
    :loading-issue="loadingIssue"
    :loading-pull-request="loadingPR"
    :loading-discussion="loadingDiscussion"
    :loading-release="loadingRelease"
    :loading-repository="loadingRepo"
    @back="handleDetailBack"
    @home="handleDetailHome"
    @switch-issue="handleSwitchIssue"
    @switch-pull-request="handleSwitchPR"
    @switch-discussion="handleSwitchDiscussion"
    @open-pull-request-review="handlePRReviewOpen"
    @close-pull-request-review="handlePRReviewClose"
  />

  <FilterModal
    v-if="hasOpenedFilterDrawer"
    :open="isFilterDrawerOpen"
    :current-tab="activeFilterSource"
    :filters="visibleDashboardFilters"
    :repo-suggestions="repoFilterSuggestions"
    :author-suggestions="authorFilterSuggestions"
    :label-suggestions="labelFilterSuggestions"
    @close="isFilterDrawerOpen = false"
    @update="handleFilterUpdate"
    @clear="clearVisibleFilters"
  />

  <FloatingRefreshButton
    v-if="!isDashboardChildRoute && !showFileBrowsingView"
    :has-new-content="dashboardHasNewContent"
    :refreshing="dashboardRefreshing"
    :checking="dashboardChecking"
    :disabled="activeDashboardLoading"
    :label="t('dashboard.actions.refresh')"
    @refresh="refreshDashboard"
  />
</template>

<script setup lang="ts">
import {
  AlertTriangleIcon,
  BellIcon,
  BookMarkedIcon,
  CircleDotIcon,
  FilterIcon,
  GitPullRequestIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-vue-next';

import 'simplebar-vue/dist/simplebar.min.css';
import SimpleBar from 'simplebar-vue';
import { defineAsyncComponent, computed, shallowRef, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import ActivityBar from '~/components/dashboard/activity-bar/ActivityBar.vue';
import {
  loadDetailOverlayHost,
  loadFilterModal,
  loadRepoFileView,
} from '~/components/dashboard/dashboard-lazy-loaders';
import DashboardLayout from '~/components/dashboard/DashboardLayout.vue';
import DashboardLoadingList from '~/components/dashboard/DashboardLoadingList.vue';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import {
  loadDiscussionDetail,
  loadIssueDetail,
  loadPrDetail,
  loadReleaseDetail,
  loadRepoDetail,
} from '~/components/dashboard/detail/detail-pane-loaders';
import DashboardAdvancedFilters from '~/components/dashboard/filters/DashboardAdvancedFilters.vue';
import FilterPills from '~/components/dashboard/filters/FilterPills.vue';
import FloatingRefreshButton from '~/components/dashboard/FloatingRefreshButton.vue';
import TabSidebar from '~/components/dashboard/tab-sidebar/TabSidebar.vue';
import QuickActions from '~/components/dashboard/widgets/QuickActions.vue';
import WidgetsPanel from '~/components/dashboard/widgets/WidgetsPanel.vue';
import Button from '~/components/ui/Button.vue';
import type { GitHubSearchQuery } from '~/composables/useCustomTabs';
import {
  createCustomTabPreviewSearchParams,
  resolveCustomTabSubtitle,
} from '~/composables/useCustomTabSettingsOptions';
import {
  applyNotificationLocalFilters,
  createCustomTabFilterSourceState,
  createDashboardFilterSourceState,
  normalizeCustomTabRouteFilterPatch,
  type DashboardFilterSource,
  type DashboardRouteFilters,
} from '~/composables/useDashboardFilters';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import { buildDashboardTabSwitchQuery } from '~/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const AsyncNotificationItem = defineAsyncComponent(
  () => import('~/components/dashboard/NotificationItem.vue')
);
const AsyncIssuePrNotificationItem = defineAsyncComponent(
  () => import('~/components/dashboard/IssuePrNotificationItem.vue')
);
const AsyncSearchItem = defineAsyncComponent(() => import('~/components/dashboard/SearchItem.vue'));
const AsyncRepoItem = defineAsyncComponent(() => import('~/components/dashboard/RepoItem.vue'));
const DetailOverlayHost = defineAsyncComponent(loadDetailOverlayHost);
const FilterModal = defineAsyncComponent(loadFilterModal);
const RepoFileView = defineAsyncComponent(loadRepoFileView);

const { loggedIn, ready: sessionReady, user } = useUserSession();
const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const apiFetch = useGitPulseApiFetch();
const { currentEntry, navigateToFile } = useNavigationHistory();
const { resolveDashboardUrlTarget, getDashboardUrlRoute, trackDashboardUrlNavigation } =
  useDashboardUrlNavigation();

const dashboardTabs: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];
interface DashboardEntity {
  id: PropertyKey;
  repository_url?: string | null;
  number?: number | null;
  pull_request?: unknown;
  [key: string]: unknown;
}

interface FreshnessResponse {
  signature: string;
  pollIntervalMs?: number;
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

const { filters: dashboardFilters, updateFilters, clearSourceFilters } = useDashboardFilters();
const isFilterDrawerOpen = shallowRef(false);
const hasOpenedDetailOverlay = shallowRef(false);
const hasOpenedFilterDrawer = shallowRef(false);
const hasPrefetchedDashboardInteractionChunks = shallowRef(false);
const showErrorDetails = shallowRef(false);
const userLogin = computed(() => user.value?.login);
const filterSourceStates = computed(() => ({
  notifications: createDashboardFilterSourceState('notifications', dashboardFilters.value),
  issues: createDashboardFilterSourceState('issues', dashboardFilters.value, userLogin.value),
  pulls: createDashboardFilterSourceState('pulls', dashboardFilters.value, userLogin.value),
  repos: createDashboardFilterSourceState('repos', dashboardFilters.value, userLogin.value),
}));
const notificationFilterAdapter = computed(
  () => filterSourceStates.value.notifications.notificationAdapter
);

watch(isFilterDrawerOpen, (open) => {
  if (open) {
    hasOpenedFilterDrawer.value = true;
  }
});

const shouldSkipInteractionChunkPrefetch = () => {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;

  return Boolean(connection?.saveData || connection?.effectiveType?.includes('2g'));
};

const prefetchDashboardInteractionChunks = () => {
  void Promise.allSettled([
    loadDetailOverlayHost(),
    loadFilterModal(),
    loadRepoFileView(),
    loadDiscussionDetail(),
    loadIssueDetail(),
    loadPrDetail(),
    loadReleaseDetail(),
    loadRepoDetail(),
  ]);
};

const scheduleDashboardInteractionChunkPrefetch = () => {
  if (
    !import.meta.client ||
    hasPrefetchedDashboardInteractionChunks.value ||
    shouldSkipInteractionChunkPrefetch()
  ) {
    return;
  }

  hasPrefetchedDashboardInteractionChunks.value = true;

  const prefetch = () => {
    prefetchDashboardInteractionChunks();
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(prefetch, { timeout: 5000 });
    return;
  }

  window.setTimeout(prefetch, 2000);
};

const issuePrFetchOptions = computed(() => {
  const issuePrQuery = filterSourceStates.value.issues.issuePrQuery;
  if (!issuePrQuery) {
    return {};
  }

  return {
    query: issuePrQuery,
  };
});
const pullRequestFetchOptions = computed(() => {
  const issuePrQuery = filterSourceStates.value.pulls.issuePrQuery;
  if (!issuePrQuery) {
    return {};
  }

  return {
    query: issuePrQuery,
  };
});

const hasCompletedInitialDashboardLoad = shallowRef(false);
const dashboardListLoading = computed(
  () => !hasCompletedInitialDashboardLoad.value || loading.value
);

watch(hasCompletedInitialDashboardLoad, (loaded) => {
  if (loaded) {
    scheduleDashboardInteractionChunkPrefetch();
  }
});

const { customTabs, getCustomTabById } = useCustomTabs();

const {
  currentTab: currentBuiltinTab,
  refreshCurrentTab,
  switchTab,
} = useDashboardTabs({
  fetchNotifications: (page, options = {}) =>
    fetchNotifications(page, {
      ...options,
      notificationParams: notificationFilterAdapter.value.apiParams,
      notificationFilters: notificationFilterAdapter.value.local,
    }),
  fetchIssues: (page, options = {}) =>
    fetchIssues(page, {
      ...options,
      ...issuePrFetchOptions.value,
    }),
  fetchPulls: (page, options = {}) =>
    fetchPulls(page, {
      ...options,
      ...pullRequestFetchOptions.value,
    }),
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

const getCustomTabFilterSource = (query: { type?: string }): DashboardFilterSource => {
  return query.type === 'pulls' ? 'pulls' : 'issues';
};

const activeFilterSource = computed<DashboardFilterSource>(() => {
  if (selectedCustomTab.value) {
    return getCustomTabFilterSource(selectedCustomTab.value.query);
  }

  return currentTab.value;
});

const activeFilterState = computed(() => {
  const customTab = selectedCustomTab.value;
  if (!customTab) {
    return filterSourceStates.value[activeFilterSource.value];
  }

  return createCustomTabFilterSourceState(customTab.query, dashboardFilters.value);
});
const visibleDashboardFilters = computed(() => activeFilterState.value.filters);
const hasActiveVisibleFilters = computed(() => activeFilterState.value.hasActiveFilters);

const routeFilterSource = computed<DashboardFilterSource>(() => {
  const customTabId = getQueryParamValue(route.query.tab);
  const customTab = customTabId ? getCustomTabById(customTabId) : null;
  if (customTab) {
    return getCustomTabFilterSource(customTab.query);
  }

  return parseDashboardTab(route.query.tab);
});

const routeFilterFetchKey = computed(() => {
  const source = routeFilterSource.value;
  const sourceState = filterSourceStates.value[source];
  const customTabId = getQueryParamValue(route.query.tab);
  const customTab = customTabId ? getCustomTabById(customTabId) : null;

  if (source === 'notifications') {
    const apiParams = sourceState.notificationAdapter.apiParams;
    const localFilters = sourceState.notificationAdapter.local;
    if (!sourceState.notificationAdapter.usesPageLocalPredicates) {
      return new URLSearchParams(
        Object.entries(apiParams)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString();
    }

    return JSON.stringify({
      apiParams,
      localFilters: {
        readState: localFilters.readState,
        repo: localFilters.repo,
        reason: localFilters.reason,
        subjectType: localFilters.subjectType,
        subjectState: localFilters.subjectState,
      },
    });
  }

  if (source === 'repos') {
    return 'repos';
  }

  if (customTab) {
    const customSourceState = createCustomTabFilterSourceState(
      customTab.query,
      dashboardFilters.value
    );
    return JSON.stringify({
      customTabId: customTab.id,
      query: customTab.query,
      filters: customSourceState.filters,
    });
  }

  return JSON.stringify({
    filters: sourceState.filters,
    userLogin: userLogin.value ?? '',
  });
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
    subtitle: resolveCustomTabSubtitle(tab, t),
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

const currentTabSubtitle = computed(() => {
  const customTab = selectedCustomTab.value;
  if (!customTab) return '';
  return resolveCustomTabSubtitle(customTab, t) ?? '';
});

// SEO: dynamic title based on current tab
usePageMeta(currentTabTitle);

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

const notificationUsesBatchedFetch = computed(() => {
  return notificationFilterAdapter.value.usesPageLocalPredicates;
});

const showPagination = computed(() => {
  const activePagination = currentPagination.value;
  if (currentTab.value === 'notifications' && notificationUsesBatchedFetch.value) {
    return true;
  }
  return activePagination.totalPages !== 1 || activePagination.hasPrev || activePagination.hasNext;
});

const filteredNotifications = computed(() => {
  return applyNotificationLocalFilters(notifications.value, notificationFilterAdapter.value.local);
});

const notificationEmptyMessage = computed(() => {
  return hasActiveVisibleFilters.value
    ? t('dashboard.notifications.emptyFiltered')
    : t('dashboard.notifications.empty');
});

const getEntityRepoName = (entity: DashboardEntity) => {
  const repositoryUrl = typeof entity.repository_url === 'string' ? entity.repository_url : '';
  return parseGitHubRepoPath(repositoryUrl)?.fullName ?? '';
};

const getEntityAuthor = (entity: DashboardEntity) => {
  const user = entity.user;
  if (!user || typeof user !== 'object' || !('login' in user)) {
    return '';
  }

  return typeof user.login === 'string' ? user.login : '';
};

const getEntityLabels = (entity: DashboardEntity) => {
  const labels = entity.labels;
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => {
      if (typeof label === 'string') return label;
      if (label && typeof label === 'object' && 'name' in label && typeof label.name === 'string') {
        return label.name;
      }
      return '';
    })
    .filter(Boolean);
};

const repoFilterSuggestions = computed(() => {
  const suggestions = new Set<string>();

  for (const repo of repos.value) {
    if (typeof repo.full_name === 'string') suggestions.add(repo.full_name);
  }

  for (const notification of notifications.value) {
    if (notification.repository?.full_name) suggestions.add(notification.repository.full_name);
  }

  for (const item of [...issues.value, ...pulls.value]) {
    const repoName = getEntityRepoName(item);
    if (repoName) suggestions.add(repoName);
  }

  return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
});

const authorFilterSuggestions = computed(() => {
  const suggestions = new Set<string>();

  for (const notification of notifications.value) {
    if (notification.subject?.authorLogin) suggestions.add(notification.subject.authorLogin);
  }

  for (const item of [...issues.value, ...pulls.value]) {
    const author = getEntityAuthor(item);
    if (author) suggestions.add(author);
  }

  return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
});

const labelFilterSuggestions = computed(() => {
  if (!visibleDashboardFilters.value.repo) {
    return [];
  }

  const suggestions = new Set<string>();

  for (const notification of notifications.value) {
    if (notification.repository?.full_name !== visibleDashboardFilters.value.repo) continue;
    for (const label of notification.subject?.labels ?? []) {
      if (label.name) suggestions.add(label.name);
    }
  }

  for (const item of [...issues.value, ...pulls.value]) {
    if (getEntityRepoName(item) !== visibleDashboardFilters.value.repo) continue;
    for (const label of getEntityLabels(item)) {
      suggestions.add(label);
    }
  }

  return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
});

const isPullRequestResult = (item: DashboardEntity) => {
  return typeof item.pull_request === 'object' && item.pull_request !== null;
};

const {
  currentIssue,
  currentPR,
  currentDiscussion,
  currentRelease,
  currentRepo,
  issueError,
  discussionError,
  releaseError,
  repoError,
  isIssueDetailVisible,
  isPRDetailVisible,
  isDiscussionDetailVisible,
  isReleaseDetailVisible,
  isRepoDetailVisible,
  issueDetailKey,
  discussionDetailKey,
  releaseDetailKey,
  loadingIssue,
  loadingPR,
  loadingDiscussion,
  loadingRelease,
  loadingRepo,
  openIssue,
  openNotification,
  openPR,
  handleDetailBack,
  handleDetailHome,
  handleSwitchIssue,
  handleSwitchPR,
  handleSwitchDiscussion,
  handlePRReviewOpen,
  handlePRReviewClose,
  isPRReviewRoute,
  repoDetailKey,
  prDetailKey,
  hasVisibleDetail,
  currentDetailRefreshKey,
  currentDetailFreshnessUrl,
  refreshCurrentDetail,
} = useDashboardDetails(currentRouteTabId);

watch(
  hasVisibleDetail,
  (visible) => {
    if (visible) {
      hasOpenedDetailOverlay.value = true;
    }
  },
  { immediate: true }
);

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
        filterSourceStates.value[
          getCustomTabFilterSource(selectedCustomTab.value.query)
        ].overlayCustomTabQuery(selectedCustomTab.value.query),
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

const buildUrlWithParams = (path: string, params: Record<string, boolean | string | undefined>) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const buildSearchFreshnessUrl = (query: GitHubSearchQuery) => {
  return `/api/search/issues/freshness?${createCustomTabPreviewSearchParams(
    query,
    1,
    5
  ).toString()}`;
};

const notificationFreshnessUrl = computed(() => {
  const localFilters = notificationFilterAdapter.value.local;
  if (localFilters.subjectState) {
    return '';
  }

  return buildUrlWithParams('/api/notifications/freshness', {
    ...notificationFilterAdapter.value.apiParams,
    read_state: localFilters.readState,
    repo: localFilters.repo,
    reason: localFilters.reason,
    subject_type: localFilters.subjectType,
  });
});

const dashboardListFreshnessUrl = computed(() => {
  const customTab = selectedCustomTab.value;
  if (customTab) {
    const customSourceState = filterSourceStates.value[getCustomTabFilterSource(customTab.query)];
    return buildSearchFreshnessUrl(customSourceState.overlayCustomTabQuery(customTab.query));
  }

  if (currentTab.value === 'notifications') {
    return notificationFreshnessUrl.value;
  }

  if (currentTab.value === 'issues') {
    return issuePrFetchOptions.value.query
      ? buildSearchFreshnessUrl(issuePrFetchOptions.value.query)
      : '/api/issues/freshness';
  }

  if (currentTab.value === 'pulls') {
    return pullRequestFetchOptions.value.query
      ? buildSearchFreshnessUrl(pullRequestFetchOptions.value.query)
      : '/api/pulls/freshness';
  }

  return '/api/repos/freshness';
});

const activeDashboardFreshnessUrl = computed(() => {
  return hasVisibleDetail.value ? currentDetailFreshnessUrl.value : dashboardListFreshnessUrl.value;
});

const activeDashboardRefreshKey = computed(() => {
  if (hasVisibleDetail.value) {
    return currentDetailRefreshKey.value;
  }

  return JSON.stringify({
    tab: currentRouteTabId.value,
    page: currentPage.value,
    filters: routeFilterFetchKey.value,
  });
});

const fetchActiveDashboardFreshness = async () => {
  if (!activeDashboardFreshnessUrl.value) {
    return null;
  }

  return apiFetch<FreshnessResponse>(activeDashboardFreshnessUrl.value);
};

const refreshActiveDashboardSurface = async () => {
  if (hasVisibleDetail.value) {
    await refreshCurrentDetail();
    return;
  }

  await refreshCurrentTabSafely();
};

const activeDashboardLoading = computed(() => {
  if (!hasVisibleDetail.value) {
    return dashboardListLoading.value;
  }

  return (
    loadingIssue.value ||
    loadingPR.value ||
    loadingDiscussion.value ||
    loadingRelease.value ||
    loadingRepo.value
  );
});

const dashboardRefresh = useRefreshableView({
  refresh: refreshActiveDashboardSurface,
  checkFreshness: fetchActiveDashboardFreshness,
  freshnessKey: activeDashboardRefreshKey,
  enabled: computed(() => {
    return (
      import.meta.client &&
      sessionReady.value &&
      loggedIn.value &&
      !isDashboardChildRoute.value &&
      !showFileBrowsingView.value &&
      Boolean(activeDashboardFreshnessUrl.value)
    );
  }),
});
const {
  hasNewContent: dashboardHasNewContent,
  refreshing: dashboardRefreshing,
  checking: dashboardChecking,
  refreshNow: refreshDashboard,
} = dashboardRefresh;

const loadRouteTabSafely = async (tab: unknown, page: number) => {
  try {
    const customTabId = getQueryParamValue(tab);
    const customTab = customTabId ? getCustomTabById(customTabId) : null;

    if (customTab) {
      setActiveTabId(customTab.id);
      const customSourceState = createCustomTabFilterSourceState(
        customTab.query,
        dashboardFilters.value
      );
      await fetchCustomTab(
        customSourceState.overlayCustomTabQuery(customTab.query),
        page,
        {},
        customTab.source
      );
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
      query: buildDashboardQuery(
        buildDashboardTabSwitchQuery(tabId, {
          currentQuery: route.query,
          resetQuery: Boolean(getCustomTabById(tabId)),
        })
      ),
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

const handleFilterUpdate = async (patch: Partial<DashboardRouteFilters>) => {
  const customTab = selectedCustomTab.value;
  await updateFilters(customTab ? normalizeCustomTabRouteFilterPatch(patch) : patch);
};

const clearVisibleFilters = async () => {
  await clearSourceFilters(activeFilterSource.value);
};

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
  () => [
    route.query.tab,
    route.query.page,
    routeFilterFetchKey.value,
    sessionReady.value,
    loggedIn.value,
  ],
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
    notifications: filteredNotifications.value.length,
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
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--gitpulse-border);
  min-width: 0;
}

.dashboard-controls-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 1.5rem;
  border-bottom: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
  min-width: 0;

  :deep(.filter-pills) {
    flex-shrink: 0;
  }

  :deep(.dashboard-pagination) {
    margin-left: auto;
    flex-shrink: 0;
  }
}

@media (max-width: 860px) {
  .dashboard-controls-row {
    :deep(.dashboard-pagination) {
      margin-left: 0;
    }
  }
}

.dashboard-tab-title {
  margin-bottom: 0;
  font-weight: 600;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.dashboard-tab-subtitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.dashboard-tab-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.dashboard-tab-refresh {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.dashboard-tab-filter {
  display: none;
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.dashboard-tab-filter.is-active {
  color: var(--gitpulse-link);
  background: var(--gitpulse-info-soft);
}

.dashboard-tab-refresh:hover,
.dashboard-tab-refresh:focus-visible,
.dashboard-tab-filter:hover,
.dashboard-tab-filter:focus-visible {
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
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
}

.dashboard-list-scroll {
  min-height: 0;
  height: 100%;
}

.dashboard-empty-state {
  display: flex;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.dashboard-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  padding: clamp(1.5rem, 6vh, 4rem) clamp(1rem, 5vw, 3rem);
  flex: 1;
  text-align: center;
  overflow: hidden;
}

.dashboard-error-state__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: min(100%, 28rem);
}

.dashboard-error-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(56px, 10vh, 72px);
  height: clamp(56px, 10vh, 72px);
  margin-bottom: clamp(1rem, 3vh, 1.5rem);
  border-radius: 50%;
  background-color: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  flex-shrink: 0;
}

.dashboard-error-state__title {
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  margin: 0 0 0.5rem;
}

.dashboard-error-state__description {
  font-size: clamp(0.8125rem, 1.6vw, 0.9375rem);
  line-height: 1.55;
  color: var(--gitpulse-text-muted);
  margin: 0 0 clamp(1rem, 3vh, 1.5rem);
  max-width: min(100%, 26rem);
}

.dashboard-error-state__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.dashboard-error-state__details-toggle {
  font-size: 0.8rem;
  color: var(--gitpulse-text-subtle);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.dashboard-error-state__details-toggle:hover {
  color: var(--gitpulse-text-muted);
}

.dashboard-error-state__details {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  width: 100%;
  max-width: min(100%, 32rem);
  max-height: clamp(120px, 25vh, 220px);
  overflow: auto;
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--gitpulse-text-muted);
  background-color: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 860px) {
  .dashboard-tab-filter {
    display: inline-flex;
  }
}
</style>
