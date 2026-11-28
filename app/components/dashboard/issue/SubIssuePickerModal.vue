<script setup lang="ts">
import { ListTreeIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { SubIssueIdentity } from '#shared/types/sub-issues';
import { toSubIssueRows } from '#shared/utils/sub-issues';
import PickerModal from '~/components/dashboard/PickerModal.vue';

import SubIssueRows from './SubIssueRows.vue';

const { issue } = defineProps<{ issue: SubIssueIdentity }>();
const emit = defineEmits<{ close: []; select: [identity: SubIssueIdentity] }>();
const { t } = useI18n();
const { connection, loading, failed, load } = useSubIssues(issue);
const rows = computed(() => toSubIssueRows(connection.value?.nodes ?? [], issue));
</script>

<template>
  <PickerModal
    :is-visible="true"
    :title="t('dashboard.subIssues.title')"
    :close-label="t('dashboard.subIssues.close')"
    :loading-label="loading ? t('dashboard.subIssues.loading') : ''"
    :error="failed ? t('dashboard.subIssues.error') : ''"
    :empty-label="connection && !rows.length ? t('dashboard.subIssues.empty') : ''"
    @close="emit('close')"
  >
    <template #empty-icon><ListTreeIcon :size="24" aria-hidden="true" /></template>
    <SubIssueRows :rows="rows" @select="emit('select', $event)" />
    <template #footer>
      <button
        v-if="failed"
        type="button"
        class="gp-btn gp-btn--small sub-issue-picker-modal__retry"
        @click="load"
      >
        {{ t('dashboard.subIssues.retry') }}
      </button>
    </template>
  </PickerModal>
</template>

<style scoped lang="scss">
.sub-issue-picker-modal__retry {
  margin-top: 0.5rem;
}
</style>
