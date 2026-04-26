<template>
  <div class="container is-max-desktop pb-6 dashboard-page">
    <div class="columns dashboard-columns">
      <div class="column is-one-quarter sidebar">
        <div class="card user-card">
          <div class="card-content">
            <div class="has-text-centered mb-4">
              <figure class="image is-96x96 mx-auto mb-3">
                <NuxtImg
                  :src="user?.avatar_url"
                  :alt="user?.name"
                  width="96"
                  height="96"
                  loading="lazy"
                  class="is-rounded"
                />
              </figure>
              <h2 class="title is-5">{{ user?.name }}</h2>
              <p class="subtitle is-7">{{ user?.login }}</p>
            </div>

            <div class="buttons is-centered mt-4">
              <button class="button is-small is-light is-fullwidth" @click="handleLogout">
                <LogOutIcon :size="16" class="mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>

        <div class="card mt-4 stats-card">
          <div class="card-content">
            <h3 class="title is-7 mb-3">Quick Stats</h3>
            <div class="level is-mobile">
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">Issues</p>
                  <p class="title is-6">{{ stats.issues }}</p>
                </div>
              </div>
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">PRs</p>
                  <p class="title is-6">{{ stats.prs }}</p>
                </div>
              </div>
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">Repos</p>
                  <p class="title is-6">{{ stats.repos }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="column is-three-quarters main-content">
        <div class="card dashboard-main-card">
          <div class="dashboard-tabs-header">
            <div class="tabs is-centered is-boxed dashboard-tabs-nav">
              <ul>
                <li :class="{ 'is-active': currentTab === 'notifications' }">
                  <a @click="switchTabSafely('notifications')">
                    <BellIcon :size="16" class="mr-1" />
                    Notifications
                  </a>
                </li>
                <li :class="{ 'is-active': currentTab === 'issues' }">
                  <a @click="switchTabSafely('issues')">
                    <CircleDotIcon :size="16" class="mr-1" />
                    Issues
                  </a>
                </li>
                <li :class="{ 'is-active': currentTab === 'pulls' }">
                  <a @click="switchTabSafely('pulls')">
                    <GitPullRequestIcon :size="16" class="mr-1" />
                    Pull Requests
                  </a>
                </li>
                <li :class="{ 'is-active': currentTab === 'repos' }">
                  <a @click="switchTabSafely('repos')">
                    <BookMarkedIcon :size="16" class="mr-1" />
                    Repositories
                  </a>
                </li>
              </ul>
            </div>

            <button
              class="button is-ghost is-small dashboard-tab-refresh"
              type="button"
              :aria-label="t('dashboard.actions.refreshCurrentTab')"
              :title="t('dashboard.actions.refreshCurrentTab')"
              @click="refreshCurrentTabSafely"
            >
              <RefreshCwIcon :size="16" class="dashboard-tab-refresh__icon mr-1" />
              <span>{{ t('dashboard.actions.refreshCurrentTab') }}</span>
            </button>
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
                  v-for="notification in notifications"
                  :key="notification.id"
                  class="mb-4 mr-4"
                  @click="openNotification(notification)"
                >
                  <NotificationItem :notification="notification" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'issues'" class="dashboard-list-scroll">
                <div
                  v-for="issue in issues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openIssue(issue)"
                >
                  <SearchItem :issue="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'pulls'" class="dashboard-list-scroll">
                <div v-for="pull in pulls" :key="pull.id" class="mb-4 mr-4" @click="openPR(pull)">
                  <SearchItem :issue="pull" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'repos'" class="dashboard-list-scroll">
                <div v-for="repo in repos" class="mb-4 mr-4" :key="repo.id">
                  <RepoItem :repo="repo" />
                </div>
              </SimpleBar>
            </div>
          </div>
        </div>
      </div>
    </div>
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
import {
  BellIcon,
  LogOutIcon,
  RefreshCwIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  BookMarkedIcon,
} from 'lucide-vue-next';
import { watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import DashboardLoadingList from '~/components/dashboard/DashboardLoadingList.vue';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DetailOverlayHost from '~/components/dashboard/DetailOverlayHost.vue';
import NotificationItem from '~/components/dashboard/NotificationItem.vue';
import RepoItem from '~/components/dashboard/RepoItem.vue';
import SearchItem from '~/components/dashboard/SearchItem.vue';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import getQueryParamValue from '~/utils/getQueryParamValue';

const { user } = useUserSession();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const dashboardTabs: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];

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
} = useGithubData();

const { currentTab, refreshCurrentTab, switchTab } = useDashboardTabs({
  fetchNotifications,
  fetchIssues,
  fetchPulls,
  fetchRepos,
  initialTab: parseDashboardTab(route.query.tab),
});

const currentPage = computed(() => parseDashboardPage(route.query.page));

const currentPagination = computed(() => pagination.value[currentTab.value]);

const showPagination = computed(() => {
  const activePagination = currentPagination.value;
  return activePagination.totalPages !== 1 || activePagination.hasPrev || activePagination.hasNext;
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

const loadRouteTabSafely = async (tab: DashboardTab, page: number) => {
  try {
    if (tab === currentTab.value) {
      await refreshCurrentTab(page);
      return;
    }

    await switchTab(tab, page);
  } catch (error) {
    console.error('Error switching tab:', error);
  }
};

const switchTabSafely = async (tab: DashboardTab) => {
  try {
    await router.push({
      path: '/dashboard',
      query: buildDashboardQuery({
        ...route.query,
        tab,
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
      path: '/dashboard',
      query: buildDashboardQuery({
        ...route.query,
        tab: currentTab.value,
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
        tab: currentTab.value,
        page: resolvedPage,
      }),
    });
  }
);

watch(
  () => [route.query.tab, route.query.page],
  ([tab, page]) => {
    void loadRouteTabSafely(parseDashboardTab(tab), parseDashboardPage(page));
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

.dashboard-columns {
  width: 100%;
  align-items: stretch;
}

.main-content {
  display: flex;
  min-height: 0;
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
  gap: 1rem;
  padding-right: 1rem;
}

.dashboard-tabs-nav {
  flex: 1;
  margin-bottom: 0;
}

.dashboard-tabs-nav :deep(.tabs) {
  margin-bottom: 0;
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

.sidebar {
  position: sticky;
  top: 1rem;
}

.user-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stats-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
