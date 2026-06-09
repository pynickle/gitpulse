<script setup lang="ts">
import { CheckCircle2Icon, MessageSquareIcon, MessageSquareReplyIcon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
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
  submitReply: DiscussionReplySubmitHandler;
}>();

const emit = defineEmits<{
  (e: 'load-more-replies', comment: DiscussionComment): void;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);
const isReplying = shallowRef(false);
const showReplies = shallowRef(false);

const submitReplyDraft = async (body: string) => {
  await props.submitReply(props.comment, body);
  isReplying.value = false;
};

watch(
  () => props.canReply,
  (canReply) => {
    if (!canReply) {
      isReplying.value = false;
    }
  }
);
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
          v-if="canReply"
          class="button is-light is-small"
          type="button"
          :aria-expanded="isReplying"
          @click="isReplying = !isReplying"
        >
          <MessageSquareReplyIcon :size="14" />
          <span>{{
            isReplying ? t('discussionDetail.cancelReply') : t('discussionDetail.reply')
          }}</span>
        </button>
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

      <FloatingMarkdownEditor
        v-if="isReplying && canReply"
        class="mt-3"
        compact
        autofocus
        :repo-owner="repoOwner"
        :repo-name="repoName"
        :placeholder="t('discussionDetail.replyPlaceholder')"
        :submit-label="t('discussionDetail.submitReply')"
        :submitting-label="t('discussionDetail.submittingReply')"
        :submitting="submittingReply"
        :submit="submitReplyDraft"
      />

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
