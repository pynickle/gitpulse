<template>
  <div class="comment-item px-4 pt-4 pb-1">
    <div class="mb-4">
      <div class="is-flex is-align-items-center mb-2">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-4"
          width="32"
          height="32"
          :src="props.item.author?.avatarUrl || ''"
          :alt="props.item.author?.login || ''"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="props.item.author?.url"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ props.item.author?.login }}
          </a>
          <slot name="meta">
            <span class="is-size-7 has-text-grey">
              {{ formatDurationFromNow(props.item.createdAt || '', localeCode, relativeTimeNow) }}
            </span>
          </slot>
        </div>
      </div>
      <hr class="my-2" />
      <div class="content">
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
    </div>
  </div>
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
  border-radius: 20px;
  background-color: var(--gitpulse-surface-muted);
}

.comment-item__reactions {
  margin-top: 0.75rem;
}
</style>
