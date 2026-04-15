<template>
  <template v-if="item.eventType === 'blocked_by_added'">
    marked this as blocked by
    <a
      href="#"
      @click.prevent="switchToIssue(repoFullName, item.blockingIssue?.number)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.blockingIssue?.title }} #{{ item.blockingIssue?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'blocked_by_removed'">
    removed this as blocked by
    <a
      href="#"
      @click.prevent="switchToIssue(repoFullName, item.blockingIssue?.number)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.blockingIssue?.title }} #{{ item.blockingIssue?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'blocking_added'">
    marked this as blocking
    <a
      href="#"
      @click.prevent="switchToIssue(repoFullName, item.blockedIssue?.number)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.blockedIssue?.title }} #{{ item.blockedIssue?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'blocking_removed'">
    removed this as blocking
    <a
      href="#"
      @click.prevent="switchToIssue(repoFullName, item.blockedIssue?.number)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.blockedIssue?.title }} #{{ item.blockedIssue?.number }}
    </a>
  </template>

  <template v-else-if="isSourceReferenceEvent">
    {{ sourceReferencePrefix }}
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.source)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.source?.title || '#' + item.source?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'referenced'">
    referenced this PR from commit
    <a
      v-if="item.commit?.commitUrl"
      :href="item.commit.commitUrl"
      target="_blank"
      class="tag is-activity ml-1 is-light is-family-monospace"
    >
      {{ item.commit?.oid?.slice(0, 7) || 'commit' }}
    </a>
    <span v-else class="tag is-activity ml-1 is-light is-family-monospace">
      {{ item.commit?.oid?.slice(0, 7) || 'commit' }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'marked_as_duplicate'">
    marked this as duplicate of
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.duplicate)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.duplicate?.title }} #{{ item.duplicate?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'unmarked_as_duplicate'">
    unmarked this as duplicate
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.duplicate)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.duplicate?.title }} #{{ item.duplicate?.number }}
    </a>
  </template>

  <template
    v-else-if="item.eventType === 'parent_issue_added' || item.eventType === 'parent_issue_removed'"
  >
    {{
      item.eventType === 'parent_issue_added' ? 'added a parent issue' : 'removed the parent issue'
    }}
    <a
      href="#"
      @click.prevent="switchToIssueFromUrl(item.parent?.url)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.parent?.title }} #{{ item.parent?.number }}
    </a>
  </template>

  <template
    v-else-if="item.eventType === 'sub_issue_added' || item.eventType === 'sub_issue_removed'"
  >
    {{ item.eventType === 'sub_issue_added' ? 'added sub-issue' : 'removed sub-issue' }}
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.subIssue)"
      class="tag is-activity ml-1 is-info is-light"
    >
      {{ item.subIssue?.title }} #{{ item.subIssue?.number }}
    </a>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
  parseGitHubIssueOrPullUrl,
  parseRepoFullName,
  type PRTimelineItem,
  type TimelineReference,
} from '~/composables/usePRTimelineEvents';

const props = defineProps<{
  item: PRTimelineItem;
  repoFullName: string;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const sourceReferencePrefix = computed(() => {
  switch (props.item.eventType) {
    case 'connected':
      return 'connected this PR to';
    case 'disconnected':
      return 'disconnected this PR from';
    case 'cross-referenced':
      return 'referenced this in';
    default:
      return 'referenced this PR in';
  }
});

const isSourceReferenceEvent = computed(() =>
  ['connected', 'disconnected', 'cross-referenced'].includes(props.item.eventType ?? '')
);

const switchToIssue = (fullName: string, number?: number) => {
  const parsed = parseRepoFullName(fullName);
  if (!parsed || !number) return;

  emit('switch-issue', parsed.owner, parsed.repo, number);
};

const switchToIssueOrPR = (reference?: TimelineReference) => {
  if (!reference?.number) return;

  const repoNameWithOwner = reference.repository?.nameWithOwner || props.repoFullName;
  const parsed = parseRepoFullName(repoNameWithOwner);
  if (!parsed) return;

  if (reference.resourceType === 'pull-request') {
    emit('switch-pull-request', parsed.owner, parsed.repo, reference.number);
    return;
  }

  emit('switch-issue', parsed.owner, parsed.repo, reference.number);
};

const switchToIssueFromUrl = (url?: string) => {
  const parsed = parseGitHubIssueOrPullUrl(url);
  if (!parsed) return;

  if (parsed.kind === 'pull-request') {
    emit('switch-pull-request', parsed.owner, parsed.repo, parsed.number);
    return;
  }

  emit('switch-issue', parsed.owner, parsed.repo, parsed.number);
};
</script>
