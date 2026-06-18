<template>
  <div ref="detailScrollRef" class="detail-scroll" @scroll="onCompactHeaderScroll">
    <div class="columns">
      <div ref="mainColumnRef" class="column detail-main-column" @scroll="onCompactHeaderScroll">
        <div ref="detailHeaderRef" class="detail-header-boundary">
          <IssueHeader
            :issue="currentIssue"
            :repo-owner="resolvedRepoOwner"
            :repo-name="resolvedRepoName"
          />
        </div>

        <hr />

        <div class="issue-detail__timeline mt-4">
          <IssueTimelineEvents
            :timeline="timeline"
            :loading="loadingTimeline"
            :repo-owner="resolvedRepoOwner"
            :repo-name="resolvedRepoName"
            :issue-number="currentIssue.number"
            :has-next-page="hasNextTimelinePage"
            :loading-more="loadingMoreTimeline"
            @switch-issue="switchToIssue"
            @switch-pull-request="switchToPullRequest"
            @comment-created="addTimelineEvent"
            @load-more="loadMoreTimeline"
          />
        </div>
      </div>

      <div class="column detail-sidebar-column">
        <div
          class="sidebar-scroll"
          :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
          @scroll="onSidebarScroll"
        >
          <IssueLabels
            :labels="currentIssue?.labels || []"
            :can-edit-labels="canEditLabels"
            :issue-number="currentIssue?.number || null"
            :repo-info="repoInfo"
            @update:labels="updateLabels"
            @update:is-label-editor-visible="updateLabelEditorVisibility"
          />

          <IssueActions
            :is-locked="isLocked"
            :can-lock-issue="canLockIssue"
            :repo-info="repoInfo"
            :issue-number="currentIssue?.number"
            :html-url="currentIssue?.html_url"
            :created-at="currentIssue?.created_at"
            :updated-at="currentIssue?.updated_at"
            :assignee="currentIssue?.assignee"
            :source-notification="sourceNotification"
            @update:is-locked="updateIsLocked"
            @add-timeline-event="addTimelineEvent"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { IssueDetailLabel, IssueDetailPayload } from '#shared/types/issues';
import type { DashboardNotification } from '#shared/types/notifications';
import IssueActions from '~/components/dashboard/issue/IssueActions.vue';
import IssueHeader from '~/components/dashboard/issue/IssueHeader.vue';
import IssueLabels from '~/components/dashboard/issue/IssueLabels.vue';
import IssueTimelineEvents from '~/components/dashboard/issue/IssueTimelineEvents.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import { normalizeRepoPermissions } from '~/utils/createEmptyRepoPermissions';
import formatPageMetaDescription from '~/utils/formatPageMetaDescription';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  issue: IssueDetailPayload;
  sourceNotification?: DashboardNotification | null;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:non-sticky-header', visible: boolean): void;
  (e: 'update:compact-header-visible', visible: boolean): void;
}>();

const loadingTimeline = ref(false);
const loadingPermission = ref(false);
const currentIssue = ref(props.issue);
const repoPermissions = ref(createEmptyRepoPermissions());
const isLocked = ref(props.issue?.locked || false);
const timeline = ref<IssueTimelineItem[]>([]);
const isLabelEditorVisible = ref(false);
const timelineRequestId = ref(0);
const permissionRequestId = ref(0);
const currentTimelinePage = ref(1);
const hasNextTimelinePage = ref(false);
const loadingMoreTimeline = ref(false);
const apiFetch = useGitPulseApiFetch();
const detailScrollRef = ref<HTMLElement | null>(null);
const mainColumnRef = ref<HTMLElement | null>(null);
const detailHeaderRef = ref<HTMLElement | null>(null);
const {
  isCompactHeaderVisible,
  onScroll: onCompactHeaderScroll,
  reset: resetCompactHeader,
} = useDetailCompactHeader({
  scrollContainers: [mainColumnRef, detailScrollRef],
  headerElement: detailHeaderRef,
  thresholdSelector: '[data-detail-compact-threshold]',
});

// SEO: dynamic title based on issue
usePageMeta(
  computed(() => currentIssue.value?.title),
  {
    description: computed(() => {
      return formatPageMetaDescription(currentIssue.value?.body);
    }),
  }
);

const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();

const repoInfo = computed(() => {
  return parseGitHubRepoPath(currentIssue.value?.repository_url);
});

const repoOwner = computed(() => repoInfo.value?.owner);

const repoName = computed(() => repoInfo.value?.repo);

const resolvedRepoOwner = computed(() => repoOwner.value ?? '');

const resolvedRepoName = computed(() => repoName.value ?? '');

