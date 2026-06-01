<template>
  <span class="is-size-7">
    <a
      :href="item.actor?.url"
      target="_blank"
      rel="noopener"
      class="has-text-weight-medium has-text-link mr-1"
    >
      {{ item.actor?.login }}
    </a>

    <PRTimelineReferenceEvents
      v-if="shouldRenderReferenceEvents(item)"
      :item="item"
      :repo-full-name="repoFullName"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />

    <PRTimelineStateEvents
      v-else-if="item.eventType && stateEventTypes.has(item.eventType)"
      :item="item"
    />

    <template v-else> {{ item.displayText || `${item.eventType || item.kind} this PR` }} </template>

    <span class="ml-2 has-text-grey">{{ formatDurationFromNow(eventDate, localeCode) }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import PRTimelineReferenceEvents from '~/components/dashboard/pr/PRTimelineReferenceEvents.vue';
import PRTimelineStateEvents from '~/components/dashboard/pr/PRTimelineStateEvents.vue';
import { type PRTimelineItem } from '~/composables/usePRTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

const props = defineProps<{
  item: PRTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const repoFullName = computed(() => `${props.repoOwner}/${props.repoName}`);
const eventDate = computed(() => props.item.createdAt || props.item.commit?.committedDate || '');

const referenceEventTypes = new Set([
  'blocked_by_added',
  'blocked_by_removed',
  'blocking_added',
  'blocking_removed',
  'connected',
  'disconnected',
  'cross-referenced',
  'marked_as_duplicate',
  'unmarked_as_duplicate',
  'parent_issue_added',
  'parent_issue_removed',
  'sub_issue_added',
  'sub_issue_removed',
  'referenced',
]);

const stateEventTypes = new Set([
  'added_to_merge_queue',
  'added_to_project',
  'added_to_project_v2',
  'auto_merge_disabled',
  'auto_merge_enabled',
  'auto_rebase_enabled',
  'auto_squash_enabled',
  'automatic_base_change_failed',
  'automatic_base_change_succeeded',
  'base_ref_changed',
  'base_ref_deleted',
  'base_ref_force_pushed',
  'closed',
  'comment_deleted',
  'convert_to_draft',
  'converted_from_draft',
  'converted_note_to_issue',
  'converted_to_discussion',
  'demilestoned',
  'deployed',
  'deployment_environment_changed',
  'head_ref_deleted',
  'head_ref_force_pushed',
  'head_ref_restored',
  'issue_comment_pinned',
  'issue_comment_unpinned',
  'issue_field_added',
  'issue_field_changed',
  'issue_field_removed',
  'issue_type_added',
  'issue_type_changed',
  'issue_type_removed',
  'labeled',
  'locked',
  'mentioned',
  'merged',
  'milestoned',
  'moved_columns_in_project',
  'pinned',
  'pull_request_revision_marker',
  'project_v2_item_status_changed',
  'ready_for_review',
  'referenced',
  'removed_from_merge_queue',
  'removed_from_project',
  'removed_from_project_v2',
  'renamed',
  'reopened',
  'review_dismissed',
  'review_request_removed',
  'review_requested',
  'unlabeled',
  'unlocked',
  'unpinned',
  'user_blocked',
]);

const shouldRenderReferenceEvents = (item: PRTimelineItem) => {
  if (!item.eventType || !referenceEventTypes.has(item.eventType)) {
    return false;
  }

  switch (item.eventType) {
    case 'connected':
    case 'disconnected':
    case 'cross-referenced':
      return Boolean(item.source);
    case 'marked_as_duplicate':
    case 'unmarked_as_duplicate':
      return Boolean(item.duplicate);
    case 'parent_issue_added':
    case 'parent_issue_removed':
      return Boolean(item.parent);
    case 'sub_issue_added':
    case 'sub_issue_removed':
      return Boolean(item.subIssue);
    case 'blocking_added':
    case 'blocking_removed':
      return Boolean(item.blockedIssue);
    case 'blocked_by_added':
    case 'blocked_by_removed':
      return Boolean(item.blockingIssue);
    case 'referenced':
      return Boolean(item.commit?.oid || item.commit?.commitUrl);
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

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
