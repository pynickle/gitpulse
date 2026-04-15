<template>
  <div>
    <!-- Lock/Unlock button -->
    <div class="mb-4">
      <div v-if="lockError" class="notification is-danger is-light mb-3 py-2 px-3">
        <button class="delete is-small" @click="lockError = ''"></button>
        <p class="is-size-7">{{ lockError }}</p>
      </div>
      <button
        v-if="canLockIssue"
        :class="['button', 'is-small', isLocked ? 'is-danger' : 'is-warning']"
        @click="isLocked ? unlockIssue() : (showLockReasonModal = true)"
        :disabled="loadingLock"
      >
        <span v-if="loadingLock" class="icon is-small mr-2">
          <Loader2Icon class="is-spinning" :size="14" />
        </span>
        {{ isLocked ? t('issueDetail.unlockIssue') : t('issueDetail.lockIssue') }}
      </button>
    </div>

    <!-- GitHub link -->
    <div class="mb-4">
      <a
        :href="htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="button is-small is-fullwidth"
      >
        {{ t('issueDetail.viewOnGithub') }}
      </a>
    </div>

    <!-- Additional info section -->
    <div class="mb-4">
      <h3 class="title is-6 mb-3">{{ t('issueDetail.additionalInfo') }}</h3>
      <div class="is-size-7 has-text-grey">
        <p class="mb-2">
          {{ t('issueDetail.created', { date: formatDate(createdAt) }) }}
        </p>
        <p class="mb-2">
          {{ t('issueDetail.updated', { date: formatDate(updatedAt) }) }}
        </p>
        <p v-if="assignee" class="mb-2">
          {{ t('issueDetail.assignee', { assignee: assignee.login }) }}
        </p>
        <p v-else class="mb-2">{{ t('issueDetail.noAssignee') }}</p>
      </div>
    </div>

    <!-- Lock reason modal -->
    <LockReasonModal
      :is-visible="showLockReasonModal"
      :loading="loadingLock"
      @close="showLockReasonModal = false"
      @confirm="confirmLockIssue"
    />
  </div>
</template>

<script setup lang="ts">
import { Loader2Icon } from 'lucide-vue-next';
import { ref } from 'vue';
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

// State variables
const showLockReasonModal = ref(false);
const loadingLock = ref(false);
const lockError = ref<string>('');

const confirmLockIssue = async (lockReason: string) => {
  if (!props.canLockIssue || !props.repoInfo || !props.issueNumber) return;

  loadingLock.value = true;
  lockError.value = '';

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
    showLockReasonModal.value = false;
  } catch (err: any) {
    console.error('Error locking issue:', err);
    lockError.value = err.message || t('issueDetail.failedToLockIssue');
    setTimeout(() => {
      lockError.value = '';
    }, 5000);
  } finally {
    loadingLock.value = false;
  }
};

const unlockIssue = async () => {
  if (!props.canLockIssue || !props.repoInfo || !props.issueNumber) return;

  loadingLock.value = true;
  lockError.value = '';

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
    setTimeout(() => {
      lockError.value = '';
    }, 5000);
  } finally {
    loadingLock.value = false;
  }
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString();
};
</script>
