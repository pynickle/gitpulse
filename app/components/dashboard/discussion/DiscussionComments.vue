<script setup lang="ts">
import { AlertCircleIcon, MessageSquareIcon } from 'lucide-vue-next';

import type { DiscussionComment } from '#shared/types/discussions';
import DiscussionCommentCard from '~/components/dashboard/discussion/DiscussionCommentCard.vue';

type DiscussionReplySubmitHandler = (comment: DiscussionComment, body: string) => Promise<void>;

defineProps<{
  comments: DiscussionComment[];
  totalCount: number;
  repoOwner: string;
  repoName: string;
  canReply: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  hasNextPage?: boolean;
  error?: string;
  replyErrors: Map<string, string>;
  loadingReplyIds: Set<string>;
  submittingReplyIds: Set<string>;
  submitReply: DiscussionReplySubmitHandler;
}>();

const emit = defineEmits<{
  (e: 'load-more-comments'): void;
  (e: 'load-more-replies', comment: DiscussionComment): void;
}>();

const { t } = useI18n();
</script>

<template>
  <section class="discussion-comments">
    <h2 class="title is-5 discussion-comments__heading">
      <MessageSquareIcon :size="20" />
      {{ t('discussionDetail.commentCount', { count: totalCount }) }}
    </h2>

    <div v-if="error" class="notification is-danger is-light py-2 px-3 discussion-comments__error">
      <p class="is-size-7">
        <AlertCircleIcon :size="14" class="mr-1" style="vertical-align: text-bottom" /> {{ error }}
      </p>
      <button
        class="button is-danger is-light is-small mt-2"
        type="button"
        @click="emit('load-more-comments')"
      >
        {{ t('discussionDetail.retry') }}
      </button>
    </div>

    <div v-if="loading" class="discussion-comments__loading">
      <span class="loader" aria-hidden="true" />
      <span class="is-size-7 has-text-grey">{{ t('discussionDetail.loadingComments') }}</span>
    </div>

    <div v-else-if="comments.length" class="discussion-comments__timeline">
      <DiscussionCommentCard
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :repo-owner="repoOwner"
        :repo-name="repoName"
        :can-reply="canReply"
        :reply-error="replyErrors.get(comment.id)"
        :loading-more-replies="loadingReplyIds.has(comment.id)"
        :submitting-reply="submittingReplyIds.has(comment.id)"
        :submit-reply="submitReply"
        @load-more-replies="emit('load-more-replies', $event)"
      />
    </div>

    <p v-else class="discussion-comments__empty has-text-grey">
      {{ t('discussionDetail.noCommentsPrompt') }}
    </p>

    <button
      v-if="hasNextPage"
      class="button is-light discussion-comments__load-more"
      type="button"
      :class="{ 'is-loading': loadingMore }"
      :disabled="loadingMore"
      @click="emit('load-more-comments')"
    >
      {{
        loadingMore
          ? t('discussionDetail.loadingMoreComments')
          : t('discussionDetail.loadMoreComments')
      }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.discussion-comments {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.discussion-comments__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
}

.discussion-comments__error {
  display: flex;
  flex-direction: column;
}

.discussion-comments__timeline {
  display: flex;
  flex-direction: column;
}

.discussion-comments__loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--gitpulse-surface-muted);
}

.discussion-comments__empty {
  border: 1px dashed var(--gitpulse-border);
  border-radius: 8px;
  margin-bottom: 0;
  padding: 1rem;
  text-align: center;
}

.discussion-comments__load-more {
  align-self: center;
}
</style>
