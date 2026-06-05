<template>
  <template v-if="item.eventType === 'added_to_merge_queue'">added this to merge queue</template>
  <template v-else-if="item.eventType === 'auto_merge_enabled'">enabled auto-merge</template>
  <template v-else-if="item.eventType === 'auto_rebase_enabled'">enabled auto-rebase</template>
  <template v-else-if="item.eventType === 'auto_squash_enabled'">enabled auto-squash</template>
  <template v-else-if="item.eventType === 'convert_to_draft'">converted this to draft</template>
  <template v-else-if="item.eventType === 'converted_from_draft'"
    >converted this from draft</template
  >
  <template v-else-if="item.eventType === 'converted_note_to_issue'"
    >converted this from a note</template
  >
  <template v-else-if="item.eventType === 'head_ref_deleted'">
    deleted the head branch
    <span v-if="item.ref?.name" class="tag is-activity ml-1 is-warning is-light">{{
      item.ref.name
    }}</span>
  </template>
  <template v-else-if="item.eventType === 'head_ref_restored'">
    restored the head branch
    <span v-if="item.ref?.name" class="tag is-activity ml-1 is-success is-light">{{
      item.ref.name
    }}</span>
  </template>
  <template v-else-if="item.eventType === 'issue_comment_pinned'">pinned a comment</template>
  <template v-else-if="item.eventType === 'issue_comment_unpinned'">unpinned a comment</template>
  <template v-else-if="item.eventType === 'issue_type_added'">updated issue type</template>
  <template v-else-if="item.eventType === 'issue_type_removed'">removed issue type</template>
  <template v-else-if="item.eventType === 'mentioned'">mentioned this PR</template>
  <template v-else-if="item.eventType === 'pinned'">pinned this PR</template>
  <template v-else-if="item.eventType === 'pull_request_revision_marker'"
    >marked a review revision</template
  >
  <template v-else-if="item.eventType === 'ready_for_review'"
    >marked this as ready for review</template
  >
  <template v-else-if="item.eventType === 'transferred'">
    transferred this from
    <a
      v-if="item.fromRepository?.url"
      :href="item.fromRepository.url"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-warning is-light"
    >
      {{ item.fromRepository.nameWithOwner }}
    </a>
    <span v-else class="tag is-activity ml-1 is-warning is-light">
      {{ item.fromRepository?.nameWithOwner }}
    </span>
  </template>
  <template v-else-if="item.eventType === 'reopened'">reopened this PR</template>
  <template v-else-if="item.eventType === 'unpinned'">unpinned this PR</template>

  <template v-else-if="item.eventType === 'added_to_project'">
    added this to project
    <span class="tag is-activity ml-1 is-info is-light">{{
      item.project?.name || item.projectColumnName || 'project'
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'added_to_project_v2'">
    added this to project
    <a
      :href="item.project?.url"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.project?.title }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'auto_merge_disabled'">
    disabled auto-merge
    <span v-if="item.reason || item.reasonCode" class="tag is-activity ml-1 is-warning is-light">{{
      item.reason || item.reasonCode
    }}</span>
  </template>

  <template
    v-else-if="
      item.eventType === 'automatic_base_change_failed' ||
      item.eventType === 'automatic_base_change_succeeded'
    "
  >
    {{
      item.eventType === 'automatic_base_change_failed'
        ? 'automatic base change failed from'
        : 'automatic base change succeeded from'
    }}
    {{ item.oldBase }}
    <span v-if="item.newBase" class="tag is-activity ml-1 is-info is-light"
      >to {{ item.newBase }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'base_ref_changed'">
    changed base branch from
    <span class="tag is-activity ml-1 is-info is-light">{{ item.previousRefName }}</span>
    to
    <span class="tag is-activity ml-1 is-info is-light">{{ item.currentRefName }}</span>
  </template>

  <template v-else-if="item.eventType === 'base_ref_deleted'">
    deleted the base branch
    <span v-if="item.baseRefName" class="tag is-activity ml-1 is-info is-light">{{
      item.baseRefName
    }}</span>
  </template>

  <template
    v-else-if="
      item.eventType === 'base_ref_force_pushed' || item.eventType === 'head_ref_force_pushed'
    "
  >
    {{
      item.eventType === 'base_ref_force_pushed'
        ? 'force-pushed the base branch'
        : 'force-pushed the head branch'
    }}
    <span v-if="item.ref?.name" class="tag is-activity ml-1 is-info is-light">{{
      item.ref.name
    }}</span>
    <span v-if="item.beforeCommit?.oid" class="tag is-activity ml-1 is-warning is-light">
      {{ item.beforeCommit.oid.slice(0, 7) }}
    </span>
    <span v-if="item.afterCommit?.oid" class="tag is-activity ml-1 is-success is-light">
      {{ item.afterCommit.oid.slice(0, 7) }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'closed'">
    closed this PR
    <span v-if="item.stateReason" class="tag is-activity ml-1 is-info is-light">{{
      item.stateReason
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'comment_deleted'">
    deleted a comment by
    <a
      :href="`https://github.com/${item.deletedCommentAuthor?.login}`"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.deletedCommentAuthor?.login }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'converted_to_discussion'">
    converted this to a discussion
    <span class="tag is-activity ml-1 is-info is-light">{{ item.discussion?.title }}</span>
  </template>

  <template v-else-if="item.eventType === 'demilestoned' || item.eventType === 'milestoned'">
    {{
      item.eventType === 'demilestoned'
        ? 'removed this PR from milestone'
        : 'added this PR to milestone'
    }}
    <span class="tag is-activity ml-1 is-info is-light">{{ item.milestoneTitle }}</span>
  </template>

  <template
    v-else-if="item.eventType === 'deployed' || item.eventType === 'deployment_environment_changed'"
  >
    {{ item.eventType === 'deployed' ? 'deployed to' : 'changed deployment environment to' }}
    <span class="tag is-activity ml-1 is-info is-light">{{
      item.deployment?.environment || item.deploymentStatus?.environment
    }}</span>
  </template>

  <template
    v-else-if="
      item.eventType === 'issue_field_added' ||
      item.eventType === 'issue_field_changed' ||
      item.eventType === 'issue_field_removed'
    "
  >
    {{ issueFieldPrefix }}
    <span v-if="item.issueField?.name" class="tag is-activity ml-1 is-info is-light">{{
      item.issueField.name
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'issue_type_changed'">
    changed issue type from {{ item.prevIssueType?.name }} to {{ item.issueType?.name }}
  </template>

  <template v-else-if="item.eventType === 'labeled' || item.eventType === 'unlabeled'">
    {{ item.eventType === 'labeled' ? 'added label' : 'removed label' }}
    <span
      class="tag is-activity ml-1 has-text-weight-medium"
      :style="labelStyle(item.label?.color)"
    >
      {{ item.label?.name }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'locked' || item.eventType === 'unlocked'">
    {{ item.eventType === 'locked' ? 'locked this PR' : 'unlocked this PR' }}
    <span v-if="item.lockReason" class="tag is-activity ml-1 is-info is-light">{{
      item.lockReason
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'merged'"> merged this PR </template>

  <template v-else-if="item.eventType === 'moved_columns_in_project'">
    moved this from column
    <span class="tag is-activity ml-1 is-info is-light">{{ item.previousProjectColumnName }}</span>
    to
    <span class="tag is-activity ml-1 is-info is-light">{{ item.projectColumnName }}</span>
  </template>

  <template v-else-if="item.eventType === 'project_v2_item_status_changed'">
    changed status from
    <span class="tag is-activity ml-1 is-info is-light">{{ item.previousStatus }}</span>
    to
    <span class="tag is-activity ml-1 is-info is-light">{{ item.status }}</span>
  </template>

  <template
    v-else-if="item.eventType === 'commit_commented' || item.eventType === 'line_commented'"
  >
    {{ threadPrefix }}
    <span v-if="item.path" class="tag is-activity ml-1 is-info is-light">{{ item.path }}</span>
    <span
      v-if="item.eventType === 'line_commented' && item.isOutdated"
      class="tag is-activity ml-1 is-warning is-light"
      >{{ t('prReview.threadOutdated') }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'removed_from_merge_queue'">
    removed this from merge queue
    <span v-if="item.reason" class="tag is-activity ml-1 is-warning is-light">{{
      item.reason
    }}</span>
  </template>

  <template
    v-else-if="
      item.eventType === 'removed_from_project' || item.eventType === 'removed_from_project_v2'
    "
  >
    removed this from project
    <span class="tag is-activity ml-1 is-info is-light">{{
      item.project?.name || item.projectColumnName || item.project?.title
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'renamed'">
    renamed this from
    <span class="tag is-activity ml-1 is-info is-light">{{ item.previousTitle }}</span>
    to
    <span class="tag is-activity ml-1 is-info is-light">{{ item.currentTitle }}</span>
  </template>

  <template v-else-if="item.eventType === 'review_dismissed'">
    dismissed review by
    <a
      :href="`https://github.com/${item.review?.author?.login}`"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.review?.author?.login }}
    </a>
  </template>

  <template
    v-else-if="item.eventType === 'review_request_removed' || item.eventType === 'review_requested'"
  >
    {{ item.eventType === 'review_requested' ? 'requested review' : 'removed review request' }}
    <a
      v-if="reviewerUrl"
      :href="reviewerUrl"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ reviewerLabel }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'user_blocked'">
    blocked user
    <a
      :href="`https://github.com/${item.subject?.login}`"
      target="_blank"
      rel="noopener"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.subject?.login }}
    </a>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
  getRequestedReviewerLabel,
  getRequestedReviewerUrl,
  type PRTimelineItem,
} from '~/composables/usePRTimelineEvents';
import getTextColorFromBackground from '~/utils/getTextColorFromBackground';

const props = defineProps<{
  item: PRTimelineItem;
}>();

const { t } = useI18n();
const reviewerUrl = computed(() => getRequestedReviewerUrl(props.item.requestedReviewer));
const reviewerLabel = computed(() => getRequestedReviewerLabel(props.item.requestedReviewer));

const issueFieldPrefix = computed(() => {
  switch (props.item.eventType) {
    case 'issue_field_added':
      return 'added a project field value';
    case 'issue_field_changed':
      return 'changed a project field value';
    default:
      return 'removed a project field value';
  }
});

const threadPrefix = computed(() => {
  if (props.item.eventType === 'commit_commented') {
    return 'commented on a commit thread';
  }

  return `${props.item.isResolved ? 'resolved' : 'unresolved'} a review thread`;
});

const labelStyle = (color?: string) => {
  if (!color) return undefined;

  return {
    backgroundColor: `#${color}`,
    color: `#${getTextColorFromBackground(color)}`,
  };
};
</script>

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
