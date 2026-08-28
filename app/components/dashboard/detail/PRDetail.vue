<template>
  <div
    ref="detailScrollRef"
    :class="['pr-detail-layout', { 'pr-detail-layout--review': isReviewWindowOpen }]"
    @scroll="onCompactHeaderScroll"
  >
    <PRReviewWorkspace
      v-if="isReviewWindowOpen"
      :owner="repoOwner"
      :repo="repoName"
      :pull-number="currentPullRequest?.number || 0"
      :commit-id="reviewCommitId"
      :title="currentPullRequest?.title"
      @close="closeReviewWindow"
    />

    <div v-else class="columns" :class="{ 'columns--detail-sidebar-hidden': detailSidebarHidden }">
      <div ref="mainColumnRef" class="column detail-main-column" @scroll="onCompactHeaderScroll">
        <div v-if="detailError" class="notification is-danger is-light mb-4 py-2 px-3">
          <p class="is-size-7">{{ detailError }}</p>
        </div>

        <div ref="detailHeaderRef" class="detail-header-boundary">
          <PRHeader
            :pull-request="currentPullRequest"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
        </div>

        <div class="pr-detail-section">
          <div
            class="pr-detail-tabs"
            role="tablist"
            :aria-label="t('prReview.panel.switch')"
            @keydown="handlePanelTablistKeydown"
          >
            <button
              v-for="tab in panelTabs"
              :key="tab.value"
              type="button"
              role="tab"
              class="pr-detail-tabs__tab"
              :class="{ 'is-active': activePanel === tab.value }"
              :aria-selected="activePanel === tab.value"
              :tabindex="activePanel === tab.value ? 0 : -1"
              @click="selectPanel(tab.value)"
            >
              <component
                :is="tab.icon"
                :size="14"
                class="pr-detail-tabs__icon"
                aria-hidden="true"
              />
              <span>{{ tab.label }}</span>
              <span
                v-if="tab.value === 'commits' && commitCountLabel !== null"
                class="pr-detail-tabs__count"
              >
                {{ commitCountLabel }}
              </span>
            </button>
          </div>

          <div v-show="activePanel === 'conversation'" class="pr-detail-panel" role="tabpanel">
            <div class="pr-detail__timeline">
              <PRTimelineEvents
                :timeline="timeline"
                :loading="loadingTimeline"
                :repo-owner="repoOwner"
                :repo-name="repoName"
                :pull-number="currentPullRequest?.number || 0"
                :has-next-page="hasNextTimelinePage"
                :loading-more="loadingMoreTimeline"
                :resolving-review-thread-id="resolvingReviewThreadId"
                @switch-issue="switchToIssue"
                @switch-pull-request="switchToPullRequest"
                @comment-created="addTimelineEvent"
                @load-more="loadMoreTimeline"
                @toggle-review-thread="toggleReviewThreadResolved"
              />
            </div>

            <PRMergeBox
              v-if="repoOwner && repoName && currentPullRequest?.number"
              class="pr-detail__merge-box"
              :owner="repoOwner"
              :repo="repoName"
              :pull-number="currentPullRequest.number"
              :pr-title="currentPullRequest?.title"
              :head-label="currentPullRequest?.head?.label || currentPullRequest?.head?.ref"
              :initial-status="terminalMergeStatus"
              @head-branch-updated="handlePullRequestHeadBranchUpdated"
              @merged="handlePullRequestMerged"
            />
          </div>

          <div
            v-show="activePanel === 'commits'"
            class="pr-detail-panel pr-detail-panel--commits"
            role="tabpanel"
          >
            <div v-if="commitsShowPagination" class="pr-detail-commits-toolbar">
              <DashboardPagination
                :pagination="commitsPagination"
                current-page-only
                @change="handleCommitsPageChange"
              />
            </div>

            <RepoCommitList
              :items="commitItems"
              :loading="commitsLoading"
              :error="commitsError"
              :empty-message="t('prReview.panel.commitsEmpty')"
              @retry="refreshCommits"
            />
          </div>
        </div>
      </div>

      <div class="column detail-sidebar-column" :inert="detailSidebarHidden || undefined">
        <div
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

          <DetailAssignees
            :assignees="pullRequestAssignees"
            :can-edit-assignees="canEditAssignees"
            :issue-number="currentPullRequest?.number || null"
            :repo-info="repoInfo"
            @update:assignees="updateAssignees"
          />

          <PRActions
            :requested-reviewers="currentPullRequest?.requested_reviewers || []"
            :requested-teams="currentPullRequest?.requested_teams || []"
            :reviewers="currentPullRequest?.reviewers"
            :reviewer-error="reviewerPickerError"
            :can-request-reviewers="canRequestReviewers"
            :can-open-review="canOpenReviewWindow"
            :html-url="currentPullRequest?.html_url"
            :created-at="currentPullRequest?.created_at"
            :updated-at="currentPullRequest?.updated_at"
            :merged-at="currentPullRequest?.merged_at || undefined"
            :commits="currentPullRequest?.commits"
            :changed-files="currentPullRequest?.changed_files"
            :additions="currentPullRequest?.additions"
            :deletions="currentPullRequest?.deletions"
            :source-notification="sourceNotification"
            :pr-state="currentPullRequest?.state"
            :merged="Boolean(currentPullRequest?.merged || currentPullRequest?.merged_at)"
            :can-manage-state="canManagePullRequestState"
            :repo-info="repoInfo"
            :pr-number="currentPullRequest?.number"
            @open-reviewers="openReviewerPicker"
            @open-review="openReviewWindow"
            @open-commits="openCommitsPanel"
            @request-reviewer="rerequestReviewer"
            @remove-reviewer="removeReviewerRequest"
            @state-updated="handlePullRequestStateUpdated"
          />

          <PRReviewerRequestModal
            v-if="hasOpenedReviewerPicker"
            :is-visible="isReviewerPickerOpen"
            :candidates="reviewerCandidates"
            :warnings="reviewerCandidateWarnings"
            :loading="loadingReviewerCandidates"
            :submitting="submittingReviewerRequest"
            :error="reviewerPickerError"
            @close="closeReviewerPicker"
            @submit="requestReviewerSelection"
            @clear-error="clearReviewerPickerError"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GitCommitHorizontalIcon, MessagesSquareIcon } from '@lucide/vue';
