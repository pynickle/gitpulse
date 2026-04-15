<template>
  <div class="container is-max-desktop pb-6">
    <div class="columns">
      <div class="column is-one-quarter sidebar">
        <div class="card user-card">
          <div class="card-content">
            <div class="has-text-centered mb-4">
              <figure class="image is-96x96 mx-auto mb-3">
                <img :src="user?.avatar_url" :alt="user?.name" class="is-rounded" />
              </figure>
              <h2 class="title is-5">{{ user?.name }}</h2>
              <p class="subtitle is-7">{{ user?.login }}</p>
            </div>

            <div class="buttons is-centered mt-4">
              <button
                class="button is-small is-primary is-fullwidth"
                @click="refreshCurrentTabSafely"
              >
                <RefreshCwIcon :size="16" class="mr-2" />
                Refresh
              </button>
              <button class="button is-small is-light is-fullwidth" @click="clear">
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
        <div class="card">
          <div class="tabs is-centered is-boxed">
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

          <div class="card-content">
            <div v-if="loading" class="has-text-centered py-6" style="min-height: 500px">
              <p class="is-size-5 has-text-grey">Loading...</p>
            </div>

            <div v-else-if="error" class="notification is-danger" style="min-height: 500px">
              <p>{{ error }}</p>
            </div>

            <div v-else>
              <SimpleBar class="notification-list" v-if="currentTab === 'notifications'">
                <div
                  v-for="notification in notifications"
                  :key="notification.id"
                  class="mb-4 mr-4"
                  @click="openNotification(notification)"
                >
                  <NotificationItem :notification="notification" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'issues'" class="issues-list">
                <div
                  v-for="issue in issues"
                  :key="issue.id"
                  class="mb-4 mr-4"
                  @click="openIssue(issue)"
                >
                  <SearchItem :issue="issue" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'pulls'" class="pulls-list">
                <div v-for="pull in pulls" :key="pull.id" class="mb-4 mr-4" @click="openPR(pull)">
                  <SearchItem :issue="pull" />
                </div>
              </SimpleBar>

              <SimpleBar v-else-if="currentTab === 'repos'" class="repos-list">
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

import DetailOverlayHost from '~/components/dashboard/DetailOverlayHost.vue';
import NotificationItem from '~/components/dashboard/NotificationItem.vue';
import RepoItem from '~/components/dashboard/RepoItem.vue';
import SearchItem from '~/components/dashboard/SearchItem.vue';
import type { DashboardTab } from '~/composables/useDashboardTabs';

const { user, clear } = useUserSession();
const route = useRoute();
const router = useRouter();

const dashboardTabs: DashboardTab[] = ['notifications', 'issues', 'pulls', 'repos'];

const getQueryValue = (value: unknown) => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
};

const parseDashboardTab = (value: unknown): DashboardTab => {
  const tab = getQueryValue(value);
  return dashboardTabs.includes(tab as DashboardTab) ? (tab as DashboardTab) : 'notifications';
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

const {
  currentIssue,
  currentPR,
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
    await refreshCurrentTab();
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

const loadRouteTabSafely = async (tab: DashboardTab) => {
  try {
    if (tab === currentTab.value) {
      await refreshCurrentTab();
      return;
    }

    await switchTab(tab);
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
        issue: undefined,
        pr: undefined,
      }),
    });
  } catch (error) {
    console.error('Error updating dashboard tab route:', error);
  }
};

watch(
  () => route.query.tab,
  (tab) => {
    void loadRouteTabSafely(parseDashboardTab(tab));
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
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

.notification-list,
.issues-list,
.pulls-list,
.repos-list {
  max-height: 500px;
  overflow-y: auto;
}
</style>
