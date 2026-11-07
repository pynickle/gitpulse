<template>
  <article class="comment-item">
    <TimelineCardHeader :author="item.author" :created-at="item.createdAt" />
    <div class="comment-item__body content">
      <MarkdownRenderer
        v-if="item.body"
        :value="item.body"
        :repo-owner="repoOwner"
        :repo-name="repoName"
      />
      <p v-else class="has-text-grey is-size-7">
        {{ emptyText ?? t('detailTimeline.noCommentBody') }}
      </p>
    </div>
    <ReactionBar
      v-if="canShowReactions"
      class="comment-item__reactions"
      :target-kind="reactionTargetKind"
      :owner="repoOwner || ''"
      :repo="repoName || ''"
      :target-id="reactionTargetId"
      :initial-items="item.reactions"
      defer-viewer-state
    />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ReactionSummaryItem } from '#shared/types/reactions';
import type { ReactionTargetKind } from '#shared/types/reactions';
import { extractCommentIdFromUrl } from '#shared/utils/reactions';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import TimelineCardHeader from '~/components/dashboard/timeline/TimelineCardHeader.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';

interface TimelineCommentCardItem {
  id?: string | number;
  author?: TimelineActor;
  createdAt?: string;
  body?: string;
  url?: string;
  reactions?: ReactionSummaryItem[];
}

const {
  item,
  repoOwner,
  repoName,
  enableReactions,
  reactionTargetKind = 'issue-comment',
} = defineProps<{
  item: TimelineCommentCardItem;
  emptyText?: string;
  repoOwner?: string;
  repoName?: string;
  enableReactions?: boolean;
  reactionTargetKind?: ReactionTargetKind;
}>();

const { t } = useI18n();
const reactionTargetId = computed(() => extractCommentIdFromUrl(item.url) || String(item.id ?? ''));
const canShowReactions = computed(
  () => enableReactions !== false && Boolean(repoOwner && repoName && reactionTargetId.value)
);
</script>

<style scoped lang="scss">
@use '~/assets/scss/timeline-card' as *;

.comment-item {
  @include timeline-card-surface;

  display: flex;
  flex-direction: column;
  gap: 0;
}

.comment-item__body {
  @include timeline-card-body;
}

.comment-item__body :deep(*:last-child) {
  margin-bottom: 0;
}

.comment-item__reactions {
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--gitpulse-border);
}
</style>