import {
  computed,
  defineAsyncComponent,
  nextTick,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue';

import type { IssueAssigneeMutationResponse, IssueAssigneeUser } from '#shared/types/assignees';
import type { DashboardNotification } from '#shared/types/notifications';
import type {
  PullRequestDetailLabel,
  PullRequestDetailResponse,
  PullRequestDetailViewModel,
} from '#shared/types/pulls';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DetailAssignees from '~/components/dashboard/detail/DetailAssignees.vue';
import RepoCommitList from '~/components/dashboard/detail/RepoCommitList.vue';
import PRActions from '~/components/dashboard/pr/PRActions.vue';
import PRHeader from '~/components/dashboard/pr/PRHeader.vue';
import PRLabels from '~/components/dashboard/pr/PRLabels.vue';
import PRMergeBox from '~/components/dashboard/pr/PRMergeBox.vue';
import PRTimelineEvents from '~/components/dashboard/pr/PRTimelineEvents.vue';
import { usePRCommitList } from '~/composables/usePRCommitList';
import { createEmptyPRReviewersSummary } from '~/composables/usePRReviewers';
import type {
  PRReviewerCandidate,
  PRReviewerCandidateWarning,
  PRReviewerMutationPayload,
  PRReviewerSummaryItem,
} from '~/composables/usePRReviewers';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';
import { normalizeRepoPermissions } from '~/utils/createEmptyRepoPermissions';
import createPullRequestDetailViewModel from '~/utils/createPullRequestDetailViewModel';
import formatPageMetaDescription from '~/utils/formatPageMetaDescription';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import handleRovingTablistKeydown from '~/utils/handleRovingTablistKeydown';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

type PRDetailPanel = 'conversation' | 'commits';

interface PRPanelTab {
  value: PRDetailPanel;
  label: string;
  icon: Component;
}

const props = defineProps<{
  pullRequest: PullRequestDetailViewModel;
  reviewActive?: boolean;
  detailSidebarHidden?: boolean;
  sourceNotification?: DashboardNotification | null;
}>();

const PRReviewWorkspace = defineAsyncComponent(
  () => import('~/components/dashboard/pr/PRReviewWorkspace.vue')
);
const PRReviewerRequestModal = defineAsyncComponent(
  () => import('~/components/dashboard/pr/PRReviewerRequestModal.vue')
);

interface PRTimelineResponse {
  timeline?: PRTimelineItem[];
  pageInfo?: { hasNextPage?: boolean };
}

type DetailSummaryTone = 'open' | 'closed' | 'merged' | 'draft';

interface CompactHeaderSummary {
  title?: string;
  number?: number | string;
  state?: string;
  stateTone?: DetailSummaryTone;
}

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:review-active', isActive: boolean): void;
  (e: 'update:compact-header-visible', visible: boolean): void;
  (e: 'update:compact-header-summary', summary: CompactHeaderSummary): void;
  (e: 'open-review'): void;
  (e: 'close-review'): void;
}>();

