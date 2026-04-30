<template>
  <span class="is-size-7">
    <a :href="item.actor?.url" target="_blank" class="has-text-weight-medium has-text-link mr-1">
      {{ item.actor?.login }}
    </a>

    <IssueTimelineReferenceEvents
      v-if="shouldRenderReferenceEvents(item)"
      :item="item"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />

    <IssueTimelineStateEvents
      v-else-if="item.eventType && stateEventTypes.has(item.eventType)"
      :item="item"
      :repo-owner="repoOwner"
      :repo-name="repoName"
    />

    <template v-else>
      {{ item.displayText || `${item.eventType || item.kind} this issue` }}
    </template>

    <span class="ml-2 has-text-grey">
      {{ formatDurationFromNow(item.createdAt || '', localeCode) }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import IssueTimelineReferenceEvents from '~/components/dashboard/issue/IssueTimelineReferenceEvents.vue';
import IssueTimelineStateEvents from '~/components/dashboard/issue/IssueTimelineStateEvents.vue';
import { type ProcessedIssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

defineProps<{
  item: ProcessedIssueTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);

const referenceEventTypes = new Set([
  'connected',
  'disconnected',
  'parent_issue_added',
  'parent_issue_removed',
  'blocking_added',
  'blocking_removed',
  'blocked_by_added',
  'blocked_by_removed',
  'cross-referenced',
  'marked_as_duplicate',
  'unmarked_as_duplicate',
  'sub_issue_added',
  'sub_issue_removed',
]);

const stateEventTypes = new Set([
  'added_to_project',
  'labeled',
  'unlabeled',
  'milestoned',
  'demilestoned',
  'locked',
  'unlocked',
  'added_to_project_v2',
  'removed_from_project',
  'removed_from_project_v2',
  'assigned',
  'unassigned',
  'closed',
  'reopened',
  'comment_deleted',
  'converted_from_draft',
  'converted_note_to_issue',
  'converted_to_discussion',
  'mentioned',
  'project_v2_item_status_changed',
  'renamed',
  'transferred',
  'user_blocked',
  'pinned',
  'unpinned',
]);

const shouldRenderReferenceEvents = (item: ProcessedIssueTimelineItem) => {
  if (!item.eventType || !referenceEventTypes.has(item.eventType)) {
    return false;
  }

  switch (item.eventType) {
    case 'connected':
    case 'disconnected':
      return Boolean(item.otherTarget);
    case 'cross-referenced':
      return Boolean(item.source);
    case 'marked_as_duplicate':
      return Boolean(item.duplicate);
    case 'sub_issue_added':
    case 'sub_issue_removed':
      return Boolean(item.subIssue);
    case 'parent_issue_added':
    case 'parent_issue_removed':
      return Boolean(item.parent);
    case 'blocking_added':
    case 'blocking_removed':
    case 'blocked_by_added':
    case 'blocked_by_removed':
      return Boolean(item.blockedIssue);
    default:
      return true;
  }
};

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>

<style scoped lang="scss"></style>
