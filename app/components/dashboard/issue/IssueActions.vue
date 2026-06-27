<template>
  <div>
    <div v-if="canLockIssue" class="sidebar-card mb-4">
      <div class="sidebar-card__content">
        <div v-if="lockError" class="sidebar-alert sidebar-alert--error mb-3">
          <AlertCircleIcon :size="14" />
          <span>{{ lockError }}</span>
          <button class="sidebar-alert__dismiss" @click="clearLockError">
            <XIcon :size="12" />
          </button>
        </div>
        <button
          class="sidebar-action-btn"
          @click="isLocked ? unlockIssue() : openLockModal()"
          :disabled="loadingLock"
        >
          <Loader2Icon v-if="loadingLock" class="spin-animation" :size="14" />
          <LockIcon v-else-if="!isLocked" :size="14" />
          <UnlockIcon v-else :size="14" />
          <span>{{ isLocked ? t('issueDetail.unlockIssue') : t('issueDetail.lockIssue') }}</span>
        </button>
      </div>
    </div>

    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <InfoIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('issueDetail.additionalInfo') }}</span>
        </div>
      </div>
      <div class="sidebar-card__content">
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
  ExternalLinkIcon,
  InfoIcon,
  ListMinusIcon,
  ListPlusIcon,
  LockIcon,
  Loader2Icon,
  UnlockIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DashboardNotification } from '#shared/types/notifications';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

import LockReasonModal from './LockReasonModal.vue';

const props = defineProps<{
  isLocked: boolean;
  canLockIssue: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber: number | undefined;
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  sourceNotification?: DashboardNotification | null;
}>();

const emit = defineEmits<{
  (e: 'update:isLocked', isLocked: boolean): void;
  (e: 'add-timeline-event', event: IssueTimelineItem): void;
}>();

const { t } = useI18n();
const { user } = useUserSession();
const { openModal, closeModal } = useModalState();
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

    await $fetch(`/api/repos/${owner}/${repo}/issues/${issueNumber}/lock`, {
      method: 'PUT',
      body: {
        lock_reason: lockReason,
      },
    });

    // Add lock event to timeline manually
    const lockEvent: IssueTimelineItem = {
      kind: 'event',
      eventType: 'locked',
      id: `lock-${Date.now()}`,
      actor: {
        login: user.value?.login || 'You',
        avatarUrl: user.value?.avatar_url || 'https://github.com/placeholder.png',
        url: user.value?.login
          ? `https://github.com/${user.value.login}`
          : 'https://github.com/you',
      },
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

    await $fetch(`/api/repos/${owner}/${repo}/issues/${issueNumber}/lock`, {
      method: 'DELETE',
    });

    // Add unlock event to timeline manually
    const unlockEvent: IssueTimelineItem = {
      kind: 'event',
      eventType: 'unlocked',
      id: `unlock-${Date.now()}`,
      actor: {
        login: user.value?.login || 'You',
        avatarUrl: user.value?.avatar_url || 'https://github.com/placeholder.png',
        url: user.value?.login
          ? `https://github.com/${user.value.login}`
          : 'https://github.com/you',
      },
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
  return new Date(dateString).toLocaleString();
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