const loadingTimeline = ref(false);
const currentPullRequest = ref(props.pullRequest);
const { user: sessionUser } = useUserSession();
const detailError = ref('');
const timeline = ref<PRTimelineItem[]>([]);
const timelineRequestId = ref(0);
const detailRequestId = ref(0);
const permissionRequestId = ref(0);
const reviewerCandidateRequestId = ref(0);
const reviewerSummaryRequestId = ref(0);
const currentTimelinePage = ref(1);
const hasNextTimelinePage = ref(false);
const loadingMoreTimeline = ref(false);
const isReviewWindowOpen = shallowRef(false);
const isReviewerPickerOpen = shallowRef(false);
const hasOpenedReviewerPicker = shallowRef(false);
const activePanel = shallowRef<PRDetailPanel>('conversation');
const loadingReviewerCandidates = shallowRef(false);
const submittingReviewerRequest = shallowRef(false);
const reviewerRequestsAvailable = shallowRef<boolean | null>(null);
const reviewerPickerError = shallowRef('');
const resolvingReviewThreadId = shallowRef<string | null>(null);
const reviewerCandidates = ref<PRReviewerCandidate[]>([]);
const reviewerCandidateWarnings = ref<PRReviewerCandidateWarning[]>([]);
const { t } = useI18n();
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
const { fetchReviewerSummary, fetchReviewerCandidates, requestReviewers, removeReviewers } =
  usePRReviewers();

// SEO: dynamic title based on PR
usePageMeta(
  computed(() => currentPullRequest.value?.title),
  {
    description: computed(() => {
      return formatPageMetaDescription(currentPullRequest.value?.body);
    }),
  }
);

const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();

const repoPermissions = ref(createEmptyRepoPermissions());

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

const canEditAssignees = computed(() => repoPermissions.value.canEditAssignees);

const canRequestReviewers = computed(
  () =>
    Boolean(
      repoPermissions.value.admin || repoPermissions.value.maintain || repoPermissions.value.push
    ) && reviewerRequestsAvailable.value !== false
);

// Repo triage+ rights, or the author closing/reopening their own pull request.
const canManagePullRequestState = computed(() => {
  if (repoPermissions.value.canManageItemState) return true;

  const authorLogin = currentPullRequest.value?.user?.login;
  return Boolean(authorLogin && authorLogin === sessionUser.value?.login);
});

const repoOwner = computed(() => repoInfo.value?.owner || '');

const repoName = computed(() => repoInfo.value?.repo || '');

const pullRequestAssignees = computed<IssueAssigneeUser[]>(() => {
  if (Array.isArray(currentPullRequest.value?.assignees)) {
    return currentPullRequest.value.assignees;
  }

  return currentPullRequest.value?.assignee ? [currentPullRequest.value.assignee] : [];
});

const reviewCommitId = computed(() => currentPullRequest.value?.head?.sha || '');

const canOpenReviewWindow = computed(() =>
  Boolean(
    repoOwner.value && repoName.value && currentPullRequest.value?.number && reviewCommitId.value
  )
);

