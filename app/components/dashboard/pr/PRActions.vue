<template>
  <div class="detail-sidebar-panel">
    <section class="sidebar-section sidebar-section--card">
      <header class="sidebar-section__header sidebar-section__header--row">
        <div class="sidebar-section__header-left">
          <UsersIcon :size="14" class="sidebar-section__icon" />
          <h3 class="sidebar-section__title">{{ t('prReview.reviewers') }}</h3>
        </div>
        <div class="sidebar-section__header-actions">
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
      </header>
      <div class="sidebar-section__body">
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
        <p v-else class="sidebar-section__empty">{{ t('prReview.noReviewers') }}</p>
        <div v-if="reviewerWarnings.length > 0" class="reviewer-warning-list">
          <p
            v-for="warning in reviewerWarnings"
            :key="`${warning.source}:${warning.message}`"
            class="sidebar-section__warning"
          >
            {{ warning.message }}
          </p>
        </div>
        <p v-if="reviewerError" class="sidebar-section__error">
          {{ reviewerError }}
        </p>
      </div>
    </section>

    <section class="sidebar-section sidebar-section--card">
      <header class="sidebar-section__header">
        <InfoIcon :size="14" class="sidebar-section__icon" />
        <h3 class="sidebar-section__title">{{ t('prReview.details') }}</h3>
      </header>
      <div class="sidebar-section__body">
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
    </section>

    <section class="sidebar-section">
      <header class="sidebar-section__header">
        <Settings2Icon :size="14" class="sidebar-section__icon" />
        <h3 class="sidebar-section__title">{{ t('detailActions.manage') }}</h3>
      </header>
      <div class="sidebar-section__body">
        <div v-if="stateError" class="sidebar-alert sidebar-alert--error">
          <AlertCircleIcon :size="14" />
          <span>{{ stateError }}</span>
          <button type="button" class="sidebar-alert__dismiss" @click="clearStateError">
            <XIcon :size="12" />
          </button>
        </div>
        <div class="sidebar-action-stack">
          <button
            type="button"
            class="sidebar-action-btn sidebar-action-btn--review"
            :disabled="!canOpenReview"
            @click="emit('openReview')"
          >
            <span class="sidebar-action-btn__icon" aria-hidden="true">
              <EyeIcon :size="14" />
            </span>
            <span class="sidebar-action-btn__label">{{ t('prReview.openReview') }}</span>
            <ChevronRightIcon :size="14" class="sidebar-action-btn__chevron" aria-hidden="true" />
          </button>
          <button
            v-if="showManageActions"
            type="button"
            class="sidebar-action-btn"
            :class="isClosed ? 'sidebar-action-btn--reopen' : 'sidebar-action-btn--close'"
            :disabled="loadingState"
            @click="isClosed ? updatePullRequestState('open') : updatePullRequestState('closed')"
          >
            <span class="sidebar-action-btn__icon" aria-hidden="true">
              <Loader2Icon v-if="loadingState" class="spin-animation" :size="14" />
              <CircleSlashIcon v-else-if="!isClosed" :size="14" />
              <GitPullRequestIcon v-else :size="14" />
            </span>
            <span>{{
              isClosed ? t('prReview.reopenPullRequest') : t('prReview.closePullRequest')
            }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="sourceNotification" class="sidebar-section">
      <header class="sidebar-section__header">
        <LinkIcon :size="14" class="sidebar-section__icon" />
        <h3 class="sidebar-section__title">{{ t('detailActions.links') }}</h3>
      </header>
      <div class="sidebar-section__body">
        <div class="sidebar-action-stack">
          <button
            type="button"
            class="sidebar-action-btn"
            :class="isTodo ? 'sidebar-action-btn--todo-active' : 'sidebar-action-btn--todo'"
            @click="handleToggleTodo"
          >
            <span class="sidebar-action-btn__icon" aria-hidden="true">
              <ListPlusIcon v-if="!isTodo" :size="14" />
              <ListMinusIcon v-else :size="14" />
            </span>
            <span>{{ todoLabel }}</span>
          </button>
        </div>
      </div>
    </section>

    <a
      v-if="htmlUrl"
      :href="htmlUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="sidebar-github-link"
    >
      <GitHubIcon :size="14" aria-hidden="true" />
      <span>{{ t('detailActions.viewOnGithub') }}</span>
      <ExternalLinkIcon :size="12" aria-hidden="true" />
    </a>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleSlashIcon,
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  GitPullRequestIcon,
  InfoIcon,
  LinkIcon,
  ListMinusIcon,
  ListPlusIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  RotateCcwIcon,
  Settings2Icon,
  SlashIcon,
  UsersIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { GitHubIcon } from 'vue3-simple-icons';

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
  canOpenReview?: boolean;
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  mergedAt: string | undefined;
  commits: number | undefined;
  changedFiles: number | undefined;
  additions: number | undefined;
  deletions: number | undefined;
  sourceNotification?: DashboardNotification | null;
  prState: string | undefined;
  merged: boolean;
  canManageState: boolean;
  repoInfo: { owner: string; repo: string } | null;
  prNumber: number | undefined;
}>();

const emit = defineEmits<{
  openReviewers: [];
  openReview: [];
  requestReviewer: [reviewer: PRReviewerSummaryItem];
  removeReviewer: [reviewer: PRReviewerSummaryItem];
  stateUpdated: [state: 'open' | 'closed'];
}>();

