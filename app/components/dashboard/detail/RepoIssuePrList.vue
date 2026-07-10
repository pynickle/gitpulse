<script setup lang="ts">
import { AlertTriangleIcon, Loader2Icon } from '@lucide/vue';
import { computed, toRef } from 'vue';

import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import IssuePrNotificationItem from '~/components/dashboard/IssuePrNotificationItem.vue';
import Button from '~/components/ui/Button.vue';
import { useRepoIssuePrList, type RepoIssuePrKind } from '~/composables/useRepoIssuePrList';
import type { DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';

const props = defineProps<{
  owner: string;
  repo: string;
  kind: RepoIssuePrKind;
}>();

const emit = defineEmits<{
  select: [item: DashboardIssuePrEntity];
}>();

const { t } = useI18n();

const { items, loading, error, pagination, goToPage, refresh } = useRepoIssuePrList(
  toRef(props, 'owner'),
  toRef(props, 'repo'),
  toRef(props, 'kind')
);

const emptyMessage = computed(() => {
  return props.kind === 'pulls' ? t('repoDetail.pullsEmpty') : t('repoDetail.issuesEmpty');
});

const showPagination = computed(() => {
  return (
    !loading.value &&
    !error.value &&
    (pagination.value.hasPrev || pagination.value.hasNext || (pagination.value.totalPages ?? 1) > 1)
  );
});

const handleSelect = (item: DashboardIssuePrEntity) => {
  emit('select', item);
};
</script>

<template>
  <section
    class="repo-issue-pr-list"
    :aria-label="kind === 'pulls' ? t('repoDetail.pulls') : t('repoDetail.issues')"
  >
    <div v-if="loading" class="repo-issue-pr-list__loading" aria-busy="true">
      <Loader2Icon :size="20" class="spin-animation" />
      <span>{{ t('repoDetail.loadingList') }}</span>
    </div>

    <div v-else-if="error" class="repo-issue-pr-list__error" role="alert">
      <div class="repo-issue-pr-list__error-icon" aria-hidden="true">
        <AlertTriangleIcon :size="28" />
      </div>
      <p class="repo-issue-pr-list__error-title">{{ t('repoDetail.listErrorTitle') }}</p>
      <p class="repo-issue-pr-list__error-message">{{ error }}</p>
      <Button color="primary" size="normal" @click="refresh">
        {{ t('repoDetail.retry') }}
      </Button>
    </div>

    <template v-else>
      <div v-if="items.length === 0" class="repo-issue-pr-list__empty">
        {{ emptyMessage }}
      </div>

      <div v-else class="repo-issue-pr-list__items">
        <button
          v-for="item in items"
          :key="String(item.id)"
          type="button"
          class="repo-issue-pr-list__item"
          @click="handleSelect(item)"
        >
          <IssuePrNotificationItem :item="item" />
        </button>
      </div>

      <DashboardPagination
        v-if="showPagination"
        class="repo-issue-pr-list__pagination"
        :pagination="pagination"
        @change="goToPage"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.repo-issue-pr-list {
  min-height: 8rem;
}

.repo-issue-pr-list__loading,
.repo-issue-pr-list__empty,
.repo-issue-pr-list__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.repo-issue-pr-list__error-icon {
  color: var(--gitpulse-warning, #d97706);
}

.repo-issue-pr-list__error-title {
  margin: 0;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.9375rem;
  font-weight: 600;
}

.repo-issue-pr-list__error-message {
  margin: 0 0 0.5rem;
  max-width: 28rem;
}

.repo-issue-pr-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.repo-issue-pr-list__item {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 2px;
  }

  :deep(.dashboard-list-card) {
    margin-bottom: 0;
    transition:
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  &:hover :deep(.dashboard-list-card) {
    border-color: var(--gitpulse-border-strong);
    box-shadow: var(--gitpulse-shadow-card);
  }
}

.repo-issue-pr-list__pagination {
  margin-top: 1rem;
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
