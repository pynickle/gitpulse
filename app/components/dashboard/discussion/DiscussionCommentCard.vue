<script setup lang="ts">
import { CircleCheckIcon, MessageSquareIcon, MessageSquareReplyIcon } from '@lucide/vue';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionComment } from '#shared/types/discussions';
import CommentActions from '~/components/dashboard/comments/CommentActions.vue';
import CommentBody from '~/components/dashboard/comments/CommentBody.vue';
import DiscussionReplyList from '~/components/dashboard/discussion/DiscussionReplyList.vue';
import FloatingMarkdownEditor from '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { useCommentModeration } from '~/composables/useCommentModeration';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

type DiscussionReplySubmitHandler = (comment: DiscussionComment, body: string) => Promise<void>;

const { stateFor } = useCommentModeration();
const { comment, submitReply } = defineProps<{
  comment: DiscussionComment;
  repoOwner: string;
  repoName: string;
  canReply: boolean;
  submittingReply?: boolean;
  loadingMoreReplies?: boolean;
  replyError?: string;
  replyDraft: string;
  submitReply: DiscussionReplySubmitHandler;
  isEditorActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'load-more-replies', comment: DiscussionComment): void;
  (e: 'reply-draft-updated', commentId: string, draft: string): void;
  (e: 'reply-editor-toggled', commentId: string, isOpen: boolean): void;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);
const showReplies = shallowRef(false);

const expandReplyEditor = () => {
  emit('reply-editor-toggled', comment.id, true);
};

const collapseReplyEditor = () => {
  emit('reply-editor-toggled', comment.id, false);
};

const submitReplyDraft = async (body: string) => {
  await submitReply(comment, body);
  emit('reply-draft-updated', comment.id, '');
  collapseReplyEditor();
};
</script>

<template>
  <article v-if="!stateFor(comment.moderation).deleted" class="discussion-comment">
    <div class="discussion-comment__rail" aria-hidden="true">
      <span class="discussion-comment__dot" />
      <span class="discussion-comment__line" />
    </div>

    <div class="discussion-comment__content">
      <div class="discussion-comment__header">
        <GitHubAvatar
          variant="raised"
          interactive
          width="32"
          height="32"
          :src="comment.author?.avatarUrl || ''"
          :alt="comment.author?.login || t('discussionDetail.authorFallback')"
        />
        <GitHubProfileLink
          v-if="comment.author?.login || comment.author?.url"
          :login="comment.author.login"
          :github-href="comment.author.url"
          class="discussion-comment__author discussion-comment__author--link"
        >
          {{ comment.author.login }}
        </GitHubProfileLink>
        <span v-else class="discussion-comment__author">
          {{ comment.author?.login || t('discussionDetail.authorFallback') }}
        </span>
        <span class="discussion-comment__time">
          {{ formatDurationFromNow(comment.createdAt || '', localeCode, relativeTimeNow) }}
        </span>
        <span
          v-if="comment.isAnswer"
          class="gp-tag gp-tag--success gp-tag--small discussion-comment__answer-tag"
        >
          <CircleCheckIcon :size="14" />
          {{ t('discussionDetail.answer') }}
        </span>
        <CommentActions :target="comment.moderation" />
      </div>

      <CommentBody v-slot="{ body }" :target="comment.moderation" :body="comment.body">
        <div class="discussion-comment__body">
          <MarkdownRenderer
            v-if="body"
            :value="body"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
          <p v-else class="discussion-comment__empty">
            {{ t('discussionDetail.noCommentBody') }}
          </p>
        </div>
      </CommentBody>
      <div class="discussion-comment__toolbar">
        <button
          v-if="comment.replies.totalCount > 0"
          class="gp-btn gp-btn--ghost gp-btn--small discussion-comment__reply-toggle"
          type="button"
          :aria-expanded="showReplies"
          @click="showReplies = !showReplies"
        >
          <MessageSquareIcon :size="14" />
          {{ t('discussionDetail.replyCount', { count: comment.replies.totalCount }) }}
        </button>
      </div>

      <DiscussionReplyList
        v-if="showReplies"
        class="discussion-comment__replies"
        :replies="comment.replies"
        :repo-owner="repoOwner"
        :repo-name="repoName"
        :loading-more="loadingMoreReplies"
        :error="replyError"
        @load-more="emit('load-more-replies', comment)"
      />

      <div v-if="canReply" class="discussion-comment__reply-entry">
        <button
          v-if="!isEditorActive"
          class="discussion-comment__reply-capsule gp-btn gp-btn--light"
          type="button"
          @click="expandReplyEditor"
        >
          <MessageSquareReplyIcon :size="14" />
          <span class="discussion-comment__reply-placeholder">{{
            t('discussionDetail.replyPlaceholder')
          }}</span>
        </button>

        <div v-else class="discussion-comment__reply-editor">
          <FloatingMarkdownEditor
            compact
            autofocus
            :repo-owner="repoOwner"
            :repo-name="repoName"
            :model-value="replyDraft"
            :placeholder="t('discussionDetail.replyPlaceholder')"
            :submit-label="t('discussionDetail.submitReply')"
            :submitting-label="t('discussionDetail.submittingReply')"
            :submitting="submittingReply"
            :submit="submitReplyDraft"
            @update:model-value="(draft: string) => emit('reply-draft-updated', comment.id, draft)"
            @collapsed="collapseReplyEditor"
          />
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.discussion-comment {
  display: flex;
  gap: 0;
  min-height: 2rem;
}

.discussion-comment__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: none;
  width: 24px;
  padding-top: 1rem;
}

.discussion-comment__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gitpulse-accent);
}

.discussion-comment__line {
  flex: 1;
  width: 2px;
  margin-top: 4px;
  background: var(--gitpulse-border);
}

.discussion-comment__content {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0 1.5rem 0.75rem;
}

.discussion-comment__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.discussion-comment__author {
  font-weight: 500;

  &--link {
    color: var(--gitpulse-link);
  }
}

.discussion-comment__time {
  flex: none;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.discussion-comment__answer-tag {
  margin-left: auto;
}

.discussion-comment__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.discussion-comment__replies {
  margin-top: 0.75rem;
}

.discussion-comment__reply-placeholder {
  color: var(--gitpulse-text-muted);
}

.discussion-comment__body {
  border-top: 1px solid var(--gitpulse-border);
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  overflow-wrap: anywhere;
}

.discussion-comment__toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.discussion-comment__toolbar .gp-btn {
  gap: 0.375rem;
}

.discussion-comment__reply-toggle {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-accent);
    }
  }
}

.discussion-comment__reply-entry {
  margin-top: 0.75rem;
  margin-left: 0.5rem;
  padding-left: 1rem;
  border-left: 2px solid var(--gitpulse-border);
}

.discussion-comment__reply-capsule {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 40px;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 20px;
  background: var(--gitpulse-surface-muted);
  text-align: left;
  cursor: text;
  font-size: 0.875rem;
}

.discussion-comment__reply-editor {
  // Override FloatingMarkdownEditor's sticky positioning
  :deep(.floating-markdown-editor) {
    position: static;
    padding-top: 0;
  }
}

@media (max-width: 768px) {
  .discussion-comment__rail {
    width: 16px;
  }

  .discussion-comment__content {
    padding-left: 0.5rem;
  }

  .discussion-comment__header {
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .discussion-comment__toolbar {
    flex-wrap: wrap;
  }
}
</style>