const compactHeaderState = computed(() => {
  if (currentPullRequest.value?.merged || currentPullRequest.value?.merged_at) return 'merged';
  if (currentPullRequest.value?.state === 'closed') return 'closed';
  if (currentPullRequest.value?.draft) return 'draft';
  return currentPullRequest.value?.state || 'closed';
});

const compactHeaderSummary = computed<CompactHeaderSummary>(() => {
  const state = compactHeaderState.value;

  return {
    title: currentPullRequest.value?.title,
    number: currentPullRequest.value?.number,
    state,
    stateTone: state === 'open' || state === 'merged' || state === 'draft' ? state : 'closed',
  };
});

const terminalMergeStatus = computed(() => {
  const pullRequest = currentPullRequest.value;
  if (!pullRequest) {
    return null;
  }

  const merged = Boolean(pullRequest.merged || pullRequest.merged_at);
  if (!merged && pullRequest.state !== 'closed') {
    return null;
  }

  const mergedBy = pullRequest.merged_by?.login
    ? {
        login: pullRequest.merged_by.login,
        avatarUrl: pullRequest.merged_by.avatar_url ?? '',
        htmlUrl: pullRequest.merged_by.html_url ?? '',
      }
    : null;

  return {
    state: merged ? ('merged' as const) : ('closed' as const),
    merged,
    mergedAt: pullRequest.merged_at ?? null,
    mergedBy,
    mergeCommitSha: pullRequest.merge_commit_sha ?? null,
    mergeableState: pullRequest.mergeable_state ?? null,
    mergeable: pullRequest.mergeable ?? null,
    autoMerge: false,
    draft: Boolean(pullRequest.draft),
    reviewDecision: 'none' as const,
    reviewSummary: {
      approved: 0,
      changesRequested: 0,
    },
    checks: {
      total: 0,
      success: 0,
      failure: 0,
      pending: 0,
      neutral: 0,
      runs: [],
    },
    headSha: pullRequest.head?.sha ?? null,
    headBranch: pullRequest.head_branch ?? null,
    viewerCanMerge: false,
  };
});

const openReviewWindow = () => {
  if (!canOpenReviewWindow.value) {
    return;
  }

  isReviewWindowOpen.value = true;
  emit('open-review');
};

const closeReviewWindow = () => {
  isReviewWindowOpen.value = false;
  emit('close-review');
};

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const addTimelineEvent = (event: PRTimelineItem) => {
  timeline.value.push(event);
};

const openReviewerPicker = () => {
  if (!canRequestReviewers.value) {
    return;
  }

  hasOpenedReviewerPicker.value = true;
  isReviewerPickerOpen.value = true;
  loadReviewerCandidates();
};

const closeReviewerPicker = () => {
  isReviewerPickerOpen.value = false;
};

const panelTabs = computed<PRPanelTab[]>(() => [
  {
    value: 'conversation',
    label: t('prReview.panel.conversation'),
    icon: MessagesSquareIcon,
  },
  {
    value: 'commits',
    label: t('prReview.panel.commits'),
    icon: GitCommitHorizontalIcon,
  },
]);

const commitCountLabel = computed(() => {
  const count = currentPullRequest.value?.commits;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return String(count);
});

const isCommitsPanelActive = computed(() => activePanel.value === 'commits');

const {
  items: commitItems,
  loading: commitsLoading,
  error: commitsError,
  pagination: commitsPagination,
  showPagination: commitsShowPagination,
  goToPage: goToCommitsPage,
  refresh: refreshCommits,
} = usePRCommitList(
  () => repoOwner.value,
  () => repoName.value,
  () => currentPullRequest.value?.number || 0,
  { enabled: isCommitsPanelActive }
);

const selectPanel = (value: PRDetailPanel) => {
  if (activePanel.value === value) return;
  activePanel.value = value;
  // Panel height can change (tall conversation vs short commits). Re-check the
  // compact header against the current scroll position without jumping to top.
  nextTick(() => {
    onCompactHeaderScroll();
  });
};

