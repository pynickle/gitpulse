<template>
  <div class="mb-4">
    <!-- Tier 1: Eyebrow -->
    <div class="detail-header-eyebrow">
      <span class="header-repo">
        <GitForkIcon :size="13" class="header-repo__icon" aria-hidden="true" />
        <a class="header-repo__link" href="#" @click.prevent="handleRepoClick">
          {{ repoOwner }}/{{ repoName }}
        </a>
      </span>
      <span class="header-number">#{{ discussion.number }}</span>
    </div>

    <!-- Tier 2: Full-width Title -->
    <div class="detail-header-title">
      <h1 class="title is-3 mb-0 header-title__text">
        {{ discussion.title || t('discussionDetail.titleFallback') }}
      </h1>
    </div>

    <!-- Tier 3: Single-line Status Strip -->
    <div class="detail-header-status header-meta">
      <span
        class="header-state-tag"
        :class="discussion.isAnswered ? 'is-answered' : 'is-unanswered'"
      >
        <component :is="stateVisual.icon" :size="12" aria-hidden="true" />
        <span>{{ stateLabel }}</span>
      </span>
      <span v-if="discussion.locked" class="header-locked-tag">
        <LockIcon :size="12" aria-hidden="true" />
        <span>{{ t('discussionDetail.locked') }}</span>
      </span>
      <span class="header-time">
        <ClockIcon :size="13" aria-hidden="true" />
        <span>
          {{
            formatDurationFromNow(
              discussion.updatedAt || discussion.createdAt || '',
              localeCode,
              relativeTimeNow
            )
          }}
        </span>
      </span>
    </div>

    <hr class="header-rule" />
    <div data-detail-compact-threshold aria-hidden="true"></div>

    <!-- Author row -->
    <div>
      <div class="is-flex is-align-items-center mb-4">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-3"
          width="28"
          height="28"
          :src="discussion.author?.avatarUrl || ''"
          :alt="discussion.author?.login || t('discussionDetail.authorFallback')"
        />
        <div class="is-flex is-align-items-center is-flex-wrap-wrap header-author">
          <GitHubProfileLink
            v-if="discussion.author?.login || discussion.author?.url"
            :login="discussion.author.login"
            :github-href="discussion.author.url"
            class="header-author__name has-text-weight-medium has-text-link"
          >
            {{ discussion.author.login }}
          </GitHubProfileLink>
          <span v-else class="header-author__name has-text-weight-medium">
            {{ discussion.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="header-author__time">
            {{ formatDurationFromNow(discussion.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div>
        <MarkdownRenderer
          v-if="discussion.body"
          :value="discussion.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('discussionDetail.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClockIcon, GitForkIcon, LockIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const { locale, t } = useI18n();
const { openRepository } = useDashboardRepositoryNavigation();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const { discussion, repoOwner, repoName } = defineProps<{
  discussion: DiscussionDetailPayload;
  repoOwner: string;
  repoName: string;
}>();

const stateLabel = computed(() =>
  discussion.isAnswered ? t('discussionDetail.answered') : t('discussionDetail.unanswered')
);

const stateVisual = computed(() => getDashboardDiscussionStateVisual(discussion.isAnswered));

const handleRepoClick = async () => {
  await openRepository(repoOwner, repoName);
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/detail-header' as *;

@include detail-header-shared;

.header-state-tag {
  &.is-answered {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-unanswered {
    background-color: var(--gitpulse-surface-muted);
    color: var(--gitpulse-text);
    border: 1px solid var(--gitpulse-border);
  }
}

.header-locked-tag {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  background-color: var(--gitpulse-warning-soft);
  color: var(--gitpulse-warning-solid);
  border: 1px solid color-mix(in srgb, var(--gitpulse-warning) 24%, transparent);
}
</style>
