<template>
  <ConfirmModal
    v-model="selectedReason"
    :is-visible="isVisible"
    :title="t('issueDetail.lockIssueReason')"
    :options="lockReasons"
    :cancel-label="t('issueDetail.cancel')"
    :confirm-label="loading ? t('issueDetail.locking') : t('issueDetail.lockIssue')"
    :confirm-disabled="!selectedReason"
    :saving="loading"
    :error="error"
    @close="$emit('close')"
    @confirm="confirmLock"
    @dismiss-error="$emit('dismiss-error')"
  />
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import ConfirmModal from '~/components/dashboard/ConfirmModal.vue';
import { resolveIssueTypeColor } from '~/utils/issueTypeColor';

defineProps<{
  isVisible: boolean;
  loading: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [lockReason: string];
  'dismiss-error': [];
}>();

const { t } = useI18n();
const selectedReason = shallowRef('');

const lockReasons = computed(() => [
  {
    value: 'off-topic',
    label: t('issueDetail.lockReasonOffTopic'),
    description: t('issueDetail.lockReasonOffTopicDesc'),
    color: resolveIssueTypeColor('blue'),
  },
  {
    value: 'too heated',
    label: t('issueDetail.lockReasonTooHeated'),
    description: t('issueDetail.lockReasonTooHeatedDesc'),
    color: resolveIssueTypeColor('orange'),
  },
  {
    value: 'resolved',
    label: t('issueDetail.lockReasonResolved'),
    description: t('issueDetail.lockReasonResolvedDesc'),
    color: resolveIssueTypeColor('green'),
  },
  {
    value: 'spam',
    label: t('issueDetail.lockReasonSpam'),
    description: t('issueDetail.lockReasonSpamDesc'),
    color: resolveIssueTypeColor('red'),
  },
]);

const confirmLock = () => {
  if (!selectedReason.value) return;
  emit('confirm', selectedReason.value);
  selectedReason.value = '';
};
</script>
