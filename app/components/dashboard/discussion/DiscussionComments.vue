<script setup lang="ts">
import { CircleExclamationPointIcon, MessageSquareIcon } from '@lucide/vue';

import type { DiscussionComment } from '#shared/types/discussions';
import DiscussionCommentCard from '~/components/dashboard/discussion/DiscussionCommentCard.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';

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
  replyDrafts: Map<string, string>;
  loadingReplyIds: Set<string>;
  submittingReplyIds: Set<string>;
  submitReply: DiscussionReplySubmitHandler;
  activeEditorCommentId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'load-more-comments'): void;
  (e: 'load-more-replies', comment: DiscussionComment): void;
  (e: 'reply-draft-updated', commentId: string, draft: string): void;
  (e: 'reply-editor-toggled', commentId: string, isOpen: boolean): void;
}>();

const { t } = useI18n();
</script>

<template>
  <section class="discussion-comments">
    <h2 class="discussion-comments__heading">
      <MessageSquareIcon :size="20" />
      {{ t('discussionDetail.commentCount', { count: totalCount }) }}
    </h2>

    <div
      v-if="error"
      class="gp-notice gp-notice--danger gp-notice--compact discussion-comments__error"
      role="alert"
    >
      <p class="is-size-7">
        <CircleExclamationPointIcon :size="14" class="mr-1" style="vertical-align: text-bottom" />
        {{ error }}
      </p>
      <button
        class="gp-btn gp-btn--danger-soft gp-btn--small mt-2"
        type="button"
        @click="emit('load-more-comments')"
      >
        {{ t('discussionDetail.retry') }}
      </button>
    </div>

    <div v-if="loading" class="discussion-comments__loading">
      <LoadingIcon :size="16" aria-hidden="true" />
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
        :reply-draft="replyDrafts.get(comment.id) || ''"
        :loading-more-replies="loadingReplyIds.has(comment.id)"
        :submitting-reply="submittingReplyIds.has(comment.id)"
        :submit-reply="submitReply"
        :is-editor-active="activeEditorCommentId === comment.id"
        @load-more-replies="emit('load-more-replies', $event)"
        @reply-draft-updated="
          (commentId: string, draft: string) => emit('reply-draft-updated', commentId, draft)
        "
        @reply-editor-toggled="
          (commentId: string, isOpen: boolean) => emit('reply-editor-toggled', commentId, isOpen)
        "
      />
    </div>

    <p v-else class="discussion-comments__empty has-text-grey">
      {{ t('discussionDetail.noCommentsPrompt') }}
    </p>

    <button
      v-if="hasNextPage"
      class="gp-btn gp-btn--light discussion-comments__load-more"
      type="button"
      :class="{ 'gp-btn--loading': loadingMore }"
      :disabled="loadingMore"
      :aria-busy="loadingMore || undefined"
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
  color: var(--gitpulse-text-strong);
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.125;
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
