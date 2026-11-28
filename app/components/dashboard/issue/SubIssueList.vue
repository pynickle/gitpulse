<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { SubIssueIdentity, SubIssueProgress } from '#shared/types/sub-issues';
import { readSubIssueProgress, toSubIssueRows } from '#shared/utils/sub-issues';

import SubIssueRows from './SubIssueRows.vue';

const { issue, progress } = defineProps<{ issue: SubIssueIdentity; progress: SubIssueProgress }>();
const emit = defineEmits<{ select: [identity: SubIssueIdentity] }>();
const { t } = useI18n();
const { connection, loading, failed, load } = useSubIssues(issue);
const rows = computed(() => toSubIssueRows(connection.value?.nodes ?? [], issue));
const currentProgress = computed(
  () =>
    readSubIssueProgress({
      total: connection.value?.totalCount,
      completed: connection.value?.completedCount,
    }) ?? progress
);
</script>

<template>
  <details open class="sub-issue-list">
    <summary class="sub-issue-list__summary">
      <ChevronRightIcon :size="14" class="sub-issue-list__chevron" aria-hidden="true" />
      <span>{{ t('dashboard.subIssues.title') }}</span>
      <span
        class="sub-issue-list__count"
        :aria-label="t('dashboard.subIssues.progress', { ...currentProgress })"
      >
        {{ currentProgress.completed }}/{{ currentProgress.total }}
      </span>
    </summary>
    <SubIssueRows :rows="rows" @select="emit('select', $event)" />
    <p v-if="loading" class="sub-issue-list__status" role="status">
      {{ t('dashboard.subIssues.loading') }}
    </p>
    <div v-else-if="failed" class="sub-issue-list__status">
      <p role="alert">{{ t('dashboard.subIssues.error') }}</p>
      <button type="button" class="gp-btn gp-btn--small" @click="load">
        {{ t('dashboard.subIssues.retry') }}
      </button>
    </div>
    <p v-else-if="connection && !rows.length" class="sub-issue-list__status">
      {{ t('dashboard.subIssues.empty') }}
    </p>
  </details>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.sub-issue-list {
  margin-block-start: 1rem;
  padding-block-start: 0.75rem;
  border-block-start: 1px solid var(--gitpulse-border);
  font-size: 0.875rem;
}

.sub-issue-list__summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--gitpulse-radius-sm);
  list-style: none;
  color: var(--gitpulse-text-strong);
  font-weight: 600;
  cursor: pointer;

  &::-webkit-details-marker {
    display: none;
  }

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: -2px;
  }
}

.sub-issue-list__chevron,
.sub-issue-list__count,
.sub-issue-list__status {
  color: var(--gitpulse-text-muted);
}

.sub-issue-list[open] .sub-issue-list__chevron {
  rotate: 90deg;
}

@media (prefers-reduced-motion: no-preference) {
  .sub-issue-list__chevron {
    transition: rotate 0.2s ease;
  }

  @supports (interpolate-size: allow-keywords) and selector(details::details-content) {
    .sub-issue-list::details-content {
      block-size: 0;
      overflow: clip;
      contain: layout;
      interpolate-size: allow-keywords;
      transition:
        block-size 0.2s ease,
        content-visibility 0.2s allow-discrete;
    }

    .sub-issue-list[open]::details-content {
      block-size: auto;
    }
  }
}

.sub-issue-list__count {
  font-size: 0.75rem;
  font-weight: 500;
}

.sub-issue-list__status {
  padding: 0.4rem 0.5rem;

  .gp-btn {
    margin-block-start: 0.35rem;
  }
}
</style>
