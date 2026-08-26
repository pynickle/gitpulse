<script setup lang="ts">
import { computed } from 'vue';

import type { LinkedPullRequestPickerRow } from '#shared/types/linked-pull-requests';

const props = defineProps<{
  row: LinkedPullRequestPickerRow;
}>();

const emit = defineEmits<{
  select: [];
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const visual = computed(() =>
  getPullRequestStateVisual({
    state:
      props.row.state === 'merged'
        ? 'closed'
        : props.row.state === 'draft'
          ? 'open'
          : props.row.state,
    merged: props.row.state === 'merged',
    draft: props.row.state === 'draft',
  })
);

const stateLabel = computed(() => {
  if (props.row.state === 'draft') return t('dashboard.linkedPullRequests.stateDraft');
  if (props.row.state === 'merged') return t('dashboard.linkedPullRequests.stateMerged');
  if (props.row.state === 'closed') return t('dashboard.linkedPullRequests.stateClosed');
  return t('dashboard.linkedPullRequests.stateOpen');
});

const accessibleName = computed(() => {
  const parts = [props.row.title, `#${props.row.number}`, stateLabel.value];
  if (props.row.showRepository) {
    parts.push(`${props.row.owner}/${props.row.repo}`);
  }
  return parts.filter(Boolean).join(', ');
});

const updatedLabel = computed(() => {
  if (!props.row.updatedAt) return '';
  return formatDurationFromNow(props.row.updatedAt, localeCode.value, relativeTimeNow.value);
});
</script>

<template>
  <button
    class="linked-pr-picker-row"
    type="button"
    :aria-label="accessibleName"
    @click="emit('select')"
  >
    <component
      :is="visual.icon"
      :size="16"
      class="linked-pr-picker-row-icon"
      :style="{ color: visual.color }"
      aria-hidden="true"
    />
    <span class="linked-pr-picker-row-text">
      <span class="linked-pr-picker-row-title">{{ row.title }}</span>
      <span class="linked-pr-picker-row-meta">
        <span v-if="row.authorLogin">{{ row.authorLogin }}</span>
        <span v-if="row.authorLogin && row.updatedAt"> · </span>
        <span v-if="row.updatedAt">{{ updatedLabel }}</span>
        <span> · #{{ row.number }}</span>
        <span v-if="row.showRepository"> · {{ row.owner }}/{{ row.repo }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.linked-pr-picker-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px;
  margin: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover,
  &:focus-visible {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -2px;
  }
}

.linked-pr-picker-row-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.linked-pr-picker-row-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.linked-pr-picker-row-title {
  font-size: 13px;
  font-weight: 550;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-pr-picker-row-meta {
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
