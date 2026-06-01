<template>
  <div>
    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <UsersIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('prReview.reviewers') }}</span>
        </div>
        <span v-if="requestedReviewers.length > 0" class="sidebar-badge">
          {{ requestedReviewers.length }}
        </span>
      </div>
      <div class="sidebar-card__content">
        <div v-if="requestedReviewers.length > 0" class="reviewer-list">
          <div
            v-for="reviewer in requestedReviewers"
            :key="reviewer.id || reviewer.login"
            class="reviewer-item"
          >
            <img
              :src="reviewer.avatar_url || ''"
              :alt="reviewer.login"
              class="reviewer-item__avatar"
            />
            <span class="reviewer-item__name">{{ reviewer.login }}</span>
          </div>
        </div>
        <p v-else class="sidebar-card__empty">{{ t('prReview.noReviewers') }}</p>
      </div>
    </div>

    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <InfoIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('prReview.details') }}</span>
        </div>
      </div>
      <div class="sidebar-card__content">
        <div class="info-list">
          <div class="info-item">
            <span class="info-item__label">{{ t('prReview.created') }}</span>
            <span class="info-item__value">{{ formatDurationFromNow(createdAt, localeCode) }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('prReview.updated') }}</span>
            <span class="info-item__value">{{ formatDurationFromNow(updatedAt, localeCode) }}</span>
          </div>
          <div v-if="mergedAt" class="info-item">
            <span class="info-item__label">{{ t('prReview.merged') }}</span>
            <span class="info-item__value">{{ formatDurationFromNow(mergedAt, localeCode) }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('prReview.assignee') }}</span>
            <span v-if="assignee" class="info-item__value">
              <span class="info-item__avatar">
                <img :src="assignee.avatar_url || ''" :alt="assignee.login" />
              </span>
              {{ assignee.login }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('prReview.noAssignee') }}
            </span>
          </div>
          <div class="info-stats">
            <div class="info-stat">
              <span class="info-stat__value">{{ commits }}</span>
              <span class="info-stat__label">{{ t('prReview.commits') }}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat__value">{{ changedFiles }}</span>
              <span class="info-stat__label">{{ t('prReview.filesShort') }}</span>
            </div>
            <div class="info-stat info-stat--success">
              <span class="info-stat__value">+{{ additions }}</span>
              <span class="info-stat__label">{{ t('prReview.added') }}</span>
            </div>
            <div class="info-stat info-stat--danger">
              <span class="info-stat__value">-{{ deletions }}</span>
              <span class="info-stat__label">{{ t('prReview.removed') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-card__content">
        <a :href="htmlUrl" target="_blank" rel="noopener noreferrer" class="sidebar-link">
          <ExternalLinkIcon :size="14" />
          <span>{{ t('issueDetail.viewOnGithub') }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ExternalLinkIcon, InfoIcon, UsersIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import 'dayjs/locale/zh-cn';

const { t, locale } = useI18n();
const localeCode = computed(() => locale.value);

dayjs.extend(relativeTime);

interface PullRequestUserSummary {
  id?: number | string;
  login: string;
  avatar_url?: string | null;
}

defineProps<{
  requestedReviewers: PullRequestUserSummary[];
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  mergedAt: string | undefined;
  assignee: PullRequestUserSummary | undefined;
  commits: number | undefined;
  changedFiles: number | undefined;
  additions: number | undefined;
  deletions: number | undefined;
}>();

const formatDurationFromNow = (dateString: string | undefined, locale: string) => {
  if (!dateString) return '';
  dayjs.locale(locale);
  return dayjs(dateString).fromNow();
};
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

.sidebar-card__empty {
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
  border-radius: 10px;
}

.reviewer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reviewer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  transition: all 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
  }
}

.reviewer-item__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.reviewer-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
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

.info-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 4px;
}

.info-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
}

.info-stat__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.info-stat__label {
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
  margin-top: 2px;
}

.info-stat--success .info-stat__value {
  color: var(--gitpulse-success);
}

.info-stat--danger .info-stat__value {
  color: var(--gitpulse-danger);
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