const openCommitsPanel = () => {
  selectPanel('commits');
};

const handlePanelTablistKeydown = (event: KeyboardEvent) => {
  handleRovingTablistKeydown(event, {
    itemCount: panelTabs.value.length,
    activeIndex: panelTabs.value.findIndex((tab) => tab.value === activePanel.value),
    onSelect: (index) => {
      const tab = panelTabs.value[index];
      if (tab) selectPanel(tab.value);
    },
  });
};

const handleCommitsPageChange = (page: number) => {
  void goToCommitsPage(page);
};

const invalidateReviewerSummaryRequests = () => {
  reviewerSummaryRequestId.value += 1;
};

const loadReviewerSummary = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = reviewerSummaryRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  reviewerSummaryRequestId.value = requestId;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const reviewers = await fetchReviewerSummary(owner, repo, pullNumber);

    if (
      requestId !== reviewerSummaryRequestId.value ||
      pullRequestIdentity !== getPullRequestIdentity() ||
      !currentPullRequest.value
    ) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      reviewers,
    };
  } catch (err: unknown) {
    console.error('Error fetching pull request reviewer summary:', err);
    if (
      requestId === reviewerSummaryRequestId.value &&
      pullRequestIdentity === getPullRequestIdentity() &&
      currentPullRequest.value
    ) {
      currentPullRequest.value = {
        ...currentPullRequest.value,
        reviewers: createEmptyPRReviewersSummary([
          {
            source: 'reviewer-summary',
            message: getFetchErrorMessage(err, t('prReview.reviewerPicker.summaryLoadFailed')),
          },
        ]),
      };
    }
  }
};

const loadReviewerCandidates = async (query = '') => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = reviewerCandidateRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  reviewerCandidateRequestId.value = requestId;
  loadingReviewerCandidates.value = true;
  reviewerPickerError.value = '';
  reviewerCandidateWarnings.value = [];

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await fetchReviewerCandidates(owner, repo, pullNumber, query);

    if (
      requestId !== reviewerCandidateRequestId.value ||
      pullRequestIdentity !== getPullRequestIdentity()
    ) {
      return;
    }

    reviewerCandidates.value = data.items ?? [];
    reviewerCandidateWarnings.value = data.warnings ?? [];
    reviewerRequestsAvailable.value = data.canRequestReviewers;
    if (!data.canRequestReviewers) {
      isReviewerPickerOpen.value = false;
    }
  } catch (err: unknown) {
    console.error('Error fetching pull request reviewer candidates:', err);
    if (requestId === reviewerCandidateRequestId.value) {
      reviewerCandidates.value = [];
      reviewerCandidateWarnings.value = [];
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.loadFailed')
      );
    }
  } finally {
    if (requestId === reviewerCandidateRequestId.value) {
      loadingReviewerCandidates.value = false;
    }
  }
};

const requestReviewerSelection = async (payload: PRReviewerMutationPayload) => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  submittingReviewerRequest.value = true;
  reviewerPickerError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await requestReviewers(owner, repo, pullNumber, payload);

    if (pullRequestIdentity !== getPullRequestIdentity() || !currentPullRequest.value) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...(data.pullRequest ?? {}),
      reviewers: data.reviewers ?? currentPullRequest.value.reviewers,
    };
    invalidateReviewerSummaryRequests();
    isReviewerPickerOpen.value = false;
    reviewerCandidates.value = [];
    reviewerCandidateWarnings.value = [];
  } catch (err: unknown) {
    console.error('Error requesting pull request reviewers:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.requestFailed')
      );
    }
  } finally {
    if (pullRequestIdentity === getPullRequestIdentity()) {
      submittingReviewerRequest.value = false;
    }
  }
};

const createReviewerMutationPayload = (
  reviewer: PRReviewerSummaryItem
): PRReviewerMutationPayload => {
  if (reviewer.kind === 'team') {
    return { teamReviewers: reviewer.slug ? [reviewer.slug] : [] };
  }

  return { reviewers: reviewer.login ? [reviewer.login] : [] };
};

