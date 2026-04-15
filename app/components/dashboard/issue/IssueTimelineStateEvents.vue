<template>
  <template v-if="item.eventType === 'labeled' || item.eventType === 'unlabeled'">
    {{ item.eventType === 'labeled' ? 'added label' : 'removed label' }}
    <span class="tag is-activity ml-1" :style="labelStyle(item.label?.color)">
      {{ item.label?.name }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'milestoned' || item.eventType === 'demilestoned'">
    {{
      item.eventType === 'milestoned'
        ? 'added this issue to milestone'
        : 'removed this issue from milestone'
    }}
    <a
      :href="`https://github.com/${repoOwner}/${repoName}/milestone/${item.milestoneTitle}`"
      target="_blank"
      class="tag is-activity ml-1 is-primary is-light"
    >
      {{ item.milestoneTitle }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'locked' || item.eventType === 'unlocked'">
    {{ item.eventType === 'locked' ? 'locked this issue' : 'unlocked this issue' }}
    <span v-if="formatLockReason(item.lockReason)" class="tag is-activity ml-1 is-danger is-light">
      {{ formatLockReason(item.lockReason) }}
    </span>
  </template>

  <template v-else-if="item.eventType && projectEventTypes.has(item.eventType)">
    {{
      addedProjectEventTypes.has(item.eventType)
        ? 'added this to project'
        : 'removed this from project'
    }}
    <a
      v-if="item.project?.url"
      :href="item.project.url"
      target="_blank"
      class="tag is-activity ml-1 is-link is-light"
    >
      {{ item.project?.title }}
    </a>
    <span v-else class="tag is-activity ml-1 is-link is-light">
      {{ item.project?.title || item.project?.name || item.projectColumnName || 'Project' }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'assigned' || item.eventType === 'unassigned'">
    {{ item.eventType === 'assigned' ? 'assigned this to' : 'unassigned this from' }}
    <a
      :href="`https://github.com/${item.assignee?.login}`"
      target="_blank"
      class="tag is-activity ml-1 is-warning is-light"
    >
      {{ item.assignee?.login }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'closed'">
    closed this issue
    <span
      v-if="formatStateReason(item.stateReason)"
      :class="['tag', 'is-activity', 'ml-1', getStateReasonClass(item.stateReason), 'is-light']"
    >
      {{ formatStateReason(item.stateReason) }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'reopened'">reopened this issue</template>

  <template v-else-if="item.eventType === 'comment_deleted'">
    deleted a comment by
    <a
      :href="`https://github.com/${item.deletedCommentAuthor?.login}`"
      target="_blank"
      class="tag is-activity ml-1 is-warning is-light"
    >
      {{ item.deletedCommentAuthor?.login }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'converted_from_draft'"
    >converted this from a draft issue</template
  >
  <template v-else-if="item.eventType === 'converted_note_to_issue'"
    >converted this from a note</template
  >

  <template v-else-if="item.eventType === 'converted_to_discussion'">
    converted this to a discussion
    <span class="tag is-activity ml-1 is-black is-light">{{ item.discussion?.title }}</span>
  </template>

  <template v-else-if="item.eventType === 'unmarked_as_duplicate'"
    >unmarked this as duplicate</template
  >
  <template v-else-if="item.eventType === 'mentioned'">mentioned this issue</template>

  <template v-else-if="item.eventType === 'project_v2_item_status_changed'">
    <template v-if="item.previousStatus && item.status">
      changed status in
      <ProjectTag :project="item.project" />
      from
      <span class="tag is-activity ml-1 is-warning is-light">{{ item.previousStatus }}</span>
      to
      <span class="tag is-activity ml-1 is-success is-light">{{ item.status }}</span>
    </template>
    <template v-else-if="item.status">
      set status in
      <ProjectTag :project="item.project" />
      to
      <span class="tag is-activity ml-1 is-success is-light">{{ item.status }}</span>
    </template>
    <template v-else-if="item.previousStatus">
      removed status in
      <ProjectTag :project="item.project" />
      from
      <span class="tag is-activity ml-1 is-warning is-light">{{ item.previousStatus }}</span>
    </template>
    <template v-else>
      updated project status in
      <ProjectTag :project="item.project" fallback-title="Project" />
    </template>
  </template>

  <template v-else-if="item.eventType === 'moved_columns_in_project'">
    moved this from
    <span v-if="item.previousProjectColumnName" class="tag is-activity ml-1 is-warning is-light">
      {{ item.previousProjectColumnName }}
    </span>
    to
    <span class="tag is-activity ml-1 is-success is-light">
      {{ item.projectColumnName || 'column' }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'renamed'">
    renamed this from
    <span class="tag is-activity ml-1 is-warning is-light">{{ item.previousTitle }}</span>
    to
    <span class="tag is-activity ml-1 is-success is-light">{{ item.currentTitle }}</span>
  </template>

  <template v-else-if="item.eventType === 'subscribed'">subscribed to this issue</template>
  <template v-else-if="item.eventType === 'unsubscribed'">unsubscribed from this issue</template>

  <template v-else-if="item.eventType === 'transferred'">
    transferred this from
    <a
      v-if="item.fromRepository?.url"
      :href="item.fromRepository.url"
      target="_blank"
      class="tag is-activity ml-1 is-warning is-light"
    >
      {{ item.fromRepository.nameWithOwner }}
    </a>
    <span v-else class="tag is-activity ml-1 is-warning is-light">{{
      item.fromRepository?.nameWithOwner
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'user_blocked'">
    blocked user
    <a :href="item.subject?.url" target="_blank" class="tag is-activity ml-1 is-warning is-light">
      {{ item.subject?.login }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'pinned' || item.eventType === 'unpinned'">
    {{ item.eventType === 'pinned' ? 'pinned this issue' : 'unpinned this issue' }}
  </template>
</template>

<script setup lang="ts">
import ProjectTag from '~/components/dashboard/timeline/ProjectTag.vue';
import type { ProcessedIssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import {
  formatLockReason,
  formatStateReason,
  getStateReasonClass,
} from '~/composables/useIssueTimelineEvents';
import getTextColorFromBackground from '~/utils/getTextColorFromBackground';

defineProps<{
  item: ProcessedIssueTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const labelStyle = (color?: string) => {
  if (!color) return undefined;

  return {
    backgroundColor: `#${color}`,
    color: `#${getTextColorFromBackground(color)}`,
  };
};

const projectEventTypes = new Set([
  'added_to_project',
  'added_to_project_v2',
  'removed_from_project',
  'removed_from_project_v2',
]);

const addedProjectEventTypes = new Set(['added_to_project', 'added_to_project_v2']);
</script>

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
