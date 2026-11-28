<template>
  <template
    v-if="item.eventType === 'copilot_work_started' || item.eventType === 'copilot_work_finished'"
  >
    {{
      t(
        `prReview.copilot.${item.eventType === 'copilot_work_started' ? 'started' : 'finished'}${item.copilotWorkType === 'review' ? 'Review' : 'Work'}`
      )
    }}
    <template v-if="item.actor?.login">
      {{ t('prReview.copilot.onBehalfOf') }}
      <GitHubProfileLink
        :login="item.actor.login"
        :github-href="item.actor.url"
        class="pr-timeline-state__actor-link"
      >
        {{ item.actor.login }}
      </GitHubProfileLink>
    </template>
  </template>
  <template v-else-if="item.eventType === 'added_to_merge_queue'"
    >added this to merge queue</template
  >
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
    <span
      v-if="item.ref?.name"
      class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag"
      >{{ item.ref.name }}</span
    >
  </template>
  <template v-else-if="item.eventType === 'head_ref_restored'">
    restored the head branch
    <span
      v-if="item.ref?.name"
      class="gp-tag gp-tag--activity gp-tag--success pr-timeline-state__tag"
      >{{ item.ref.name }}</span
    >
  </template>
  <template v-else-if="item.eventType === 'issue_comment_pinned'">pinned a comment</template>
  <template v-else-if="item.eventType === 'issue_comment_unpinned'">unpinned a comment</template>
  <template v-else-if="item.eventType === 'issue_type_added'">updated issue type</template>
  <template v-else-if="item.eventType === 'issue_type_removed'">removed issue type</template>
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
      class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag"
    >
      {{ item.fromRepository.nameWithOwner }}
    </a>
    <span v-else class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag">
      {{ item.fromRepository?.nameWithOwner }}
    </span>
  </template>
  <template v-else-if="item.eventType === 'reopened'">reopened this PR</template>
  <template v-else-if="item.eventType === 'archived'">archived this PR</template>
  <template v-else-if="item.eventType === 'unarchived'">unarchived this PR</template>
  <template v-else-if="item.eventType === 'unpinned'">unpinned this PR</template>

  <template v-else-if="item.eventType === 'added_to_project'">
    added this to project
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.project?.name || item.projectColumnName || 'project'
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'added_to_project_v2'">
    added this to project
    <a
      :href="item.project?.url"
      target="_blank"
      rel="noopener"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
    >
      {{ item.project?.title }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'auto_merge_disabled'">
    disabled auto-merge
    <span
      v-if="item.reason || item.reasonCode"
      class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag"
      >{{ item.reason || item.reasonCode }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'automatic_base_change_succeeded'">
    Base automatically changed<template v-if="item.oldBase && item.newBase">
      from
      <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
        item.oldBase
      }}</span>
      to
      <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
        item.newBase
      }}</span>
    </template>
  </template>

  <template v-else-if="item.eventType === 'automatic_base_change_failed'">
    <template v-if="item.oldBase && item.newBase">
      Automatic base change from
      <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
        item.oldBase
      }}</span>
      to
      <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
        item.newBase
      }}</span>
      failed
    </template>
    <template v-else>Automatic base change failed</template>
  </template>

  <template
    v-else-if="item.eventType === 'added_to_stack' || item.eventType === 'removed_from_stack'"
  >
    {{
      item.eventType === 'added_to_stack'
        ? 'added this pull request to'
        : 'removed this pull request from'
    }}
    <button
      v-if="item.stackNumber"
      type="button"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag pr-timeline-state__stack"
      aria-haspopup="dialog"
      @click="emit('open-stack', item.stackNumber)"
    >
      stack #{{ item.stackNumber }}
    </button>
    <template v-else>a stack</template>
  </template>

  <template v-else-if="item.eventType === 'base_ref_changed'">
    changed base branch from
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.previousRefName
    }}</span>
    to
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.currentRefName
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'base_ref_deleted'">
    deleted the base branch
    <span
      v-if="item.baseRefName"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
      >{{ item.baseRefName }}</span
    >
  </template>

  <template
    v-else-if="
      item.eventType === 'base_ref_force_pushed' || item.eventType === 'head_ref_force_pushed'
    "
  >
    <i18n-t :keypath="forcePushKeypath" tag="span">
      <template v-if="item.ref?.name" #branch>
        <span class="gp-tag gp-tag--activity gp-tag--info">{{ item.ref.name }}</span>
      </template>
      <template v-if="item.beforeCommit?.oid" #from>
        <span class="gp-tag gp-tag--activity gp-tag--warning">{{
          item.beforeCommit.oid.slice(0, 7)
        }}</span>
      </template>
      <template v-if="item.afterCommit?.oid" #to>
        <span class="gp-tag gp-tag--activity gp-tag--success">{{
          item.afterCommit.oid.slice(0, 7)
        }}</span>
      </template>
    </i18n-t>
  </template>

  <template v-else-if="item.eventType === 'closed'">
    closed this PR
    <span
      v-if="item.stateReason"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
      >{{ item.stateReason }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'comment_deleted'">
    deleted a comment by
    <GitHubProfileLink
      :login="item.deletedCommentAuthor?.login"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
    >
      {{ item.deletedCommentAuthor?.login }}
    </GitHubProfileLink>
  </template>

  <template v-else-if="item.eventType === 'converted_to_discussion'">
    converted this to a discussion
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.discussion?.title
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'demilestoned' || item.eventType === 'milestoned'">
    {{
      item.eventType === 'demilestoned'
        ? 'removed this PR from milestone'
        : 'added this PR to milestone'
    }}
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.milestoneTitle
    }}</span>
  </template>

  <template
    v-else-if="item.eventType === 'deployed' || item.eventType === 'deployment_environment_changed'"
  >
    {{ item.eventType === 'deployed' ? 'deployed to' : 'changed deployment environment to' }}
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
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
    <span
      v-if="item.issueField?.name"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
      >{{ item.issueField.name }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'issue_type_changed'">
    changed issue type from {{ item.prevIssueType?.name }} to {{ item.issueType?.name }}
  </template>

  <template v-else-if="item.eventType === 'assigned' || item.eventType === 'unassigned'">
    {{ item.displayText || assigneePrefix }}
  </template>

  <template v-else-if="item.eventType === 'assignees_changed'">
    <template v-if="assigneeChanges.length">
      <template
        v-for="(change, index) in assigneeChanges"
        :key="`${change.action}-${change.value}-${index}`"
      >
        <template v-if="item.hasMixedActors">
          <GitHubProfileLink
            :login="change.actor?.login"
            :github-href="change.actor?.url"
            class="pr-timeline-state__actor"
            :class="{ 'pr-timeline-state__actor--link': change.actor?.login || change.actor?.url }"
          >
            {{ timelineChangeActorLabel(change) }}
          </GitHubProfileLink>
        </template>
        {{ change.action }}
        <GitHubProfileLink
          :login="change.assignee?.login"
          :github-href="change.assignee?.url"
          class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
        >
          {{ assigneeChangeLabel(change) }}
        </GitHubProfileLink>
        {{
          index === assigneeChanges.length - 2
            ? ' and '
            : index < assigneeChanges.length - 2
              ? ', '
              : ''
        }}
      </template>
    </template>
    <template v-else>{{ item.displayText }}</template>
  </template>

  <template v-else-if="item.eventType === 'labeled' || item.eventType === 'unlabeled'">
    {{ item.eventType === 'labeled' ? 'added label' : 'removed label' }}
    <span
      class="gp-tag gp-tag--activity pr-timeline-state__tag pr-timeline-state__label-tag"
      :style="labelStyle(item.label?.color)"
    >
      {{ item.label?.name }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'labels_changed'">
    <template v-if="labelChanges.length">
      <template
        v-for="(change, index) in labelChanges"
        :key="`${change.action}-${change.value}-${index}`"
      >
        <template v-if="item.hasMixedActors">
          <GitHubProfileLink
            :login="change.actor?.login"
            :github-href="change.actor?.url"
            class="pr-timeline-state__actor"
            :class="{ 'pr-timeline-state__actor--link': change.actor?.login || change.actor?.url }"
          >
            {{ timelineChangeActorLabel(change) }}
          </GitHubProfileLink>
        </template>
        {{ change.action }}
        <span
          class="gp-tag gp-tag--activity pr-timeline-state__tag pr-timeline-state__label-tag"
          :style="labelStyle(change.label?.color)"
        >
          {{ labelChangeLabel(change) }}
        </span>
        {{
          index === labelChanges.length - 2 ? ' and ' : index < labelChanges.length - 2 ? ', ' : ''
        }}
      </template>
    </template>
    <template v-else>{{ item.displayText }}</template>
  </template>

  <template v-else-if="item.eventType === 'locked' || item.eventType === 'unlocked'">
    {{ item.eventType === 'locked' ? 'locked this PR' : 'unlocked this PR' }}
    <span
      v-if="item.lockReason"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
      >{{ item.lockReason }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'merged'"> merged this PR </template>

  <template v-else-if="item.eventType === 'moved_columns_in_project'">
    moved this from column
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.previousProjectColumnName
    }}</span>
    to
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.projectColumnName
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'project_v2_item_status_changed'">
    changed status from
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.previousStatus
    }}</span>
    to
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.status
    }}</span>
  </template>

  <template
    v-else-if="item.eventType === 'commit_commented' || item.eventType === 'line_commented'"
  >
    {{ threadPrefix }}
    <span v-if="item.path" class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.path
    }}</span>
    <span
      v-if="item.eventType === 'line_commented' && item.isOutdated"
      class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag"
      >{{ t('prReview.threadOutdated') }}</span
    >
  </template>

  <template v-else-if="item.eventType === 'removed_from_merge_queue'">
    removed this from merge queue
    <span
      v-if="item.reason"
      class="gp-tag gp-tag--activity gp-tag--warning pr-timeline-state__tag"
      >{{ item.reason }}</span
    >
  </template>

  <template
    v-else-if="
      item.eventType === 'removed_from_project' || item.eventType === 'removed_from_project_v2'
    "
  >
    removed this from project
    <span class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag">{{
      item.project?.name || item.projectColumnName || item.project?.title
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'review_dismissed'">
    dismissed review by
    <GitHubProfileLink
      :login="item.review?.author?.login"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
    >
      {{ item.review?.author?.login }}
    </GitHubProfileLink>
  </template>

  <template
    v-else-if="item.eventType === 'review_request_removed' || item.eventType === 'review_requested'"
  >
    {{
      item.eventType === 'review_requested' ? 'requested review from' : 'removed review request for'
    }}
    <GitHubProfileLink
      v-if="reviewer?.login || reviewer?.url"
      :login="reviewer.login"
      :github-href="reviewer.url"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
    >
      {{ reviewer.label }}
    </GitHubProfileLink>
  </template>

  <template v-else-if="item.eventType === 'user_blocked'">
    blocked user
    <GitHubProfileLink
      :login="item.subject?.login"
      class="gp-tag gp-tag--activity gp-tag--info pr-timeline-state__tag"
    >
      {{ item.subject?.login }}
    </GitHubProfileLink>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import {
  describeRequestedReviewer,
  type PRTimelineItem,
  type TimelineStateChange,
} from '~/composables/usePRTimelineEvents';
import { getTextColorFromBackground } from '~/utils/getTextColorFromBackground';

