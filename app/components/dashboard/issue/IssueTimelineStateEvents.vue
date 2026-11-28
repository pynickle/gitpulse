<template>
  <template v-if="item.eventType === 'labeled' || item.eventType === 'unlabeled'">
    {{ item.eventType === 'labeled' ? 'added label' : 'removed label' }}
    <span class="gp-tag gp-tag--activity" :style="labelStyle(item.label?.color)">
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
            class="timeline-state-actor"
            :class="{ 'timeline-state-actor--link': change.actor?.login || change.actor?.url }"
          >
            {{ timelineChangeActorLabel(change) }}
          </GitHubProfileLink>
        </template>
        {{ change.action }}
        <span class="gp-tag gp-tag--activity" :style="labelStyle(change.label?.color)">
          {{ labelChangeLabel(change) }}
        </span>
        {{
          index === labelChanges.length - 2 ? ' and ' : index < labelChanges.length - 2 ? ', ' : ''
        }}
      </template>
    </template>
    <template v-else>{{ item.displayText }}</template>
  </template>

  <template v-else-if="item.eventType === 'issue_type_added'">
    added issue type
    <span
      v-if="item.issueType?.name"
      class="gp-tag gp-tag--activity issue-type-tag"
      :style="issueTypeTagStyle(item.issueType.color)"
    >
      {{ item.issueType.name }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'issue_type_changed'">
    changed issue type
    <template v-if="item.prevIssueType?.name">
      from
      <span
        class="gp-tag gp-tag--activity issue-type-tag"
        :style="issueTypeTagStyle(item.prevIssueType.color)"
      >
        {{ item.prevIssueType.name }}
      </span>
    </template>
    <template v-if="item.issueType?.name">
      to
      <span
        class="gp-tag gp-tag--activity issue-type-tag"
        :style="issueTypeTagStyle(item.issueType.color)"
      >
        {{ item.issueType.name }}
      </span>
    </template>
  </template>

  <template v-else-if="item.eventType === 'issue_type_removed'">
    removed issue type
    <span
      v-if="item.issueType?.name"
      class="gp-tag gp-tag--activity issue-type-tag"
      :style="issueTypeTagStyle(item.issueType.color)"
    >
      {{ item.issueType.name }}
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
      rel="noopener"
      class="gp-tag gp-tag--activity gp-tag--primary"
    >
      {{ item.milestoneTitle }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'locked' || item.eventType === 'unlocked'">
    {{ item.eventType === 'locked' ? 'locked this issue' : 'unlocked this issue' }}
    <span v-if="formatLockReason(item.lockReason)" class="gp-tag gp-tag--activity gp-tag--danger">
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
      rel="noopener"
      class="gp-tag gp-tag--activity gp-tag--link"
    >
      {{ item.project?.title }}
    </a>
    <span v-else class="gp-tag gp-tag--activity gp-tag--link">
      {{
        item.project?.title ||
        item.project?.name ||
        item.projectColumnName ||
        t('issueDetail.projectFallback')
      }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'assigned' || item.eventType === 'unassigned'">
    <template v-if="item.displayText">{{ item.displayText }}</template>
    <template v-else>
      {{ assigneePrefix }}
      <GitHubProfileLink
        v-if="assigneeLabel || item.assignee?.url"
        :login="item.assignee?.login"
        :github-href="item.assignee?.url"
        class="gp-tag gp-tag--activity gp-tag--warning"
      >
        {{ assigneeLabel }}
      </GitHubProfileLink>
    </template>
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
            class="timeline-state-actor"
            :class="{ 'timeline-state-actor--link': change.actor?.login || change.actor?.url }"
          >
            {{ timelineChangeActorLabel(change) }}
          </GitHubProfileLink>
        </template>
        {{ change.action }}
        <GitHubProfileLink
          :login="change.assignee?.login"
          :github-href="change.assignee?.url"
          class="gp-tag gp-tag--activity gp-tag--warning"
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

  <template v-else-if="item.eventType === 'closed'">
    closed this issue
    <span
      v-if="formatStateReason(item.stateReason)"
      :class="['gp-tag', 'gp-tag--activity', getStateReasonClass(item.stateReason)]"
    >
      {{ formatStateReason(item.stateReason) }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'reopened'">reopened this issue</template>

  <template v-else-if="item.eventType === 'comment_deleted'">
    deleted a comment by
    <GitHubProfileLink
      :login="item.deletedCommentAuthor?.login"
      class="gp-tag gp-tag--activity gp-tag--warning"
    >
      {{ item.deletedCommentAuthor?.login }}
    </GitHubProfileLink>
  </template>

  <template v-else-if="item.eventType === 'converted_from_draft'"
    >converted this from a draft issue</template
  >
  <template v-else-if="item.eventType === 'converted_note_to_issue'"
    >converted this from a note</template
  >

  <template v-else-if="item.eventType === 'converted_to_discussion'">
    converted this to a discussion
    <span class="gp-tag gp-tag--activity gp-tag--raised">{{ item.discussion?.title }}</span>
  </template>

  <template v-else-if="item.eventType === 'unmarked_as_duplicate'"
    >unmarked this as duplicate</template
  >

  <template v-else-if="item.eventType === 'project_v2_item_status_changed'">
    <template v-if="item.previousStatus && item.status">
      changed status in
      <ProjectTag :project="item.project" />
      from
      <span class="gp-tag gp-tag--activity gp-tag--warning">{{ item.previousStatus }}</span>
      to
      <span class="gp-tag gp-tag--activity gp-tag--success">{{ item.status }}</span>
    </template>
    <template v-else-if="item.status">
      set status in
      <ProjectTag :project="item.project" />
      to
      <span class="gp-tag gp-tag--activity gp-tag--success">{{ item.status }}</span>
    </template>
    <template v-else-if="item.previousStatus">
      removed status in
      <ProjectTag :project="item.project" />
      from
      <span class="gp-tag gp-tag--activity gp-tag--warning">{{ item.previousStatus }}</span>
    </template>
    <template v-else>
      updated project status in
      <ProjectTag :project="item.project" :fallback-title="t('issueDetail.projectFallback')" />
    </template>
  </template>

  <template v-else-if="item.eventType === 'moved_columns_in_project'">
    moved this from
    <span v-if="item.previousProjectColumnName" class="gp-tag gp-tag--activity gp-tag--warning">
      {{ item.previousProjectColumnName }}
    </span>
    to
    <span class="gp-tag gp-tag--activity gp-tag--success">
      {{ item.projectColumnName || t('issueDetail.projectColumnFallback') }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'transferred'">
    transferred this from
    <a
      v-if="item.fromRepository?.url"
      :href="item.fromRepository.url"
      target="_blank"
      rel="noopener"
      class="gp-tag gp-tag--activity gp-tag--warning"
    >
      {{ item.fromRepository.nameWithOwner }}
    </a>
    <span v-else class="gp-tag gp-tag--activity gp-tag--warning">{{
      item.fromRepository?.nameWithOwner
    }}</span>
  </template>

  <template v-else-if="item.eventType === 'user_blocked'">
    blocked user
    <GitHubProfileLink
      :login="item.subject?.login"
      :github-href="item.subject?.url"
      class="gp-tag gp-tag--activity gp-tag--warning"
    >
      {{ item.subject?.login }}
    </GitHubProfileLink>
  </template>

  <template v-else-if="item.eventType === 'pinned' || item.eventType === 'unpinned'">
    {{ item.eventType === 'pinned' ? 'pinned this issue' : 'unpinned this issue' }}
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ProjectTag from '~/components/dashboard/timeline/ProjectTag.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import type { ProcessedIssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import {
  formatLockReason,
  formatStateReason,
  getStateReasonClass,
} from '~/composables/useIssueTimelineEvents';
import type { TimelineStateChange } from '~/composables/usePRTimelineEvents';
import { getTextColorFromBackground } from '~/utils/getTextColorFromBackground';

const { item } = defineProps<{
  item: ProcessedIssueTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const { t } = useI18n();
const assigneeChanges = computed(() => item.assigneeChanges ?? []);
const labelChanges = computed(() => item.labelChanges ?? []);
const assigneeLabel = computed(() => item.assignee?.login || item.assignee?.name || '');
const assigneePrefix = computed(() =>
  item.eventType === 'assigned' ? 'assigned this to' : 'unassigned this from'
);

const labelStyle = (color?: string) => {
  if (!color) return undefined;

  return {
    backgroundColor: `#${color}`,
    color: `#${getTextColorFromBackground(color)}`,
  };
};

const issueTypeColorHexMap: Record<string, string> = {
  gray: '#6e7781',
  blue: '#0969da',
  green: '#1a7f37',
  yellow: '#bf8700',
  orange: '#bc4c00',
  red: '#cf222e',
  pink: '#bf3989',
  purple: '#8250df',
};

const issueTypeTagStyle = (color?: string) => {
  const normalizedColor = color?.trim().toLowerCase() ?? '';

  const issueTypeColor = /^[\da-f]{6}$/i.test(normalizedColor)
    ? `#${normalizedColor}`
    : normalizedColor.startsWith('#')
      ? normalizedColor
      : (issueTypeColorHexMap[normalizedColor] ?? issueTypeColorHexMap.gray);

  return {
    '--issue-type-tag-color': issueTypeColor,
  };
};

const projectEventTypes = new Set([
  'added_to_project',
  'added_to_project_v2',
  'removed_from_project',
  'removed_from_project_v2',
]);

const addedProjectEventTypes = new Set(['added_to_project', 'added_to_project_v2']);

const assigneeChangeLabel = (change: TimelineStateChange) =>
  change.assignee?.login || change.assignee?.name || change.value;

const labelChangeLabel = (change: TimelineStateChange) => change.label?.name || change.value;

const timelineChangeActorLabel = (change: TimelineStateChange) =>
  change.actor?.login || change.actor?.name || '';
</script>

<style scoped lang="scss">
.gp-tag--activity {
  margin-left: 0.25rem;
}

.timeline-state-actor {
  margin-right: 0.25rem;
  font-weight: 500;

  &--link {
    color: var(--gitpulse-link);
  }
}

.gp-tag.issue-type-tag {
  border: 1px solid color-mix(in srgb, var(--issue-type-tag-color, #6e7781) 28%, transparent);
  background-color: color-mix(
    in srgb,
    var(--issue-type-tag-color, #6e7781) 14%,
    var(--gitpulse-surface)
  );
  color: color-mix(in srgb, var(--issue-type-tag-color, #6e7781) 78%, var(--gitpulse-text-strong));
}

html.dark .gp-tag.issue-type-tag {
  border-color: color-mix(in srgb, var(--issue-type-tag-color, #6e7781) 42%, transparent);
  background-color: color-mix(
    in srgb,
    var(--issue-type-tag-color, #6e7781) 24%,
    var(--gitpulse-surface)
  );
  color: color-mix(in srgb, var(--issue-type-tag-color, #6e7781) 68%, var(--gitpulse-text-strong));
}
</style>
