<template>
  <template v-if="isSourceReferenceEvent">
    <template v-if="!grouped">{{ sourceReferencePrefix }}</template>
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.source)"
      class="gp-tag gp-tag--activity gp-tag--info ml-1"
    >
      {{ item.source?.title || '#' + item.source?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'referenced'">
    {{ t('prReview.referenceCommitIntro') }}
    <a
      v-if="item.commit?.commitUrl"
      :href="item.commit.commitUrl"
      target="_blank"
      rel="noopener"
      class="gp-tag gp-tag--activity ml-1 is-family-monospace"
    >
      {{ item.commit?.oid?.slice(0, 7) || t('prReview.commitFallbackRef') }}
    </a>
    <span v-else class="gp-tag gp-tag--activity ml-1 is-family-monospace">
      {{ item.commit?.oid?.slice(0, 7) || t('prReview.commitFallbackRef') }}
    </span>
  </template>

  <template v-else-if="item.eventType === 'marked_as_duplicate'">
    marked this as duplicate of
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.duplicate)"
      class="gp-tag gp-tag--activity gp-tag--info ml-1"
    >
      {{ item.duplicate?.title }} #{{ item.duplicate?.number }}
    </a>
  </template>

  <template v-else-if="item.eventType === 'unmarked_as_duplicate'">
    unmarked this as duplicate
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.duplicate)"
      class="gp-tag gp-tag--activity gp-tag--info ml-1"
    >
      {{ item.duplicate?.title }} #{{ item.duplicate?.number }}
    </a>
  </template>

  <template
    v-else-if="item.eventType === 'blocked_by_added' || item.eventType === 'blocked_by_removed'"
  >
    <template v-if="!grouped">{{
      item.eventType === 'blocked_by_added'
        ? 'marked this as blocked by'
        : 'unmarked this as blocked by'
    }}</template>
    <ReferenceSubject
      :ref-subject="item.blockedIssue"
      resource-type="issue"
      @switch-issue="handleSwitchIssue"
    />
  </template>

  <template
    v-else-if="item.eventType === 'parent_issue_added' || item.eventType === 'parent_issue_removed'"
  >
    {{
      item.eventType === 'parent_issue_added' ? 'added a parent issue' : 'removed the parent issue'
    }}
    <a
      href="#"
      @click.prevent="switchToIssueOrPR(item.parent)"
      class="gp-tag gp-tag--activity gp-tag--info ml-1"
    >
      {{ item.parent?.title }} #{{ item.parent?.number }}
    </a>
  </template>

  <template
    v-else-if="item.eventType === 'sub_issue_added' || item.eventType === 'sub_issue_removed'"
  >
    <template v-if="item.subIssue">
      <template v-if="!grouped">{{
        item.eventType === 'sub_issue_added' ? 'added sub-issue' : 'removed sub-issue'
      }}</template>
      <ReferenceSubject
        :ref-subject="item.subIssue"
        resource-type="issue"
        @switch-issue="handleSwitchIssue"
      />
    </template>
    <template v-else>
      <template v-if="!grouped">added sub-issue, but </template
      >{{ item.displayText || 'target issue details are unavailable' }}
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ReferenceSubject from '~/components/dashboard/timeline/ReferenceSubject.vue';
import {
  parseRepoFullName,
  type PRTimelineItem,
  type TimelineReference,
} from '~/composables/usePRTimelineEvents';

const {
  item,
  repoFullName,
  grouped = false,
} = defineProps<{
  item: PRTimelineItem;
  repoFullName: string;
  grouped?: boolean;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { t } = useI18n();

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const sourceReferencePrefix = computed(() => {
  switch (item.eventType) {
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
  ['connected', 'disconnected', 'cross-referenced'].includes(item.eventType ?? '')
);

const switchToIssueOrPR = (reference?: TimelineReference) => {
  if (!reference?.number) return;

  const repoNameWithOwner = reference.repository?.nameWithOwner || repoFullName;
  const parsed = parseRepoFullName(repoNameWithOwner);
  if (!parsed) return;

  if (reference.resourceType === 'pull-request') {
    emit('switch-pull-request', parsed.owner, parsed.repo, reference.number);
    return;
  }

  emit('switch-issue', parsed.owner, parsed.repo, reference.number);
};
</script>