const { item } = defineProps<{
  item: PRTimelineItem;
}>();

const emit = defineEmits<{
  'open-stack': [stackNumber: number];
}>();

const { t } = useI18n();
const reviewer = computed(() => describeRequestedReviewer(item.requestedReviewer));
const assigneeChanges = computed(() => item.assigneeChanges ?? []);
const labelChanges = computed(() => item.labelChanges ?? []);

const forcePushKeypath = computed(() => {
  const hasCommits = Boolean(item.beforeCommit?.oid && item.afterCommit?.oid);
  if (item.ref?.name) {
    return hasCommits ? 'timeline.forcePushedNamedWithCommits' : 'timeline.forcePushedNamed';
  }
  if (item.eventType === 'base_ref_force_pushed') {
    return hasCommits ? 'timeline.forcePushedBaseWithCommits' : 'timeline.forcePushedBase';
  }
  return hasCommits ? 'timeline.forcePushedHeadWithCommits' : 'timeline.forcePushedHead';
});

const issueFieldPrefix = computed(() => {
  switch (item.eventType) {
    case 'issue_field_added':
      return 'added a project field value';
    case 'issue_field_changed':
      return 'changed a project field value';
    default:
      return 'removed a project field value';
  }
});

const assigneePrefix = computed(() => (item.eventType === 'assigned' ? 'assigned' : 'unassigned'));

