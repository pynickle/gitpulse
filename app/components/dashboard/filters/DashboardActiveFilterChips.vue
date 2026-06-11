<script setup lang="ts">
import { XIcon } from 'lucide-vue-next';

import type { DashboardFilterChip } from '~/composables/useDashboardFilters';

defineProps<{
  chips: DashboardFilterChip[];
}>();

const emit = defineEmits<{
  remove: [chip: DashboardFilterChip];
  clear: [];
}>();

const { t } = useI18n();

const chipValueLabel = (chip: DashboardFilterChip) => {
  return chip.labelValue.startsWith('dashboard.') ? t(chip.labelValue) : chip.labelValue;
};
</script>

<template>
  <div
    v-if="chips.length > 0"
    class="dashboard-filter-chips"
    :aria-label="t('dashboard.filters.active')"
  >
    <button
      v-for="chip in chips"
      :key="`${chip.key}:${chip.value}`"
      class="dashboard-filter-chips__chip"
      type="button"
      :title="t('dashboard.filters.removeFilter', { value: chipValueLabel(chip) })"
      @click="emit('remove', chip)"
    >
      <span class="dashboard-filter-chips__label">
        {{ t(chip.labelKey) }}: {{ chipValueLabel(chip) }}
      </span>
      <XIcon v-once :size="14" aria-hidden="true" />
    </button>

    <button
      v-if="chips.length > 1"
      class="button is-ghost is-small dashboard-filter-chips__clear"
      type="button"
      @click="emit('clear')"
    >
      {{ t('dashboard.filters.clearAll') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.dashboard-filter-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.dashboard-filter-chips__chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 0.35rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  background: var(--gitpulse-surface-muted);
  color: var(--bulma-text);
  font-size: 0.78rem;
  cursor: pointer;
}

.dashboard-filter-chips__chip:hover,
.dashboard-filter-chips__chip:focus-visible {
  border-color: var(--gitpulse-border-strong);
  color: var(--gitpulse-link);
}

.dashboard-filter-chips__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-filter-chips__clear {
  min-height: 1.75rem;
  color: var(--gitpulse-text-muted);
}
</style>