const rerequestReviewer = async (reviewer: PRReviewerSummaryItem) => {
  if (!canRequestReviewers.value || reviewer.requested) {
    return;
  }

  const payload = createReviewerMutationPayload(reviewer);
  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  await requestReviewerSelection(payload);
};

const removeReviewerRequest = async (reviewer: PRReviewerSummaryItem) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || !reviewer.removable) {
    return;
  }

  const payload = createReviewerMutationPayload(reviewer);

  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  reviewerPickerError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await removeReviewers(owner, repo, pullNumber, payload);

    if (pullRequestIdentity !== getPullRequestIdentity() || !currentPullRequest.value) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...(data.pullRequest ?? {}),
      reviewers: data.reviewers ?? currentPullRequest.value.reviewers,
    };
    invalidateReviewerSummaryRequests();
    reviewerPickerError.value = '';
  } catch (err: unknown) {
    console.error('Error removing pull request reviewer:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.removeFailed')
      );
    }
  }
};

const clearReviewerPickerError = () => {
  reviewerPickerError.value = '';
};

const handlePullRequestMerged = () => {
  fetchPullRequestDetails();
  fetchTimeline();
};

const handlePullRequestStateUpdated = () => {
  fetchPullRequestDetails();
  fetchTimeline();
};

const handlePullRequestHeadBranchUpdated = () => {
  fetchPullRequestDetails();
};

const updateLabels = (labels: PullRequestDetailLabel[]) => {
  if (currentPullRequest.value) {
    currentPullRequest.value.labels = labels;
  }
};

const updateAssignees = (assignees: IssueAssigneeUser[], issue?: IssueAssigneeMutationResponse) => {
  if (!currentPullRequest.value) return;

  currentPullRequest.value = {
    ...currentPullRequest.value,
    ...(issue ?? {}),
    assignees,
    assignee: issue?.assignee ?? assignees[0] ?? null,
  };
};

const getPullRequestIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentPullRequest.value.number}`;
};

const hasHydratedPullRequestDetails = (
  pullRequest: PullRequestDetailViewModel | null | undefined
) => {
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

const resetPullRequestScopedState = (pullRequest: PullRequestDetailViewModel) => {
  currentPullRequest.value = pullRequest;
  detailError.value = '';
  timeline.value = [];
  repoPermissions.value = createEmptyRepoPermissions();
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;
  loadingMoreTimeline.value = false;
  isReviewWindowOpen.value = false;
  isReviewerPickerOpen.value = false;
  activePanel.value = 'conversation';
  loadingReviewerCandidates.value = false;
  submittingReviewerRequest.value = false;
  resolvingReviewThreadId.value = null;
  reviewerRequestsAvailable.value = null;
  reviewerPickerError.value = '';
  reviewerCandidates.value = [];
  reviewerCandidateWarnings.value = [];
  reviewerCandidateRequestId.value += 1;
  invalidateReviewerSummaryRequests();
  resetCompactHeader();
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

    const data = await apiFetch<PRTimelineResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/timeline`,
      {
        method: 'GET',
        query: { page: 1 },
      }
    );

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = data?.timeline || [];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
    }
  } catch (err: unknown) {
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

    const data = await apiFetch<PRTimelineResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/timeline`,
      {
        method: 'GET',
        query: { page: nextPage },
      }
    );

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = [...timeline.value, ...(data?.timeline || [])];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
      currentTimelinePage.value = nextPage;
    }
  } catch (err: unknown) {
    console.error('Error loading more PR timeline:', err);
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingMoreTimeline.value = false;
    }
  }
};

const toggleReviewThreadResolved = async (threadId: string, resolved: boolean) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || resolvingReviewThreadId.value) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  resolvingReviewThreadId.value = threadId;
  detailError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    await apiFetch(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/review-threads/${encodeURIComponent(threadId)}/resolve`,
      {
        method: 'POST',
        body: { resolved },
      }
    );

    if (pullRequestIdentity === getPullRequestIdentity()) {
      await fetchTimeline();
    }
  } catch (err: unknown) {
    console.error('Error updating pull request review thread:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      detailError.value = getFetchErrorMessage(
        err,
        resolved ? t('prReview.resolveThreadFailed') : t('prReview.unresolveThreadFailed')
      );
    }
  } finally {
    if (pullRequestIdentity === getPullRequestIdentity()) {
      resolvingReviewThreadId.value = null;
    }
  }
};

