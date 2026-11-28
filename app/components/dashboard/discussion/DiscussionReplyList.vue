<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionRepliesPayload } from '#shared/types/discussions';
import CommentActions from '~/components/dashboard/comments/CommentActions.vue';
import CommentBody from '~/components/dashboard/comments/CommentBody.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { useCommentModeration } from '~/composables/useCommentModeration';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

const { stateFor } = useCommentModeration();
const { replies } = defineProps<{
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
const visibleReplies = computed(() =>
  replies.items.filter((reply) => !stateFor(reply.moderation).deleted)
);
const hasReplies = computed(() => visibleReplies.value.length > 0);
</script>

<template>
  <div class="discussion-replies">
    <div v-if="hasReplies" class="discussion-replies__list">
      <article v-for="reply in visibleReplies" :key="reply.id" class="discussion-replies__item">
        <div class="discussion-replies__header">
          <GitHubAvatar
            variant="raised"
            interactive
            width="20"
            height="20"
            :src="reply.author?.avatarUrl || ''"
            :alt="reply.author?.login || t('discussionDetail.authorFallback')"
          />
          <GitHubProfileLink
            v-if="reply.author?.login || reply.author?.url"
            :login="reply.author.login"
            :github-href="reply.author.url"
            class="discussion-replies__author discussion-replies__author--link"
          >
            {{ reply.author.login }}
          </GitHubProfileLink>
          <span v-else class="discussion-replies__author">
            {{ reply.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="discussion-replies__meta">
            {{ formatDurationFromNow(reply.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
          <CommentActions :target="reply.moderation" />
        </div>

        <CommentBody v-slot="{ body }" :target="reply.moderation" :body="reply.body">
          <div class="discussion-replies__body">
            <MarkdownRenderer
              v-if="body"
              :value="body"
              :repo-owner="repoOwner"
              :repo-name="repoName"
            />
            <p v-else class="discussion-replies__empty-body">
              {{ t('discussionDetail.noCommentBody') }}
            </p>
          </div>
        </CommentBody>
      </article>
    </div>

    <p v-else class="discussion-replies__empty">
      {{ t('discussionDetail.noReplies') }}
    </p>

    <p
      v-if="error"
      class="gp-notice gp-notice--danger gp-notice--compact discussion-replies__error"
      role="alert"
    >
      {{ error }}
    </p>

    <button
      v-if="replies.pageInfo.hasNextPage"
      class="gp-btn gp-btn--light gp-btn--small discussion-replies__load-more"
      type="button"
      :class="{ 'gp-btn--loading': loadingMore }"
      :disabled="loadingMore"
      :aria-busy="loadingMore || undefined"
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

.discussion-replies__author {
  font-size: 0.75rem;
  font-weight: 500;

  &--link {
    color: var(--gitpulse-link);
  }
}

.discussion-replies__meta,
.discussion-replies__empty-body {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.discussion-replies__body {
  overflow-wrap: anywhere;
}

.discussion-replies__empty {
  margin-bottom: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.discussion-replies__error {
  margin-top: 0.75rem;
  font-size: 0.75rem;
}

.discussion-replies__load-more {
  margin-top: 0.75rem;
}

@media (max-width: 768px) {
  .discussion-replies {
    margin-left: 0;
    padding-left: 0.625rem;
  }
}
</style>
