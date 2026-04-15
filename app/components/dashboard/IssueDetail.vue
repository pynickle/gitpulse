<template>
  <SimpleBar class="detail-scroll pr-6">
    <div class="columns">
      <div class="column is-three-quarters">
        <IssueHeader :issue="currentIssue" :repo-owner="repoOwner" :repo-name="repoName" />

        <hr />

        <IssueTimelineEvents
          :timeline="timeline"
          :loading="loadingTimeline"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :issue-number="currentIssue.number"
          @switch-issue="switchToIssue"
          @switch-pull-request="switchToPullRequest"
        />
      </div>

      <div class="column is-one-quarter ml-6">
        <div class="sticky-container">
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
            @update:is-locked="updateIsLocked"
            @add-timeline-event="addTimelineEvent"
          />
        </div>
      </div>
    </div>
  </SimpleBar>
</template>

<script setup lang="ts">
import SimpleBar from 'simplebar-vue';
import { computed, ref, watch } from 'vue';

import 'simplebar-vue/dist/simplebar.min.css';
import IssueActions from '~/components/dashboard/issue/IssueActions.vue';
// Import subcomponents
import IssueHeader from '~/components/dashboard/issue/IssueHeader.vue';
import IssueLabels from '~/components/dashboard/issue/IssueLabels.vue';
import IssueTimelineEvents from '~/components/dashboard/issue/IssueTimelineEvents.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  issue: any;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:non-sticky-header', visible: boolean): void;
}>();

// State variables
const loadingTimeline = ref(false);
const loadingPermission = ref(false);
const currentIssue = ref(props.issue);
const createEmptyRepoPermissions = () => ({
  admin: false,
  maintain: false,
  push: false,
  triage: false,
  pull: false,
  canEditLabels: false,
  canLockIssue: false,
});

const repoPermissions = ref(createEmptyRepoPermissions());
const isLocked = ref(props.issue?.locked || false);
const timeline = ref<IssueTimelineItem[]>([]);
const isLabelEditorVisible = ref(false);
const timelineRequestId = ref(0);
const permissionRequestId = ref(0);

// Computed properties
const repoInfo = computed(() => {
  return parseGitHubRepoPath(currentIssue.value?.repository_url);
});

const repoOwner = computed(() => repoInfo.value?.owner);

const repoName = computed(() => repoInfo.value?.repo);

const canEditLabels = computed(() => {
  return repoPermissions.value.canEditLabels;
});

const canLockIssue = computed(() => {
  return repoPermissions.value.canLockIssue;
});

// Methods
const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const updateLabels = (labels: any[]) => {
  currentIssue.value.labels = labels;
};

const updateIsLocked = (locked: boolean) => {
  isLocked.value = locked;
};

const addTimelineEvent = (event: any) => {
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

const resetIssueScopedState = (issue: any) => {
  currentIssue.value = issue;
  timeline.value = [];
  repoPermissions.value = createEmptyRepoPermissions();
  isLocked.value = issue?.locked || false;
  isLabelEditorVisible.value = false;
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

  try {
    const { owner, repo } = repoInfo.value;
    const issueNumber = currentIssue.value.number;

    const data = await $fetch<{ timeline?: IssueTimelineItem[] }>(
      `/api/issues/${owner}/${repo}/${issueNumber}/timeline`,
      {
        method: 'GET',
      }
    );

    if (requestId === timelineRequestId.value && issueIdentity === getIssueIdentity()) {
      timeline.value = data?.timeline || [];
    }
  } catch (err: any) {
    console.error('Error fetching issue timeline:', err);
    if (requestId === timelineRequestId.value) {
      timeline.value = [];
    }
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingTimeline.value = false;
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
    const permissionData = await $fetch(`/api/repos/${owner}/${repo}/permissions`, {
      method: 'GET',
    });

    if (requestId !== permissionRequestId.value || issueIdentity !== getIssueIdentity()) return;

    repoPermissions.value = {
      admin: Boolean(permissionData?.admin),
      maintain: Boolean(permissionData?.maintain),
      push: Boolean(permissionData?.push),
      triage: Boolean(permissionData?.triage),
      pull: Boolean(permissionData?.pull),
      canEditLabels: Boolean(permissionData?.canEditLabels),
      canLockIssue: Boolean(permissionData?.canLockIssue),
    };
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

// Watch for changes in props.issue
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

useHead({
  htmlAttrs: {
    'data-color-mode': 'light',
    'data-light-theme': 'light',
  },
});
</script>

<style scoped lang="scss">
.detail-scroll {
  height: 100%;
  max-height: 100%;

  .columns {
    max-width: 100%;
  }
}

.sticky-container {
  position: sticky;
  top: 20px;
}
</style>
