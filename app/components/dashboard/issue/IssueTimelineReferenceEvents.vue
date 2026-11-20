<template>
  <template v-if="item.eventType === 'connected' && item.otherTarget">
    connected this issue to
    <ReferenceSubject
      :ref-subject="item.otherTarget"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template v-else-if="item.eventType === 'disconnected' && item.otherTarget">
    disconnected this issue from
    <ReferenceSubject
      :ref-subject="item.otherTarget"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template
    v-else-if="item.eventType === 'parent_issue_added' || item.eventType === 'parent_issue_removed'"
  >
    {{
      item.eventType === 'parent_issue_added' ? 'added a parent issue' : 'removed the parent issue'
    }}
    <ReferenceSubject
      :ref-subject="item.parent"
      :resource-type="item.eventType === 'parent_issue_added' ? 'issue' : undefined"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template v-else-if="item.eventType === 'cross-referenced'">
    <template v-if="!grouped">referenced this in</template>
    <ReferenceSubject
      :ref-subject="item.source"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template v-else-if="item.eventType === 'marked_as_duplicate'">
    marked this as duplicate of
    <ReferenceSubject
      :ref-subject="item.duplicate"
      resource-type="issue"
      :cross-repository="isOtherRepository(item.duplicate)"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template v-else-if="item.eventType === 'closed'">
    closed this as a duplicate of
    <ReferenceSubject
      :ref-subject="item.duplicate"
      resource-type="issue"
      :cross-repository="isOtherRepository(item.duplicate)"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>

  <template v-else-if="item.eventType === 'sub_issue_added'">
    <template v-if="item.subIssue">
      <template v-if="!grouped">added a sub-issue</template>
      <a
        href="#"
        @click.prevent="
          handleSwitchIssue(
            item.subIssue.repository?.owner?.login ?? repoOwner,
            item.subIssue.repository?.name ?? repoName,
            item.subIssue.number
          )
        "
        class="tag is-activity ml-1 is-info is-light"
      >
        {{ item.subIssue.title }} #{{ item.subIssue.number }}
      </a>
    </template>
    <template v-else>
      <template v-if="!grouped">added a sub-issue, but </template>{{ item.displayText }}
    </template>
  </template>

  <template v-else-if="item.eventType === 'sub_issue_removed'">
    removed a sub-issue
    <ReferenceSubject
      :ref-subject="item.subIssue"
      resource-type="issue"
      @switch-issue="handleSwitchIssue"
      @switch-pull-request="handleSwitchPullRequest"
    />
  </template>
</template>

<script setup lang="ts">
import ReferenceSubject from '~/components/dashboard/timeline/ReferenceSubject.vue';
import type { ProcessedIssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import type { TimelineReference } from '~/composables/usePRTimelineEvents';

const {
  repoOwner,
  repoName,
  grouped = false,
} = defineProps<{
  item: ProcessedIssueTimelineItem;
  repoOwner: string;
  repoName: string;
  grouped?: boolean;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const isOtherRepository = (reference?: TimelineReference) =>
  Boolean(reference?.repository) &&
  (reference?.repository?.owner?.login?.toLowerCase() !== repoOwner.toLowerCase() ||
    reference?.repository?.name?.toLowerCase() !== repoName.toLowerCase());

const handleSwitchIssue = (owner: string, repo: string, issueNumber?: number) => {
  if (!issueNumber) return;
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>
