<script setup lang="ts">
import { CheckCircle2Icon } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionReply } from '#shared/types/discussions';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

defineProps<{
  answer: DiscussionReply;
  repoOwner: string;
  repoName: string;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);
</script>

<template>
  <section class="discussion-answer">
    <div class="discussion-answer__label">
      <CheckCircle2Icon :size="16" />
      <span>{{ t('discussionDetail.acceptedAnswer') }}</span>
    </div>

    <div class="discussion-answer__header">
      <RoundImg
        width="28"
        height="28"
        :src="answer.author?.avatarUrl || ''"
        :alt="answer.author?.login || t('discussionDetail.authorFallback')"
      />
      <a
        v-if="answer.author?.url"
        :href="answer.author.url"
        target="_blank"
        rel="noopener"
        class="has-text-weight-medium has-text-link"
      >
        {{ answer.author.login }}
      </a>
      <span v-else class="has-text-weight-medium">
        {{ answer.author?.login || t('discussionDetail.authorFallback') }}
      </span>
      <span class="is-size-7 has-text-grey">
        {{ formatDurationFromNow(answer.createdAt || '', localeCode, relativeTimeNow) }}
      </span>
    </div>

    <div class="discussion-answer__body content">
      <MarkdownRenderer
        v-if="answer.body"
        :value="answer.body"
        :repo-owner="repoOwner"
        :repo-name="repoName"
      />
      <p v-else class="has-text-grey is-size-7">
        {{ t('discussionDetail.noCommentBody') }}
      </p>
    </div>
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
