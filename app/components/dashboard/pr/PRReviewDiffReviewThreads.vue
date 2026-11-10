<script setup lang="ts">
import { computed } from 'vue';

import CommentActions from '~/components/dashboard/comments/CommentActions.vue';
import CommentBody from '~/components/dashboard/comments/CommentBody.vue';
import PRReviewThreadToggle from '~/components/dashboard/pr/PRReviewThreadToggle.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { useCommentModeration } from '~/composables/useCommentModeration';
import type { PRReviewCommentThread } from '~/composables/usePRReview';

const { stateFor } = useCommentModeration();
const { threads, resolvingReviewThreadId } = defineProps<{
  threads: PRReviewCommentThread[];
  repoOwner: string;
  repoName: string;
  resolvingReviewThreadId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-review-thread', payload: { threadId: string; resolved: boolean }): void;
}>();

const { t, locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const visibleThreads = computed(() =>
  threads
    .map((thread) => ({
      ...thread,
      comments: thread.comments.filter((comment) => !stateFor(comment.moderation).deleted),
    }))
    .filter((thread) => thread.comments.length > 0)
);

const isReviewThreadResolving = (thread: PRReviewCommentThread) =>
  Boolean(thread.threadId && resolvingReviewThreadId === thread.threadId);

const toggleReviewThread = (thread: PRReviewCommentThread) => {
  if (!thread.threadId || isReviewThreadResolving(thread)) {
    return;
  }

  emit('toggle-review-thread', {
    threadId: thread.threadId,
    resolved: !thread.isResolved,
  });
};
</script>

<template>
  <div class="pr-review-diff-viewer__new-line-threads">
    <div
      v-for="thread in visibleThreads"
      :key="thread.id"
      class="pr-review-diff-viewer__review-thread"
      :class="{ 'pr-review-diff-viewer__review-thread--resolved': thread.isResolved }"
    >
      <article
        v-for="(comment, commentIndex) in thread.comments"
        :key="comment.id"
        class="pr-review-diff-viewer__review-comment"
      >
        <div class="pr-review-diff-viewer__review-comment-header">
          <GitHubAvatar
            variant="raised"
            interactive
            width="24"
            height="24"
            :src="comment.author?.avatarUrl || ''"
            :alt="comment.author?.login || ''"
          />
          <div class="pr-review-diff-viewer__review-comment-meta">
            <a
              v-if="comment.author?.url"
              :href="comment.author.url"
              target="_blank"
              rel="noopener noreferrer"
              class="has-text-link has-text-weight-semibold"
            >
              {{ comment.author.login }}
            </a>
            <strong v-else>{{ comment.author?.login || t('prReview.unknownReviewAuthor') }}</strong>
            <a
              v-if="comment.url"
              :href="comment.url"
              target="_blank"
              rel="noopener noreferrer"
              class="has-text-grey"
            >
              {{ formatDurationFromNow(comment.createdAt || '', localeCode, relativeTimeNow) }}
            </a>
            <span v-else-if="comment.createdAt" class="has-text-grey">
              {{ formatDurationFromNow(comment.createdAt, localeCode, relativeTimeNow) }}
            </span>
          </div>
          <PRReviewThreadToggle
            v-if="thread.threadId && commentIndex === 0"
            class="pr-review-diff-viewer__thread-action"
            :resolved="thread.isResolved"
            :loading="isReviewThreadResolving(thread)"
            @toggle="toggleReviewThread(thread)"
          />
          <CommentActions :target="comment.moderation" />
        </div>
        <CommentBody v-slot="{ body }" :target="comment.moderation" :body="comment.body">
          <div class="pr-review-diff-viewer__review-comment-body content">
            <MarkdownRenderer
              v-if="body"
              :value="body"
              :repo-owner="repoOwner"
              :repo-name="repoName"
            />
            <p v-else class="has-text-grey mb-0">
              {{ t('prReview.noReviewCommentBody') }}
            </p>
          </div>
        </CommentBody>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pr-review-diff-viewer__new-line-threads {
  margin-top: 0.35rem;
  padding: 0 0.75rem 0 0.9rem;
  border-left: 2px solid var(--gitpulse-border);
}

.pr-review-diff-viewer__review-thread {
  margin: 0 0 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
  overflow: hidden;
}

.pr-review-diff-viewer__review-thread--resolved {
  border-color: color-mix(in srgb, var(--gitpulse-success) 30%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-success) 4%, var(--gitpulse-surface));
}

.pr-review-diff-viewer__review-comment {
  position: relative;
  padding: 0.6rem 0.7rem;
}

.pr-review-diff-viewer__thread-action {
  flex: none;
}

.pr-review-diff-viewer__review-comment + .pr-review-diff-viewer__review-comment {
  margin-top: 0;
  border-top: 1px solid var(--gitpulse-border);
}

.pr-review-diff-viewer__review-comment-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.pr-review-diff-viewer__review-comment-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  align-items: center;
}

.pr-review-diff-viewer__review-comment-body {
  margin-top: 0.55rem;
  margin-bottom: 0;
}

.pr-review-diff-viewer__review-comment-body :deep(.markdown-body) {
  font-size: 12px;
}

.pr-review-diff-viewer__review-comment-body :deep(.markdown-body code) {
  font-size: 12px;
}
</style>
