<template>
  <article class="comment-item">
    <header class="comment-item__header">
      <GitHubAvatar
        variant="raised"
        interactive
        class="comment-item__avatar"
        width="32"
        height="32"
        :src="props.item.author?.avatarUrl || ''"
        :alt="props.item.author?.login || ''"
      />
      <div class="comment-item__meta">
        <a
          :href="props.item.author?.url"
          target="_blank"
          rel="noopener"
          class="comment-item__author is-size-6 has-text-weight-medium has-text-link"
        >
          {{ props.item.author?.login }}
        </a>
        <slot name="meta">
          <span class="comment-item__time is-size-7 has-text-grey">
            {{ formatDurationFromNow(props.item.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </slot>
      </div>
    </header>
    <div class="comment-item__body content">
      <MarkdownRenderer
        v-if="props.item.body"
        :value="props.item.body"
        :repo-owner="props.repoOwner"
        :repo-name="props.repoName"
      />
      <p v-else class="has-text-grey is-size-7">
        {{ props.emptyText ?? t('detailTimeline.noCommentBody') }}
      </p>
    </div>
    <ReactionBar
      v-if="canShowReactions"
      class="comment-item__reactions"
      :target-kind="reactionTargetKind"
      :owner="props.repoOwner || ''"
      :repo="props.repoName || ''"
      :target-id="reactionTargetId"
      :initial-items="props.item.reactions"
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
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

interface TimelineCommentCardItem {
  id?: string | number;
  author?: TimelineActor;
  createdAt?: string;
  body?: string;
  url?: string;
  reactions?: ReactionSummaryItem[];
}

const props = defineProps<{
  item: TimelineCommentCardItem;
  emptyText?: string;
  repoOwner?: string;
  repoName?: string;
  enableReactions?: boolean;
  reactionTargetKind?: ReactionTargetKind;
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const reactionTargetId = computed(
  () => extractCommentIdFromUrl(props.item.url) || String(props.item.id ?? '')
);
const reactionTargetKind = computed(() => props.reactionTargetKind ?? 'issue-comment');
const canShowReactions = computed(
  () =>
    props.enableReactions !== false &&
    Boolean(props.repoOwner && props.repoName && reactionTargetId.value)
);
</script>

<style scoped lang="scss">
.comment-item {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 1.125rem 0.875rem;
  border: 1px solid var(--gitpulse-border-strong);
  border-radius: var(--gitpulse-radius-xl);
  background-color: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
}

.comment-item__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.comment-item__avatar {
  flex: none;
}

.comment-item__meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.comment-item__author {
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.comment-item__time {
  line-height: 1.3;
}

.comment-item__body {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--gitpulse-border);
  overflow-wrap: anywhere;
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