const fetchRepoPermissions = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;

  const requestId = permissionRequestId.value + 1;
  permissionRequestId.value = requestId;

  try {
    const { owner, repo } = repoInfo.value;
    const permissionData = await apiFetch<Parameters<typeof normalizeRepoPermissions>[0]>(
      `/api/repos/${owner}/${repo}/permissions`,
      {
        method: 'GET',
      }
    );

    if (requestId !== permissionRequestId.value) {
      return;
    }

    if (permissionData) {
      repoPermissions.value = normalizeRepoPermissions(permissionData);
    }
  } catch (err) {
    console.error('Error fetching repository permissions:', err);
    if (requestId === permissionRequestId.value) {
      repoPermissions.value = createEmptyRepoPermissions();
    }
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

    const data = await apiFetch<PullRequestDetailResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}`,
      {
        method: 'GET',
      }
    );

    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = createPullRequestDetailViewModel(data, {
        owner,
        repo,
        fallback: basePullRequest,
      });
      await loadReviewerSummary();
    }
  } catch (err: unknown) {
    console.error('Error fetching PR details:', err);
    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = basePullRequest;
      detailError.value = getFetchErrorMessage(err, t('detailOverlay.loadError.pullRequest'));
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
  compactHeaderSummary,
  (summary) => {
    emit('update:compact-header-summary', summary);
  },
  { immediate: true }
);

watch(
  () => props.pullRequest,
  (newPullRequest) => {
    timelineRequestId.value += 1;
    detailRequestId.value += 1;
    permissionRequestId.value += 1;
    resetPullRequestScopedState(newPullRequest);
    if (newPullRequest) {
      fetchTimeline();
      fetchRepoPermissions();
      if (hasHydratedPullRequestDetails(newPullRequest)) {
        loadReviewerSummary();
        return;
      }

      fetchPullRequestDetails();
    }
  },
  { immediate: true }
);

watch(
  () => [props.reviewActive, canOpenReviewWindow.value] as const,
  ([shouldOpenReview, canOpen]) => {
    if (shouldOpenReview && canOpen) {
      isReviewWindowOpen.value = true;
      return;
    }

    if (!shouldOpenReview) {
      isReviewWindowOpen.value = false;
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
@use '~/assets/scss/detail-sidebar-columns' as *;

.pr-detail-layout :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

@include detail-sidebar-columns('.pr-detail-layout');

.pr-detail-layout :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  min-width: 0;
}

.detail-header-boundary {
  display: flow-root;
}

.pr-detail-layout :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
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

.pr-detail-section {
  margin-top: 0.25rem;
  min-width: 0;
}

.pr-detail-tabs {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  min-width: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
}

.pr-detail-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: -1px;
  padding: 0.55rem 0.85rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover:not(.is-active) {
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: -2px;
    border-radius: 4px;
  }

  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-bottom-color: var(--gitpulse-accent, var(--gitpulse-link));
  }
}

.pr-detail-tabs__icon {
  flex-shrink: 0;
}

.pr-detail-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted, var(--gitpulse-surface-hover));
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;

  .pr-detail-tabs__tab.is-active & {
    background: color-mix(in srgb, var(--gitpulse-accent, var(--gitpulse-link)) 14%, transparent);
    color: var(--gitpulse-accent, var(--gitpulse-link));
  }
}

.pr-detail-panel {
  min-width: 0;
}

.pr-detail-panel--commits {
  padding-bottom: 2rem;
}

.pr-detail-commits-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
  padding: 0 0.35rem;
}

.pr-detail__timeline {
  padding-bottom: 1.5rem;
}

.pr-detail__merge-box {
  margin-top: 1.5rem;
  margin-bottom: 5rem;
}

/* After the base .pr-detail-layout rule so the stacking overrides win. */
@include detail-sidebar-stacking('.pr-detail-layout');
</style>
