<script setup lang="ts">
import { CheckIcon, XIcon } from '@lucide/vue';
import { computed } from 'vue';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import type { PRReviewCommentThread } from '~/composables/usePRReview';

const props = defineProps<{
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

const isReviewThreadResolving = (thread: PRReviewCommentThread) =>
  Boolean(thread.threadId && props.resolvingReviewThreadId === thread.threadId);

const reviewThreadActionLabel = (thread: PRReviewCommentThread) =>
  thread.isResolved ? t('prReview.unresolveThread') : t('prReview.resolveThread');

const reviewThreadStateLabel = (thread: PRReviewCommentThread) =>
  thread.isResolved ? t('prReview.threadResolved') : t('prReview.threadUnresolved');

const reviewThreadStateClass = (thread: PRReviewCommentThread) =>
  thread.isResolved
    ? 'pr-review-diff-viewer__thread-action--resolved'
    : 'pr-review-diff-viewer__thread-action--unresolved';

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
      v-for="thread in threads"
      :key="thread.id"
      class="pr-review-diff-viewer__review-thread"
      :class="{ 'pr-review-diff-viewer__review-thread--resolved': thread.isResolved }"
    >
      <article
        v-for="(comment, commentIndex) in thread.comments"
        :key="comment.id"
        class="pr-review-diff-viewer__review-comment"
      >
        <button
          v-if="thread.threadId && commentIndex === 0"
          class="button is-small pr-review-diff-viewer__thread-action"
          type="button"
          :class="[
            reviewThreadStateClass(thread),
            { 'is-loading': isReviewThreadResolving(thread) },
          ]"
          :disabled="isReviewThreadResolving(thread)"
          :aria-label="reviewThreadActionLabel(thread)"
          :title="reviewThreadActionLabel(thread)"
          @click="toggleReviewThread(thread)"
        >
          <component
            :is="thread.isResolved ? XIcon : CheckIcon"
            :size="13"
            :stroke-width="2.5"
            aria-hidden="true"
          />
          <span>{{ reviewThreadStateLabel(thread) }}</span>
        </button>
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
        </div>
        <div class="pr-review-diff-viewer__review-comment-body content">
          <MarkdownRenderer
            v-if="comment.body"
            :value="comment.body"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
          <p v-else class="has-text-grey mb-0">
            {{ t('prReview.noReviewCommentBody') }}
          </p>
        </div>
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

.pr-review-diff-viewer__thread-action {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;
  gap: 0.25rem;
  height: 1.5rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.pr-review-diff-viewer__thread-action--resolved {
  border-color: color-mix(in srgb, var(--gitpulse-success) 42%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-success) 12%, var(--gitpulse-surface));
  color: var(--gitpulse-success);
}

.pr-review-diff-viewer__thread-action--unresolved {
  border-color: color-mix(in srgb, var(--gitpulse-warning) 42%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-warning) 12%, var(--gitpulse-surface));
  color: var(--gitpulse-warning);
}

.pr-review-diff-viewer__review-comment {
  position: relative;
  padding: 0.6rem 0.7rem;
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
