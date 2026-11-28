<script setup lang="ts">
import { CircleCheckIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionReply } from '#shared/types/discussions';
import CommentActions from '~/components/dashboard/comments/CommentActions.vue';
import CommentBody from '~/components/dashboard/comments/CommentBody.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { useCommentModeration } from '~/composables/useCommentModeration';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

defineProps<{
  answer: DiscussionReply;
  repoOwner: string;
  repoName: string;
}>();

const { stateFor } = useCommentModeration();
const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);
</script>

<template>
  <section v-if="!stateFor(answer.moderation).deleted" class="discussion-answer">
    <div class="discussion-answer__label">
      <CircleCheckIcon :size="16" />
      <span>{{ t('discussionDetail.acceptedAnswer') }}</span>
    </div>

    <div class="discussion-answer__header">
      <GitHubAvatar
        variant="raised"
        interactive
        width="28"
        height="28"
        :src="answer.author?.avatarUrl || ''"
        :alt="answer.author?.login || t('discussionDetail.authorFallback')"
      />
      <GitHubProfileLink
        v-if="answer.author?.login || answer.author?.url"
        :login="answer.author.login"
        :github-href="answer.author.url"
        class="discussion-answer__author discussion-answer__author--link"
      >
        {{ answer.author.login }}
      </GitHubProfileLink>
      <span v-else class="discussion-answer__author">
        {{ answer.author?.login || t('discussionDetail.authorFallback') }}
      </span>
      <span class="discussion-answer__meta">
        {{ formatDurationFromNow(answer.createdAt || '', localeCode, relativeTimeNow) }}
      </span>
      <CommentActions :target="answer.moderation" />
    </div>

    <CommentBody v-slot="{ body }" :target="answer.moderation" :body="answer.body">
      <div class="discussion-answer__body">
        <MarkdownRenderer v-if="body" :value="body" :repo-owner="repoOwner" :repo-name="repoName" />
        <p v-else class="discussion-answer__empty">
          {{ t('discussionDetail.noCommentBody') }}
        </p>
      </div>
    </CommentBody>
  </section>
</template>

<style scoped lang="scss">
.discussion-answer {
  border: 1px solid color-mix(in srgb, var(--gitpulse-success) 42%, var(--gitpulse-border));
  border-radius: 8px;
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--gitpulse-success) 9%, var(--gitpulse-surface));
}

.discussion-answer__label,
.discussion-answer__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.discussion-answer__label {
  color: var(--gitpulse-success);
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.discussion-answer__author {
  font-weight: 500;

  &--link {
    color: var(--gitpulse-link);
  }
}

.discussion-answer__meta,
.discussion-answer__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.discussion-answer__body {
  border-top: 1px solid var(--gitpulse-border);
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .discussion-answer__header {
    flex-wrap: wrap;
    gap: 0.375rem;
  }
}
</style>
