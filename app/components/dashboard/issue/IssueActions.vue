<!--suppress CssUnusedSymbol -->
<template>
  <div>
    <!-- Lock/Unlock action -->
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

    <!-- Additional info section -->
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
          <div class="info-item">
            <span class="info-item__label">{{ t('issueDetail.assignee') }}</span>
            <span v-if="assignee" class="info-item__value">
              <span class="info-item__avatar">
                <img :src="assignee.avatar_url || ''" :alt="assignee.login" />
              </span>
              {{ assignee.login }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('issueDetail.noAssignee') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- GitHub link -->
    <div class="sidebar-card">
      <div class="sidebar-card__content">
        <a :href="htmlUrl" target="_blank" rel="noopener noreferrer" class="sidebar-link">
          <ExternalLinkIcon :size="14" />
          <span>{{ t('issueDetail.viewOnGithub') }}</span>
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
  LockIcon,
  Loader2Icon,
  UnlockIcon,
  XIcon,
} from 'lucide-vue-next';
import { onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LockReasonModal from './LockReasonModal.vue';

const props = defineProps<{
  isLocked: boolean;
  canLockIssue: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber: number | undefined;
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  assignee: any | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:isLocked', isLocked: boolean): void;
  (e: 'add-timeline-event', event: any): void;
}>();

const { t } = useI18n();
const { user } = useUserSession();
const { openModal, closeModal } = useModalState();

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
    const lockEvent = {
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
  } catch (err: any) {
    console.error('Error locking issue:', err);
    lockError.value = err.message || t('issueDetail.failedToLockIssue');
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
    const unlockEvent = {
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
  } catch (err: any) {
    console.error('Error unlocking issue:', err);
    lockError.value = err.message || t('issueDetail.failedToUnlockIssue');
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

<!--suppress CssUnusedSymbol -->
<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

// Sidebar card wrapper
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

// Badge
.sidebar-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  letter-spacing: 0.02em;
}

// Alert
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

// Action button
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

// Info list
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

// Link inside card
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

// Spin animation
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
