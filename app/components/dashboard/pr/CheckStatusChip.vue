<script setup lang="ts">
import { computed } from 'vue';

import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
import { CHECK_ROLLUP_CONTEXT_LIMIT, toPullRequestChecksView } from '#shared/utils/pr-checks';

const props = defineProps<{
  /** The Check Rollup attached to the card. A rollup with no contexts shows nothing. */
  rollup: PullRequestCheckRollup | null | undefined;
}>();

const emit = defineEmits<{
  /** Emitted with the rollup so the Check List Modal can read the same view model. */
  open: [rollup: PullRequestCheckRollup];
}>();

const { t } = useI18n();

const view = computed(() => toPullRequestChecksView(props.rollup));

const countLabel = computed(() => {
  if (view.value.passedCount === null) return String(view.value.totalCount);
  return `${view.value.passedCount}/${view.value.totalCount}`;
});

const accessibleName = computed(() => {
  const { passedCount, totalCount, tone, isTruncated } = view.value;

  if (isTruncated) {
    return t('dashboard.checks.overLimit', {
      total: totalCount,
      limit: CHECK_ROLLUP_CONTEXT_LIMIT,
    });
  }

  if (tone === 'danger') {
    return t('dashboard.checks.chipFailed', {
      failed: totalCount - (passedCount ?? 0),
      total: totalCount,
    });
  }

  if (tone === 'warning') {
    return t('dashboard.checks.chipPending', { passed: passedCount ?? 0, total: totalCount });
  }

  return t('dashboard.checks.chipPassed', { passed: passedCount ?? 0, total: totalCount });
});

const handleClick = (event: MouseEvent) => {
  // Tapping the chip must not trigger the card's own row activation.
  event.stopPropagation();
  if (!props.rollup) return;
  emit('open', props.rollup);
};

const handleKeydown = (event: KeyboardEvent) => {
  event.stopPropagation();
};
</script>

<template>
  <button
    v-if="view.isVisible"
    class="check-status-chip"
    type="button"
    :class="`check-status-chip--${view.tone}`"
    :title="accessibleName"
    :aria-label="accessibleName"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <component :is="getCheckStatusToneIcon(view.tone)" :size="12" aria-hidden="true" />
    <span>{{ countLabel }}</span>
  </button>
</template>

<style scoped lang="scss">
.check-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: none;
  background: transparent;
  vertical-align: -0.05em;
  color: var(--gitpulse-text-muted, #6b7280);
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:hover {
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.check-status-chip--success {
  color: var(--gitpulse-success, #1a7f37);
}

.check-status-chip--danger {
  color: var(--gitpulse-danger, #cf222e);
}

.check-status-chip--warning {
  color: var(--gitpulse-warning, #bf8700);
}

/* A filled dot reads as "still running" where a clock would read as "waiting". */
.check-status-chip--warning > :first-child {
  fill: currentcolor;
}
</style>