const apiFetch = useGitPulseApiFetch();

const isClosed = computed(() => props.prState === 'closed');

// Merged pull requests can never be reopened or closed again.
const showManageActions = computed(() => props.canManageState && !props.merged);

const loadingState = ref(false);
const stateError = ref('');
let stateErrorTimer: ReturnType<typeof setTimeout> | null = null;

const clearStateError = () => {
  if (stateErrorTimer) {
    clearTimeout(stateErrorTimer);
    stateErrorTimer = null;
  }
  stateError.value = '';
};

onUnmounted(() => {
  if (stateErrorTimer) {
    clearTimeout(stateErrorTimer);
    stateErrorTimer = null;
  }
});

const updatePullRequestState = async (state: 'open' | 'closed') => {
  if (!showManageActions.value || !props.repoInfo || !props.prNumber) return;

  loadingState.value = true;
  clearStateError();

  try {
    const { owner, repo } = props.repoInfo;
    await apiFetch(`/api/repos/${owner}/${repo}/pulls/${props.prNumber}/state`, {
      method: 'PATCH',
      body: { state },
    });

    emit('stateUpdated', state);
  } catch (err: unknown) {
    console.error('Error updating pull request state:', err);
    stateError.value = getFetchErrorMessage(
      err,
      state === 'closed'
        ? t('prReview.failedToClosePullRequest')
        : t('prReview.failedToReopenPullRequest')
    );
    stateErrorTimer = setTimeout(() => {
      stateError.value = '';
      stateErrorTimer = null;
    }, 5000);
  } finally {
    loadingState.value = false;
  }
};

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

.detail-sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-section {
  min-width: 0;
}

.sidebar-section--card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;

  .sidebar-section__header {
    padding: 10px 14px;
    margin: 0;
    border-bottom: 1px solid var(--gitpulse-border);
    background: var(--gitpulse-surface);
  }

  .sidebar-section__body {
    padding: 12px 14px;
  }
}

.sidebar-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.sidebar-section__header--row {
  justify-content: space-between;
}

.sidebar-section__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sidebar-section__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-section__icon {
  flex-shrink: 0;
  color: $brand-primary;
}

.sidebar-section__title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--gitpulse-text-muted);
}

.sidebar-section--card .sidebar-section__title {
  text-transform: none;
  letter-spacing: 0;
  font-size: 13px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.sidebar-section__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sidebar-section__empty {
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.sidebar-section__warning {
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.sidebar-section__error {
  margin: 0;
  font-size: 11px;
  color: var(--bulma-danger, #cc0f35);
}

.reviewer-warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.sidebar-action-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease,
    box-shadow 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.sidebar-action-btn__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 6px;
  background: var(--gitpulse-surface-hover);
  color: inherit;
}

.sidebar-action-btn__label {
  flex: 1;
  min-width: 0;
}

.sidebar-action-btn__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition:
    transform 0.12s ease,
    color 0.12s ease;
}

// Primary PR action — profile "starred" row language.
.sidebar-action-btn--review {
  color: var(--gitpulse-text-strong);
  border-color: color-mix(in srgb, var(--gitpulse-accent) 28%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-accent-soft) 55%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-accent) 14%, transparent);
    color: var(--gitpulse-accent);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-text-strong);
    border-color: color-mix(in srgb, var(--gitpulse-accent) 48%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-accent-soft) 78%, var(--gitpulse-surface));

    .sidebar-action-btn__chevron {
      transform: translateX(2px);
      color: var(--gitpulse-accent);
    }
  }
}

// Close: destructive intent when the PR is currently open.
.sidebar-action-btn--close {
  color: var(--gitpulse-danger);
  border-color: color-mix(in srgb, var(--gitpulse-danger) 28%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-danger-soft) 70%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-danger) 12%, transparent);
    color: var(--gitpulse-danger);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-danger);
    border-color: color-mix(in srgb, var(--gitpulse-danger) 55%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-danger-soft) 90%, var(--gitpulse-surface));
  }
}

// Reopen: positive recovery when the PR is currently closed.
.sidebar-action-btn--reopen {
  color: var(--gitpulse-success);
  border-color: color-mix(in srgb, var(--gitpulse-success) 28%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-success-soft) 70%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-success) 12%, transparent);
    color: var(--gitpulse-success);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-success);
    border-color: color-mix(in srgb, var(--gitpulse-success) 55%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-success-soft) 90%, var(--gitpulse-surface));
  }
}

.sidebar-action-btn--todo {
  color: var(--gitpulse-text-strong);
  border-color: var(--gitpulse-border);
  background: var(--gitpulse-surface);

  .sidebar-action-btn__icon {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-muted);
  }
}

.sidebar-action-btn--todo-active {
  color: var(--gitpulse-accent);
  border-color: color-mix(in srgb, var(--gitpulse-accent) 32%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-accent-soft) 50%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-accent) 14%, transparent);
    color: var(--gitpulse-accent);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-accent);
    border-color: color-mix(in srgb, var(--gitpulse-accent) 48%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-accent-soft) 72%, var(--gitpulse-surface));
  }
}

// Profile-style escape hatch: quiet footer link, not another full-width button.
.sidebar-github-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  margin-top: 0.15rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
    border-radius: var(--gitpulse-radius-sm, 6px);
  }
}

.sidebar-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
}

.sidebar-alert--error {
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
}

.sidebar-alert__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: auto;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--gitpulse-danger);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-danger-soft);
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