const canEditLabels = computed(() => {
  return repoPermissions.value.canEditLabels;
});

const canLockIssue = computed(() => {
  return repoPermissions.value.canLockIssue;
});

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const updateLabels = (labels: IssueDetailLabel[]) => {
  currentIssue.value.labels = labels;
};

const updateIsLocked = (locked: boolean) => {
  isLocked.value = locked;
};

const addTimelineEvent = (event: IssueTimelineItem) => {
  timeline.value.push(event);
};

const updateLabelEditorVisibility = (visible: boolean) => {
  isLabelEditorVisible.value = visible;
  emit('update:non-sticky-header', visible);
};

const getIssueIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentIssue.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentIssue.value.number}`;
};

const resetIssueScopedState = (issue: IssueDetailPayload) => {
  currentIssue.value = issue;
  timeline.value = [];
  repoPermissions.value = createEmptyRepoPermissions();
  isLocked.value = issue?.locked || false;
  isLabelEditorVisible.value = false;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;
  loadingMoreTimeline.value = false;
  resetCompactHeader();
  emit('update:non-sticky-header', false);
};

const fetchTimeline = async () => {
  if (!repoInfo.value || !currentIssue.value?.number) {
    return;
  }

  const requestId = timelineRequestId.value + 1;
  const issueIdentity = getIssueIdentity();
  timelineRequestId.value = requestId;
  loadingTimeline.value = true;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;

  try {
    const { owner, repo } = repoInfo.value;
    const issueNumber = currentIssue.value.number;

    const data = await apiFetch<{
      timeline?: IssueTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/issues/${owner}/${repo}/${issueNumber}/timeline`, {
      method: 'GET',
      query: { page: 1 },
    });

    if (requestId === timelineRequestId.value && issueIdentity === getIssueIdentity()) {
      timeline.value = data?.timeline || [];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
    }
  } catch (err: unknown) {
    console.error('Error fetching issue timeline:', err);
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
    !currentIssue.value?.number ||
    !hasNextTimelinePage.value ||
    loadingMoreTimeline.value
  ) {
    return;
  }

  const requestId = timelineRequestId.value;
  const issueIdentity = getIssueIdentity();
  const nextPage = currentTimelinePage.value + 1;
  loadingMoreTimeline.value = true;

  try {
    const { owner, repo } = repoInfo.value;
    const issueNumber = currentIssue.value.number;

    const data = await apiFetch<{
      timeline?: IssueTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/issues/${owner}/${repo}/${issueNumber}/timeline`, {
      method: 'GET',
      query: { page: nextPage },
    });

    if (requestId === timelineRequestId.value && issueIdentity === getIssueIdentity()) {
      timeline.value = [...timeline.value, ...(data?.timeline || [])];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
      currentTimelinePage.value = nextPage;
    }
  } catch (err: unknown) {
    console.error('Error loading more issue timeline:', err);
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingMoreTimeline.value = false;
    }
  }
};

const fetchRepoPermissions = async () => {
  if (!currentIssue.value?.repository_url) return;

  const owner = repoOwner.value;
  const repo = repoName.value;
  if (!owner || !repo) return;

  const requestId = permissionRequestId.value + 1;
  const issueIdentity = getIssueIdentity();
  permissionRequestId.value = requestId;
  loadingPermission.value = true;
  try {
    const permissionData = await apiFetch<Parameters<typeof normalizeRepoPermissions>[0]>(
      `/api/repos/${owner}/${repo}/permissions`,
      {
        method: 'GET',
      }
    );

    if (requestId !== permissionRequestId.value || issueIdentity !== getIssueIdentity()) return;

    repoPermissions.value = normalizeRepoPermissions(permissionData);
  } catch (err) {
    console.error('Error fetching repository permissions:', err);
    if (requestId === permissionRequestId.value) {
      repoPermissions.value = createEmptyRepoPermissions();
    }
  } finally {
    if (requestId === permissionRequestId.value) {
      loadingPermission.value = false;
    }
  }
};

watch(
  isCompactHeaderVisible,
  (visible) => {
    emit('update:compact-header-visible', visible);
  },
  { immediate: true }
);

watch(
  () => props.issue,
  (newIssue) => {
    timelineRequestId.value += 1;
    permissionRequestId.value += 1;
    resetIssueScopedState(newIssue);
    if (newIssue) {
      fetchTimeline();
      fetchRepoPermissions();
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.detail-scroll {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-scroll :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.detail-scroll :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  flex: none;
  width: 72%;
}

.detail-header-boundary {
  display: flow-root;
}

.detail-scroll :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  flex: none;
  width: 28%;
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

.issue-detail__timeline {
  padding-bottom: 5rem;
}
</style>