const threadPrefix = computed(() => {
  if (item.eventType === 'commit_commented') {
    return 'commented on a commit thread';
  }

  return `${item.isResolved ? 'resolved' : 'unresolved'} a review thread`;
});

const labelStyle = (color?: string) => {
  if (!color) return undefined;

  return {
    backgroundColor: `#${color}`,
    color: `#${getTextColorFromBackground(color)}`,
  };
};

const assigneeChangeLabel = (change: TimelineStateChange) =>
  change.assignee?.login || change.assignee?.name || change.value;

const labelChangeLabel = (change: TimelineStateChange) => change.label?.name || change.value;

const timelineChangeActorLabel = (change: TimelineStateChange) =>
  change.actor?.login || change.actor?.name || '';
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-timeline-state__tag {
  margin-left: 0.25rem;
}

.pr-timeline-state__stack {
  font-family: inherit;
  cursor: pointer;

  @include hover-only {
    &:hover {
      text-decoration: underline;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.pr-timeline-state__label-tag {
  font-weight: 500;
}

.pr-timeline-state__actor-link {
  color: var(--gitpulse-link);
  font-weight: 500;
}

.pr-timeline-state__actor {
  margin-right: 0.25rem;
  font-weight: 500;

  &--link {
    color: var(--gitpulse-link);
  }
}
</style>
