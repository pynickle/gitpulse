<template>
  <div>
    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <MessageSquareIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('discussionDetail.metadata') }}</span>
        </div>
      </div>
      <div class="sidebar-card__content">
        <div class="info-list">
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.author') }}</span>
            <span v-if="discussion.author" class="info-item__value">
              <span class="info-item__avatar">
                <img
                  :src="discussion.author.avatarUrl || ''"
                  :alt="discussion.author.login || t('discussionDetail.authorFallback')"
                />
              </span>
              {{ discussion.author.login }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('discussionDetail.authorFallback') }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.category') }}</span>
            <span v-if="discussion.category" class="info-item__value">
              <TagIcon :size="12" />
              {{ discussion.category.name }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('discussionDetail.noCategory') }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.state') }}</span>
            <span class="info-item__value">
              <CheckCircle2Icon
                v-if="discussion.isAnswered"
                :size="12"
                class="state-icon state-icon--answered"
              />
              <CircleIcon v-else :size="12" class="state-icon state-icon--unanswered" />
              {{
                discussion.isAnswered
                  ? t('discussionDetail.answered')
                  : t('discussionDetail.unanswered')
              }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.created') }}</span>
            <span class="info-item__value">{{ createdAtLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.updated') }}</span>
            <span class="info-item__value">{{ updatedAtLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.comments') }}</span>
            <span class="info-item__value">
              <MessageSquareIcon :size="12" />
              {{ discussion.comments.totalCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="discussion.url" class="sidebar-card">
      <div class="sidebar-card__content">
        <a :href="discussion.url" target="_blank" rel="noopener noreferrer" class="sidebar-link">
          <ExternalLinkIcon :size="14" />
          <span>{{ t('discussionDetail.viewOnGithub') }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  TagIcon,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import type { DiscussionDetailPayload } from '#shared/types/discussions';

const props = defineProps<{
  discussion: DiscussionDetailPayload;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);

const createdAtLabel = computed(() =>
  props.discussion.createdAt
    ? formatDurationFromNow(props.discussion.createdAt, localeCode.value, relativeTimeNow.value)
    : t('discussionDetail.notAvailable')
);

const updatedAtLabel = computed(() =>
  props.discussion.updatedAt
    ? formatDurationFromNow(props.discussion.updatedAt, localeCode.value, relativeTimeNow.value)
    : t('discussionDetail.notAvailable')
);
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.sidebar-card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: $brand-primary;
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: -0.01em;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.info-item__label {
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  flex-shrink: 0;
}

.info-item__value {
  font-size: 12px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: right;
}

.info-item__value--muted {
  color: var(--gitpulse-text-subtle);
}

.info-item__avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.state-icon--answered {
  color: var(--gitpulse-success);
}

.state-icon--unanswered {
  color: var(--gitpulse-text-muted);
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }
}
</style>
