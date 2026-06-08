<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionRepliesPayload } from '#shared/types/discussions';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

const props = defineProps<{
  replies: DiscussionRepliesPayload;
  repoOwner: string;
  repoName: string;
  loadingMore?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'load-more'): void;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);
const hasReplies = computed(() => props.replies.items.length > 0);
</script>

<template>
  <div class="discussion-replies">
    <div v-if="hasReplies" class="discussion-replies__list">
      <article v-for="reply in replies.items" :key="reply.id" class="discussion-replies__item">
        <div class="discussion-replies__header">
          <RoundImg
            width="20"
            height="20"
            :src="reply.author?.avatarUrl || ''"
            :alt="reply.author?.login || t('discussionDetail.authorFallback')"
          />
          <a
            v-if="reply.author?.url"
            :href="reply.author.url"
            target="_blank"
            rel="noopener"
            class="has-text-weight-medium has-text-link is-size-7"
          >
            {{ reply.author.login }}
          </a>
          <span v-else class="has-text-weight-medium is-size-7">
            {{ reply.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="is-size-7 has-text-grey">
            {{ formatDurationFromNow(reply.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </div>

        <div class="discussion-replies__body content">
          <MarkdownRenderer
            v-if="reply.body"
            :value="reply.body"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
          <p v-else class="has-text-grey is-size-7">
            {{ t('discussionDetail.noCommentBody') }}
          </p>
        </div>
      </article>
    </div>

    <p v-else class="discussion-replies__empty is-size-7 has-text-grey">
      {{ t('discussionDetail.noReplies') }}
    </p>

    <p v-if="error" class="notification is-danger is-light py-2 px-3 is-size-7 mt-3">
      {{ error }}
    </p>

    <button
      v-if="replies.pageInfo.hasNextPage"
      class="button is-light is-small mt-3"
      type="button"
      :class="{ 'is-loading': loadingMore }"
      :disabled="loadingMore"
      @click="emit('load-more')"
    >
      {{
        loadingMore
          ? t('discussionDetail.loadingMoreReplies')
          : t('discussionDetail.loadMoreReplies')
      }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.discussion-replies {
  margin-left: 0.5rem;
  padding-left: 1rem;
  border-left: 2px solid var(--gitpulse-border);
}

.discussion-replies__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.discussion-replies__item {
  border-top: 1px solid var(--gitpulse-border);
  border-left: 1px solid var(--gitpulse-border);
  border-top-left-radius: 8px;
  padding: 0.75rem;
  background: var(--gitpulse-surface-muted);
}

.discussion-replies__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  margin-bottom: 0.5rem;
}

.discussion-replies__body {
  overflow-wrap: anywhere;
}

.discussion-replies__empty {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .discussion-replies {
    margin-left: 0;
    padding-left: 0.625rem;
  }
}
</style>
