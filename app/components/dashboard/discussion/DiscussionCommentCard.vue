<script setup lang="ts">
import { CheckCircle2Icon, MessageSquareIcon, MessageSquareReplyIcon } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionComment } from '#shared/types/discussions';
import DiscussionReplyList from '~/components/dashboard/discussion/DiscussionReplyList.vue';
import FloatingMarkdownEditor from '~/components/dashboard/timeline/FloatingMarkdownEditor.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

type DiscussionReplySubmitHandler = (comment: DiscussionComment, body: string) => Promise<void>;

const props = defineProps<{
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

const isReplying = computed(() => props.isEditorActive);

const expandReplyEditor = () => {
  emit('reply-editor-toggled', props.comment.id, true);
};

const collapseReplyEditor = () => {
  emit('reply-editor-toggled', props.comment.id, false);
};

const submitReplyDraft = async (body: string) => {
  await props.submitReply(props.comment, body);
  emit('reply-draft-updated', props.comment.id, '');
  collapseReplyEditor();
};
</script>

<template>
  <article class="discussion-comment">
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
        <a
          v-if="comment.author?.url"
          :href="comment.author.url"
          target="_blank"
          rel="noopener"
          class="has-text-weight-medium has-text-link"
        >
          {{ comment.author.login }}
        </a>
        <span v-else class="has-text-weight-medium">
          {{ comment.author?.login || t('discussionDetail.authorFallback') }}
        </span>
        <span class="discussion-comment__time is-size-7 has-text-grey">
          {{ formatDurationFromNow(comment.createdAt || '', localeCode, relativeTimeNow) }}
        </span>
        <span v-if="comment.isAnswer" class="tag is-success is-light is-small ml-auto">
          <CheckCircle2Icon :size="14" />
          {{ t('discussionDetail.answer') }}
        </span>
      </div>

      <div class="discussion-comment__body content">
        <MarkdownRenderer
          v-if="comment.body"
          :value="comment.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else class="has-text-grey is-size-7">
          {{ t('discussionDetail.noCommentBody') }}
        </p>
      </div>

      <div class="discussion-comment__toolbar">
        <button
          v-if="comment.replies.totalCount > 0"
          class="button is-ghost is-small discussion-comment__reply-toggle"
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
        class="mt-3"
        :replies="comment.replies"
        :repo-owner="repoOwner"
        :repo-name="repoName"
        :loading-more="loadingMoreReplies"
        :error="replyError"
        @load-more="emit('load-more-replies', comment)"
      />

      <div v-if="canReply" class="discussion-comment__reply-entry mt-3">
        <button
          v-if="!isReplying"
          class="discussion-comment__reply-capsule button is-light"
          type="button"
          @click="expandReplyEditor"
        >
          <MessageSquareReplyIcon :size="14" />
          <span class="has-text-grey">{{ t('discussionDetail.replyPlaceholder') }}</span>
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

.discussion-comment__time {
  flex: none;
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

.discussion-comment__toolbar .button {
  gap: 0.375rem;
}

.discussion-comment__reply-toggle {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;

  &:hover {
    color: var(--gitpulse-accent);
  }
}

.discussion-comment__reply-entry {
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
