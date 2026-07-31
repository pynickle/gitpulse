<template>
  <div class="detail-sidebar-panel">
    <section class="sidebar-section sidebar-section--card">
      <header class="sidebar-section__header">
        <InfoIcon :size="14" class="sidebar-section__icon" />
        <h3 class="sidebar-section__title">{{ t('issueDetail.additionalInfo') }}</h3>
      </header>
      <div class="sidebar-section__body">
        <div class="info-list">
          <div class="info-item">
            <span class="info-item__label">{{ t('issueDetail.created') }}</span>
            <span class="info-item__value">{{ formatDate(createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('issueDetail.updated') }}</span>
            <span class="info-item__value">{{ formatDate(updatedAt) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="showManageActions" class="sidebar-section">
      <header class="sidebar-section__header">
        <Settings2Icon :size="14" class="sidebar-section__icon" />
        <h3 class="sidebar-section__title">{{ t('detailActions.manage') }}</h3>
      </header>
      <div class="sidebar-section__body">
        <div v-if="lockError" class="sidebar-alert sidebar-alert--error">
          <AlertCircleIcon :size="14" />
          <span>{{ lockError }}</span>
          <button type="button" class="sidebar-alert__dismiss" @click="clearLockError">
            <XIcon :size="12" />
          </button>
        </div>
        <div v-if="stateError" class="sidebar-alert sidebar-alert--error">
          <AlertCircleIcon :size="14" />
          <span>{{ stateError }}</span>
          <button type="button" class="sidebar-alert__dismiss" @click="clearStateError">
            <XIcon :size="12" />
          </button>
        </div>
        <div class="sidebar-action-stack">
          <button
            v-if="canManageState"
            type="button"
            class="sidebar-action-btn"
            :class="isClosed ? 'sidebar-action-btn--reopen' : 'sidebar-action-btn--close'"
            :disabled="loadingState"
            @click="isClosed ? reopenIssue() : closeIssue()"
          >
            <span class="sidebar-action-btn__icon" aria-hidden="true">
              <Loader2Icon v-if="loadingState" class="spin-animation" :size="14" />
              <CircleCheckIcon v-else-if="!isClosed" :size="14" />
              <CircleDotIcon v-else :size="14" />
            </span>
            <span>{{ isClosed ? t('issueDetail.reopenIssue') : t('issueDetail.closeIssue') }}</span>
          </button>
          <button
            v-if="canLockIssue"
            type="button"
            class="sidebar-action-btn"
            :class="isLocked ? 'sidebar-action-btn--unlock' : 'sidebar-action-btn--lock'"
            :disabled="loadingLock"
            @click="isLocked ? unlockIssue() : openLockModal()"
          >
            <span class="sidebar-action-btn__icon" aria-hidden="true">
              <Loader2Icon v-if="loadingLock" class="spin-animation" :size="14" />
              <LockIcon v-else-if="!isLocked" :size="14" />
              <UnlockIcon v-else :size="14" />
            </span>
            <span>{{ isLocked ? t('issueDetail.unlockIssue') : t('issueDetail.lockIssue') }}</span>
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

    <LockReasonModal
      :is-visible="showLockReasonModal"
      :loading="loadingLock"
      @close="closeLockModal"
      @confirm="confirmLockIssue"
    />
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  InfoIcon,
  LinkIcon,
  ListMinusIcon,
  ListPlusIcon,
  LockIcon,
  Loader2Icon,
  Settings2Icon,
  UnlockIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { GitHubIcon } from 'vue3-simple-icons';

import type { DashboardNotification } from '#shared/types/notifications';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

import LockReasonModal from './LockReasonModal.vue';

const props = defineProps<{
  isLocked: boolean;
  canLockIssue: boolean;
  canManageState: boolean;
  issueState: string | undefined;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber: number | undefined;
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  sourceNotification?: DashboardNotification | null;
}>();

const emit = defineEmits<{
  (e: 'update:isLocked', isLocked: boolean): void;
  (e: 'update:state', state: 'open' | 'closed', stateReason: string | null): void;
  (e: 'add-timeline-event', event: IssueTimelineItem): void;
}>();

const { locale, t } = useI18n();
const { user } = useUserSession();
const { openModal, closeModal } = useModalState();
const { isNotificationTodo, toggleNotificationTodo } = useNotificationTodos();
const apiFetch = useGitPulseApiFetch();

const isTodo = computed(() =>
  props.sourceNotification ? isNotificationTodo(props.sourceNotification) : false
);

const todoLabel = computed(() =>
  isTodo.value ? t('dashboard.todos.removeAction') : t('dashboard.todos.addAction')
);

const showManageActions = computed(() => props.canLockIssue || props.canManageState);

const handleToggleTodo = () => {
  if (props.sourceNotification) {
    toggleNotificationTodo(props.sourceNotification);
  }
};

const isClosed = computed(() => props.issueState === 'closed');

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

const scheduleStateErrorClear = () => {
  if (stateErrorTimer) clearTimeout(stateErrorTimer);
  stateErrorTimer = setTimeout(() => {
    stateError.value = '';
    stateErrorTimer = null;
  }, 5000);
};

const currentActor = () => ({
  login: user.value?.login || '',
  avatarUrl: user.value?.avatar_url || '',
  url: user.value?.login ? `https://github.com/${user.value.login}` : '',
});

const updateIssueState = async (state: 'open' | 'closed') => {
  if (!props.canManageState || !props.repoInfo || !props.issueNumber) return;

  loadingState.value = true;
  clearStateError();

  try {
    const { owner, repo } = props.repoInfo;
    const result = await apiFetch<{ state: string; stateReason: string | null }>(
      `/api/repos/${owner}/${repo}/issues/${props.issueNumber}/state`,
      {
        method: 'PATCH',
        body: state === 'closed' ? { state, state_reason: 'completed' } : { state },
      }
    );

    emit('update:state', state, result.stateReason);
    emit('add-timeline-event', {
      kind: 'event',
      eventType: state === 'closed' ? 'closed' : 'reopened',
      id: `state-${Date.now()}`,
      actor: currentActor(),
      ...(state === 'closed' && result.stateReason ? { stateReason: result.stateReason } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('Error updating issue state:', err);
    stateError.value = getFetchErrorMessage(
      err,
      state === 'closed'
        ? t('issueDetail.failedToCloseIssue')
        : t('issueDetail.failedToReopenIssue')
    );
    scheduleStateErrorClear();
  } finally {
    loadingState.value = false;
  }
};

const closeIssue = () => updateIssueState('closed');
const reopenIssue = () => updateIssueState('open');

const showLockReasonModal = ref(false);
const loadingLock = ref(false);
const lockError = ref<string>('');
let lockErrorTimer: ReturnType<typeof setTimeout> | null = null;

const clearLockErrorTimer = () => {
  if (lockErrorTimer) {
    clearTimeout(lockErrorTimer);
    lockErrorTimer = null;
  }
};

const clearLockError = () => {
  clearLockErrorTimer();
  lockError.value = '';
};

const scheduleLockErrorClear = () => {
  clearLockErrorTimer();
  lockErrorTimer = setTimeout(() => {
    lockError.value = '';
    lockErrorTimer = null;
  }, 5000);
};

const openLockModal = () => {
  showLockReasonModal.value = true;
  openModal();
};

const closeLockModal = () => {
  showLockReasonModal.value = false;
  closeModal();
};

onUnmounted(() => {
  clearLockErrorTimer();
  if (stateErrorTimer) {
    clearTimeout(stateErrorTimer);
    stateErrorTimer = null;
  }
  if (showLockReasonModal.value) {
    closeModal();
  }
});

const confirmLockIssue = async (lockReason: string) => {
  if (!props.canLockIssue || !props.repoInfo || !props.issueNumber) return;

  loadingLock.value = true;
  clearLockError();

  try {
    const { owner, repo } = props.repoInfo;
    const issueNumber = props.issueNumber;

    await apiFetch(`/api/repos/${owner}/${repo}/issues/${issueNumber}/lock`, {
      method: 'PUT',
      body: {
        lock_reason: lockReason,
      },
    });

    const lockEvent: IssueTimelineItem = {
      kind: 'event',
      eventType: 'locked',
      id: `lock-${Date.now()}`,
      actor: currentActor(),
      lockReason: lockReason.toUpperCase().replace('-', '_'),
      createdAt: new Date().toISOString(),
    };

    emit('update:isLocked', true);
    emit('add-timeline-event', lockEvent);
    closeLockModal();
  } catch (err: unknown) {
    console.error('Error locking issue:', err);
    lockError.value = getFetchErrorMessage(err, t('issueDetail.failedToLockIssue'));
    scheduleLockErrorClear();
  } finally {
    loadingLock.value = false;
  }
};

const unlockIssue = async () => {
  if (!props.canLockIssue || !props.repoInfo || !props.issueNumber) return;

  loadingLock.value = true;
  clearLockError();

  try {
    const { owner, repo } = props.repoInfo;
    const issueNumber = props.issueNumber;

    await apiFetch(`/api/repos/${owner}/${repo}/issues/${issueNumber}/lock`, {
      method: 'DELETE',
    });

    const unlockEvent: IssueTimelineItem = {
      kind: 'event',
      eventType: 'unlocked',
      id: `unlock-${Date.now()}`,
      actor: currentActor(),
      createdAt: new Date().toISOString(),
    };

    emit('update:isLocked', false);
    emit('add-timeline-event', unlockEvent);
  } catch (err: unknown) {
    console.error('Error unlocking issue:', err);
    lockError.value = getFetchErrorMessage(err, t('issueDetail.failedToUnlockIssue'));
    scheduleLockErrorClear();
  } finally {
    loadingLock.value = false;
  }
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
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

.sidebar-action-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

// Close: destructive intent when the item is currently open.
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

// Reopen: positive recovery when the item is currently closed.
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

// Lock: caution / restrict conversation.
.sidebar-action-btn--lock {
  color: var(--gitpulse-warning);
  border-color: color-mix(in srgb, var(--gitpulse-warning) 28%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-warning-soft) 65%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-warning) 14%, transparent);
    color: var(--gitpulse-warning);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-warning);
    border-color: color-mix(in srgb, var(--gitpulse-warning) 50%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-warning-soft) 88%, var(--gitpulse-surface));
  }
}

// Unlock: restore conversation.
.sidebar-action-btn--unlock {
  color: var(--gitpulse-accent);
  border-color: color-mix(in srgb, var(--gitpulse-accent) 28%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-accent-soft) 55%, var(--gitpulse-surface));

  .sidebar-action-btn__icon {
    background: color-mix(in srgb, var(--gitpulse-accent) 14%, transparent);
    color: var(--gitpulse-accent);
  }

  &:hover:not(:disabled) {
    color: var(--gitpulse-accent);
    border-color: color-mix(in srgb, var(--gitpulse-accent) 48%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-accent-soft) 78%, var(--gitpulse-surface));
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
