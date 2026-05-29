<template>
  <div :class="['pr-detail-layout', { 'pr-detail-layout--review': isReviewWindowOpen }]">
    <PRReviewWorkspace
      v-if="isReviewWindowOpen"
      :owner="repoOwner"
      :repo="repoName"
      :pull-number="currentPullRequest?.number || 0"
      :commit-id="reviewCommitId"
      :title="currentPullRequest?.title"
      @close="isReviewWindowOpen = false"
    />

    <div v-else class="columns">
      <div class="column is-three-quarters">
        <div v-if="detailError" class="notification is-danger is-light mb-4 py-2 px-3">
          <p class="is-size-7">{{ detailError }}</p>
        </div>

        <PRHeader
          :pull-request="currentPullRequest"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <hr />

        <div class="pr-detail__timeline mt-4">
          <PRTimelineEvents
            :timeline="timeline"
            :loading="loadingTimeline"
            :repo-owner="repoOwner"
            :repo-name="repoName"
            :pull-number="currentPullRequest?.number || 0"
            :has-next-page="hasNextTimelinePage"
            :loading-more="loadingMoreTimeline"
            @switch-issue="switchToIssue"
            @switch-pull-request="switchToPullRequest"
            @comment-created="addTimelineEvent"
            @load-more="loadMoreTimeline"
          />
        </div>
      </div>

      <div class="column is-one-quarter detail-sidebar-column">
        <div
          ref="sidebarRef"
          class="sidebar-scroll"
          :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
          @scroll="onSidebarScroll"
        >
          <PRLabels
            :labels="currentPullRequest?.labels || []"
            :can-edit-labels="canEditLabels"
            :repo-info="repoInfo"
            :pr-number="currentPullRequest?.number || null"
            @update:labels="updateLabels"
          />

          <PRActions
            :requested-reviewers="currentPullRequest?.requested_reviewers || []"
            :html-url="currentPullRequest?.html_url"
            :created-at="currentPullRequest?.created_at"
            :updated-at="currentPullRequest?.updated_at"
            :merged-at="currentPullRequest?.merged_at"
            :assignee="currentPullRequest?.assignee"
            :commits="currentPullRequest?.commits"
            :changed-files="currentPullRequest?.changed_files"
            :additions="currentPullRequest?.additions"
            :deletions="currentPullRequest?.deletions"
          />

          <div class="sidebar-card mt-4">
            <div class="sidebar-card__content">
              <button
                class="sidebar-review-btn"
                type="button"
                :disabled="!canOpenReviewWindow"
                @click="isReviewWindowOpen = true"
              >
                <EyeIcon :size="14" />
                <span>{{ t('prReview.openReview') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EyeIcon } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import PRActions from '~/components/dashboard/pr/PRActions.vue';
// Import subcomponents
import PRHeader from '~/components/dashboard/pr/PRHeader.vue';
import PRLabels from '~/components/dashboard/pr/PRLabels.vue';
import PRReviewWorkspace from '~/components/dashboard/pr/PRReviewWorkspace.vue';
import PRTimelineEvents from '~/components/dashboard/pr/PRTimelineEvents.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  pullRequest: any;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:review-active', isActive: boolean): void;
}>();

// State variables
const loadingTimeline = ref(false);
const currentPullRequest = ref(props.pullRequest);
const detailError = ref('');
const timeline = ref<PRTimelineItem[]>([]);
const timelineRequestId = ref(0);
const detailRequestId = ref(0);
const currentTimelinePage = ref(1);
const hasNextTimelinePage = ref(false);
const loadingMoreTimeline = ref(false);
const isReviewWindowOpen = shallowRef(false);
const { t } = useI18n();

// Sidebar scroll auto-hide
const sidebarRef = ref<HTMLElement | null>(null);
const isSidebarScrolling = ref(false);
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

const clearScrollTimeout = () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
};

const onSidebarScroll = () => {
  isSidebarScrolling.value = true;
  clearScrollTimeout();
  scrollTimeout = setTimeout(() => {
    isSidebarScrolling.value = false;
    scrollTimeout = null;
  }, 1000);
};

onBeforeUnmount(clearScrollTimeout);

const repoPermissions = ref({
  admin: false,
  maintain: false,
  push: false,
  triage: false,
  pull: false,
  canEditLabels: false,
  canLockIssue: false,
});

// Computed properties
const repoInfo = computed(() => {
  const pullRequest = currentPullRequest.value;

  return (
    parseGitHubRepoPath(pullRequest?.repository_url) ||
    parseGitHubRepoPath(pullRequest?.base?.repo?.url) ||
    parseGitHubRepoPath(pullRequest?.head?.repo?.url) ||
    null
  );
});

const canEditLabels = computed(() => repoPermissions.value.canEditLabels);

const repoOwner = computed(() => repoInfo.value?.owner || '');

const repoName = computed(() => repoInfo.value?.repo || '');

const reviewCommitId = computed(() => currentPullRequest.value?.head?.sha || '');

const canOpenReviewWindow = computed(() =>
  Boolean(
    repoOwner.value && repoName.value && currentPullRequest.value?.number && reviewCommitId.value
  )
);

// Methods
const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const addTimelineEvent = (event: PRTimelineItem) => {
  timeline.value.push(event);
};

const updateLabels = (labels: any[]) => {
  if (currentPullRequest.value) {
    currentPullRequest.value.labels = labels;
  }
};

const getPullRequestIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentPullRequest.value.number}`;
};

const hasHydratedPullRequestDetails = (pullRequest: Record<string, unknown> | null | undefined) => {
  if (!pullRequest) {
    return false;
  }

  return [
    'requested_reviewers',
    'commits',
    'changed_files',
    'additions',
    'deletions',
    'base',
    'head',
  ].some((key) => key in pullRequest);
};

const resetPullRequestScopedState = (pullRequest: any) => {
  currentPullRequest.value = pullRequest;
  detailError.value = '';
  timeline.value = [];
  repoPermissions.value = {
    admin: false,
    maintain: false,
    push: false,
    triage: false,
    pull: false,
    canEditLabels: false,
    canLockIssue: false,
  };
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;
  loadingMoreTimeline.value = false;
  isReviewWindowOpen.value = false;
};

const fetchTimeline = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = timelineRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  timelineRequestId.value = requestId;
  loadingTimeline.value = true;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await $fetch<{
      timeline?: PRTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/pulls/${owner}/${repo}/${pullNumber}/timeline`, {
      method: 'GET',
      query: { page: 1 },
    });

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = data?.timeline || [];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
    }
  } catch (err: any) {
    console.error('Error fetching PR timeline:', err);
    if (requestId === timelineRequestId.value) {
      timeline.value = [];
      hasNextTimelinePage.value = false;
    }
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingTimeline.value = false;
    }
  }
};

const loadMoreTimeline = async () => {
  if (
    !repoInfo.value ||
    !currentPullRequest.value?.number ||
    !hasNextTimelinePage.value ||
    loadingMoreTimeline.value
  ) {
    return;
  }

  const requestId = timelineRequestId.value;
  const pullRequestIdentity = getPullRequestIdentity();
  const nextPage = currentTimelinePage.value + 1;
  loadingMoreTimeline.value = true;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await $fetch<{
      timeline?: PRTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/pulls/${owner}/${repo}/${pullNumber}/timeline`, {
      method: 'GET',
      query: { page: nextPage },
    });

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = [...timeline.value, ...(data?.timeline || [])];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
      currentTimelinePage.value = nextPage;
    }
  } catch (err: any) {
    console.error('Error loading more PR timeline:', err);
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingMoreTimeline.value = false;
    }
  }
};

const fetchRepoPermissions = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;

  try {
    const { owner, repo } = repoInfo.value;
    const permissionData = await $fetch(`/api/repos/${owner}/${repo}/permissions`, {
      method: 'GET',
    });

    if (permissionData) {
      repoPermissions.value = {
        admin: Boolean(permissionData.admin),
        maintain: Boolean(permissionData.maintain),
        push: Boolean(permissionData.push),
        triage: Boolean(permissionData.triage),
        pull: Boolean(permissionData.pull),
        canEditLabels: Boolean(permissionData.canEditLabels),
        canLockIssue: Boolean(permissionData.canLockIssue),
      };
    }
  } catch (err) {
    console.error('Error fetching repository permissions:', err);
    repoPermissions.value = {
      admin: false,
      maintain: false,
      push: false,
      triage: false,
      pull: false,
      canEditLabels: false,
      canLockIssue: false,
    };
  }
};

const fetchPullRequestDetails = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = detailRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  const basePullRequest = currentPullRequest.value;
  detailRequestId.value = requestId;
  detailError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await $fetch<Record<string, unknown>>(
      `/api/pulls/${owner}/${repo}/${pullNumber}`,
      {
        method: 'GET',
      }
    );

    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = { ...basePullRequest, ...data };
    }
  } catch (err: any) {
    console.error('Error fetching PR details:', err);
    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = basePullRequest;
      detailError.value =
        err?.data?.statusMessage || err?.message || 'Failed to load pull request details.';
    }
  }
};

// Watch for changes in props.pullRequest
watch(
  () => props.pullRequest,
  (newPullRequest) => {
    timelineRequestId.value += 1;
    detailRequestId.value += 1;
    resetPullRequestScopedState(newPullRequest);
    if (newPullRequest) {
      fetchTimeline();
      fetchRepoPermissions();
      if (hasHydratedPullRequestDetails(newPullRequest as Record<string, unknown>)) {
        return;
      }

      fetchPullRequestDetails();
    }
  },
  { immediate: true }
);

watch(
  isReviewWindowOpen,
  (isOpen) => {
    emit('update:review-active', isOpen);
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.pr-detail-layout :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.pr-detail-layout :deep(.column.is-three-quarters) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.pr-detail-layout :deep(.column.is-one-quarter) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.pr-detail-layout :deep(.detail-sidebar-column) {
  padding-right: 1rem;
}

.sidebar-scroll {
  height: 100%;
  overflow-y: auto;
  padding-right: 0.75rem;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;

  &:hover,
  &--active {
    scrollbar-color: var(--gitpulse-scrollbar-thumb) transparent;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 3px;
    transition: background-color 0.3s ease;
  }

  &:hover::-webkit-scrollbar-thumb,
  &--active::-webkit-scrollbar-thumb {
    background-color: var(--gitpulse-scrollbar-thumb);
  }
}

.pr-detail-layout {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.pr-detail-layout--review {
  position: absolute;
  inset: 0;
  min-height: 0;
  overflow: hidden;
}

.pr-detail__timeline {
  padding-bottom: 5rem;
}

// Review button
.sidebar-review-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
