<template>
  <div class="pr-detail-layout mr-6">
    <div class="columns">
      <div class="column is-three-quarters">
        <PRHeader
          :pull-request="currentPullRequest"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <hr />

        <PRTimelineEvents
          :timeline="timeline"
          :loading="loadingTimeline"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :pull-number="currentPullRequest?.number || 0"
          @switch-issue="switchToIssue"
          @switch-pull-request="switchToPullRequest"
        />
      </div>

      <div class="column is-one-quarter ml-6">
        <div class="sticky-container">
          <PRLabels :labels="currentPullRequest?.labels || []" />

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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

import PRActions from '~/components/dashboard/pr/PRActions.vue';
// Import subcomponents
import PRHeader from '~/components/dashboard/pr/PRHeader.vue';
import PRLabels from '~/components/dashboard/pr/PRLabels.vue';
import PRTimelineEvents from '~/components/dashboard/pr/PRTimelineEvents.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  pullRequest: any;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

// State variables
const loadingTimeline = ref(false);
const currentPullRequest = ref(props.pullRequest);
const timeline = ref<PRTimelineItem[]>([]);
const timelineRequestId = ref(0);
const detailRequestId = ref(0);

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

const repoOwner = computed(() => repoInfo.value?.owner || '');

const repoName = computed(() => repoInfo.value?.repo || '');

// Methods
const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const getPullRequestIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentPullRequest.value.number}`;
};

const resetPullRequestScopedState = (pullRequest: any) => {
  currentPullRequest.value = pullRequest;
  timeline.value = [];
};

const fetchTimeline = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = timelineRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  timelineRequestId.value = requestId;
  loadingTimeline.value = true;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await $fetch<{ timeline?: PRTimelineItem[] }>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/timeline`,
      {
        method: 'GET',
      }
    );

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = data?.timeline || [];
    }
  } catch (err: any) {
    console.error('Error fetching PR timeline:', err);
    if (requestId === timelineRequestId.value) {
      timeline.value = [];
    }
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingTimeline.value = false;
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
      fetchPullRequestDetails();
    }
  },
  { immediate: true }
);

useHead({
  htmlAttrs: {
    'data-color-mode': 'light',
    'data-light-theme': 'light',
  },
});
</script>

<style scoped lang="scss">
.sticky-container {
  position: sticky;
  top: 2rem;
}

.pr-detail-layout {
  min-height: 100%;
}
</style>
