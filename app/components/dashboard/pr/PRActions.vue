<template>
  <div>
    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <UsersIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('prReview.reviewers') }}</span>
        </div>
        <div class="sidebar-card__header-actions">
          <span v-if="reviewerItems.length > 0" class="sidebar-badge">
            {{ reviewerItems.length }}
          </span>
          <button
            v-if="canRequestReviewers"
            class="reviewers-action-btn"
            type="button"
            :aria-label="t('prReview.reviewerPicker.requestReviewers')"
            :title="t('prReview.reviewerPicker.requestReviewers')"
            @click="emit('openReviewers')"
          >
            <PlusIcon :size="13" />
          </button>
        </div>
      </div>
      <div class="sidebar-card__content">
        <div v-if="reviewerItems.length > 0" class="reviewer-list">
          <div
            v-for="reviewer in reviewerItems"
            :key="reviewer.key"
            class="reviewer-item"
            :class="`reviewer-item--${reviewer.status}`"
          >
            <div class="reviewer-item__status-indicator">
              <component
                :is="getReviewerStatusIcon(reviewer.status)"
                :size="12"
                class="reviewer-item__status-icon"
              />
            </div>
            <GitHubAvatar
              v-if="reviewer.avatarUrl"
              :src="reviewer.avatarUrl"
              :alt="reviewer.name"
              size="20"
              class="reviewer-item__avatar"
            />
            <span v-else class="reviewer-item__avatar reviewer-item__avatar--fallback">
              <UsersIcon :size="13" />
            </span>
            <span class="reviewer-item__body">
              <span class="reviewer-item__name">{{ reviewer.name }}</span>
              <span class="reviewer-item__meta">
                <span class="reviewer-item__status-text">{{
                  getReviewerStatusLabel(reviewer.status)
                }}</span>
                <span v-if="reviewer.latestSubmittedAt" class="reviewer-item__time">
                  {{ formatRelativeTime(reviewer.latestSubmittedAt) }}
                </span>
                <span v-else-if="reviewer.latestCommentedAt" class="reviewer-item__time">
                  {{ formatRelativeTime(reviewer.latestCommentedAt) }}
                </span>
              </span>
            </span>
            <span v-if="reviewer.commentCount > 0" class="reviewer-item__badge">
              <MessageSquareIcon :size="10" />
              {{ reviewer.commentCount }}
            </span>
            <button
              v-if="canRequestReviewers && canRerequestReviewer(reviewer)"
              class="reviewer-item__action"
              type="button"
              :aria-label="t('prReview.reviewerPicker.rerequestReviewer')"
              :title="t('prReview.reviewerPicker.rerequestReviewer')"
              @click="emit('requestReviewer', reviewer)"
            >
              <RotateCcwIcon :size="13" />
            </button>
            <button
              v-if="canRequestReviewers && reviewer.removable"
              class="reviewer-item__action"
              type="button"
              :aria-label="t('prReview.reviewerPicker.removeReviewer')"
              :title="t('prReview.reviewerPicker.removeReviewer')"
              @click="emit('removeReviewer', reviewer)"
            >
              <XIcon :size="13" />
            </button>
          </div>
        </div>
        <p v-else class="sidebar-card__empty">{{ t('prReview.noReviewers') }}</p>
        <div v-if="reviewerWarnings.length > 0" class="reviewer-warning-list">
          <p
            v-for="warning in reviewerWarnings"
            :key="`${warning.source}:${warning.message}`"
            class="sidebar-card__warning"
          >
            {{ warning.message }}
          </p>
        </div>
        <p v-if="reviewerError" class="sidebar-card__error">
          {{ reviewerError }}
        </p>
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
            <span class="info-item__value">{{ formatRelativeTime(createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('prReview.updated') }}</span>
            <span class="info-item__value">{{ formatRelativeTime(updatedAt) }}</span>
          </div>
          <div v-if="mergedAt" class="info-item">
            <span class="info-item__label">{{ t('prReview.merged') }}</span>
            <span class="info-item__value">{{ formatRelativeTime(mergedAt) }}</span>
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

    <div v-if="sourceNotification" class="sidebar-card mb-4">
      <div class="sidebar-card__content">
        <button class="sidebar-action-btn" @click="handleToggleTodo">
          <ListPlusIcon v-if="!isTodo" :size="14" />
          <ListMinusIcon v-else :size="14" />
          <span>{{ todoLabel }}</span>
        </button>
      </div>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-card__content">
        <a :href="htmlUrl" target="_blank" rel="noopener noreferrer" class="sidebar-link">
          <ExternalLinkIcon :size="14" />
          <span>{{ t('detailActions.viewOnGithub') }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  InfoIcon,
  ListMinusIcon,
  ListPlusIcon,
  MessageSquareIcon,
  PlusIcon,
  RotateCcwIcon,
  SlashIcon,
  UsersIcon,
  XIcon,
} from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import type { DashboardNotification } from '#shared/types/notifications';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type {
  PRReviewerStatus,
  PRReviewerSummaryItem,
  PRReviewersSummary,
} from '~/composables/usePRReviewers';

const { t, locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

interface PullRequestUserSummary {
  id?: number | string;
  login: string;
  avatar_url?: string | null;
}

interface PullRequestTeamSummary {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string | null;
  html_url?: string | null;
  url?: string | null;
}

const props = defineProps<{
  requestedReviewers: PullRequestUserSummary[];
  requestedTeams: PullRequestTeamSummary[];
  reviewers?: PRReviewersSummary;
  reviewerError?: string;
  canRequestReviewers: boolean;
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  mergedAt: string | undefined;
  commits: number | undefined;
  changedFiles: number | undefined;
  additions: number | undefined;
  deletions: number | undefined;
  sourceNotification?: DashboardNotification | null;
}>();

const emit = defineEmits<{
  openReviewers: [];
  requestReviewer: [reviewer: PRReviewerSummaryItem];
  removeReviewer: [reviewer: PRReviewerSummaryItem];
}>();

const { isNotificationTodo, toggleNotificationTodo } = useNotificationTodos();

const isTodo = computed(() =>
  props.sourceNotification ? isNotificationTodo(props.sourceNotification) : false
);

const todoLabel = computed(() =>
  isTodo.value ? t('dashboard.todos.removeAction') : t('dashboard.todos.addAction')
);

const handleToggleTodo = () => {
  if (props.sourceNotification) {
    toggleNotificationTodo(props.sourceNotification);
  }
};

const reviewerItems = computed<PRReviewerSummaryItem[]>(() => {
  if (props.reviewers?.items?.length) {
    return props.reviewers.items;
  }

  const requestedUsers = props.requestedReviewers.flatMap((reviewer) => {
    const login = reviewer.login?.trim();
    if (!login) return [];

    return [
      {
        key: `user:${login.toLowerCase()}`,
        kind: 'user' as const,
        id: reviewer.id ? String(reviewer.id) : undefined,
        login,
        name: login,
        avatarUrl: reviewer.avatar_url,
        status: 'requested' as const,
        reviewCount: 0,
        commentCount: 0,
        requested: true,
        removable: true,
      },
    ];
  });

  const requestedTeams = props.requestedTeams.flatMap((team) => {
    const slug = team.slug?.trim();
    if (!slug) return [];

    const name = team.name?.trim() || slug;
    return [
      {
        key: `team:${slug.toLowerCase()}`,
        kind: 'team' as const,
        id: team.id ? String(team.id) : undefined,
        nodeId: team.node_id,
        slug,
        name,
        url: team.html_url ?? team.url,
        status: 'requested' as const,
        reviewCount: 0,
        commentCount: 0,
        requested: true,
        removable: true,
      },
    ];
  });

  return [...requestedUsers, ...requestedTeams];
});

const reviewerWarnings = computed(() => props.reviewers?.warnings ?? []);
const reviewerError = computed(() => props.reviewerError?.trim() || '');

const canRerequestReviewer = (reviewer: PRReviewerSummaryItem) => {
  if (reviewer.requested || reviewer.removable) return false;
  if (reviewer.kind === 'team') return Boolean(reviewer.slug);
  return Boolean(reviewer.login && reviewer.reviewCount > 0);
};

const getReviewerStatusLabel = (status: PRReviewerStatus) => {
  switch (status) {
    case 'approved':
      return t('prReview.eventApprove');
    case 'changes_requested':
      return t('prReview.eventRequestChanges');
    case 'commented':
      return t('prReview.eventComment');
    case 'dismissed':
      return t('prReview.timelineDismissed');
    case 'pending':
      return t('prReview.timelineStartedReview');
    case 'requested':
      return t('prReview.status.requested');
    default:
      return t('prReview.status.unknown');
  }
};

const getReviewerStatusIcon = (status: PRReviewerStatus) => {
  switch (status) {
    case 'approved':
      return CheckIcon;
    case 'changes_requested':
      return XIcon;
    case 'commented':
      return MessageSquareIcon;
    case 'dismissed':
      return SlashIcon;
    case 'requested':
    case 'pending':
    default:
      return ClockIcon;
  }
};

const formatRelativeTime = (dateString: string | undefined) => {
  if (!dateString) return '';
  return formatDurationFromNow(dateString, locale.value, relativeTimeNow.value);
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

.sidebar-card__header-actions {
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
  letter-spacing: 0;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.sidebar-card__empty {
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.reviewer-warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.sidebar-card__warning {
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.sidebar-card__error {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--bulma-danger, #cc0f35);
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

.reviewers-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }
}

.reviewer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reviewer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  transition: all 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
  }

  &--approved {
    border-left: 2px solid var(--gitpulse-success);
  }

  &--changes_requested {
    border-left: 2px solid var(--gitpulse-danger);
  }

  &--commented {
    border-left: 2px solid var(--gitpulse-info);
  }

  &--requested,
  &--pending {
    border-left: 2px solid var(--gitpulse-warning);
  }

  &--dismissed {
    border-left: 2px solid var(--gitpulse-text-muted);
  }
}

.reviewer-item__status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;

  .reviewer-item--approved & {
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  .reviewer-item--changes_requested & {
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  .reviewer-item--commented & {
    background: var(--gitpulse-info-soft);
    color: var(--gitpulse-info);
  }

  .reviewer-item--requested &,
  .reviewer-item--pending & {
    background: var(--gitpulse-warning-soft);
    color: var(--gitpulse-warning);
  }

  .reviewer-item--dismissed &,
  .reviewer-item--unknown & {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-muted);
  }
}

.reviewer-item__status-icon {
  width: 12px;
  height: 12px;
}

.reviewer-item__avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.reviewer-item__avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
}

.reviewer-item__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.reviewer-item__name {
  font-size: 12px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.reviewer-item__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--gitpulse-text-subtle);
  line-height: 1.3;
}

.reviewer-item__status-text {
  color: inherit;
}

.reviewer-item__time {
  color: var(--gitpulse-text-muted);
}

.reviewer-item__badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
  border-radius: 10px;
  flex-shrink: 0;
}

.reviewer-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--gitpulse-text-muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  opacity: 0.6;

  &:hover {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    background: var(--gitpulse-surface-hover);
    opacity: 1;
  }
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

.sidebar-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
