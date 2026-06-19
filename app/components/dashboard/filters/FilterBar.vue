<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import { computed } from 'vue';

import FilterAutocomplete from '~/components/ui/FilterAutocomplete.vue';
import FilterPill from '~/components/ui/FilterPill.vue';
import type {
  DashboardFilterChip,
  DashboardFilterSource,
  DashboardRouteFilters,
} from '~/composables/useDashboardFilters';

const props = defineProps<{
  currentTab: DashboardFilterSource;
  filters: DashboardRouteFilters;
  chips: DashboardFilterChip[];
  repoSuggestions?: string[];
  authorSuggestions?: string[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<DashboardRouteFilters>];
  remove: [chip: DashboardFilterChip];
  clear: [];
}>();

const { t } = useI18n();

// ─── Repo pill (autocomplete) ──────────────────────────────────
const repoValue = computed(() => props.filters.repo ?? '');
const repoActive = computed(() => Boolean(props.filters.repo));
const repoSuggestionsMapped = computed(() =>
  (props.repoSuggestions ?? []).map((r) => ({ value: r }))
);

const handleRepoChange = (value: string) => {
  emit('update', { repo: value || undefined });
};

// ─── Author pill (autocomplete) ────────────────────────────────
const authorValue = computed(() => props.filters.author ?? '');
const authorActive = computed(() => Boolean(props.filters.author));
const authorSuggestionsMapped = computed(() =>
  (props.authorSuggestions ?? []).map((a) => ({ value: a }))
);

const handleAuthorChange = (value: string) => {
  emit('update', { author: value || undefined });
};

// ─── Chip helpers ──────────────────────────────────────────────
const chipValueLabel = (chip: DashboardFilterChip) => {
  return chip.labelValue.startsWith('dashboard.') ? t(chip.labelValue) : chip.labelValue;
};

const hasMultipleFilters = computed(() => props.chips.length >= 2);
const advancedFilterKeys = new Set<DashboardFilterChip['key']>([
  'labels',
  'subjectType',
  'review',
  'archived',
  'sort',
  'order',
]);

// State is handled by FilterSegmentedControl in the header, so hide it from chips.
const segmentedControlKeys = new Set<DashboardFilterChip['key']>(['state']);

const primaryChips = computed(() =>
  props.chips.filter(
    (chip) => !advancedFilterKeys.has(chip.key) && !segmentedControlKeys.has(chip.key)
  )
);
const advancedChips = computed(() =>
  props.chips.filter(
    (chip) => advancedFilterKeys.has(chip.key) && !segmentedControlKeys.has(chip.key)
  )
);

const showPills = computed(() => props.currentTab !== 'repos');
</script>

<template>
  <div class="filter-bar">
    <!-- Repo & Author autocomplete pills -->
    <div v-if="showPills" class="filter-bar__pills">
      <FilterPill
        :label="t('dashboard.filters.repo')"
        :value="repoValue"
        :placeholder="t('dashboard.filters.repoPlaceholder')"
        :active="repoActive"
      >
        <div class="filter-bar__autocomplete-panel">
          <FilterAutocomplete
            :suggestions="repoSuggestionsMapped"
            :model-value="repoValue"
            :placeholder="t('dashboard.filters.repoPlaceholder')"
            @update:model-value="handleRepoChange"
          />
        </div>
      </FilterPill>

      <FilterPill
        :label="t('dashboard.filters.author')"
        :value="authorValue"
        :placeholder="t('dashboard.filters.authorPlaceholder')"
        :active="authorActive"
      >
        <div class="filter-bar__autocomplete-panel">
          <FilterAutocomplete
            :suggestions="authorSuggestionsMapped"
            :model-value="authorValue"
            :placeholder="t('dashboard.filters.authorPlaceholder')"
            @update:model-value="handleAuthorChange"
          />
        </div>
      </FilterPill>
    </div>

    <!-- Active filter chips -->
    <TransitionGroup
      v-if="primaryChips.length > 0"
      name="filter-bar-chip"
      tag="div"
      class="filter-bar__chips filter-bar__chips--primary"
    >
      <button
        v-for="chip in primaryChips"
        :key="`${chip.key}:${chip.value}`"
        class="filter-bar__chip"
        type="button"
        :title="t('dashboard.filters.removeFilter', { value: chipValueLabel(chip) })"
        @click="emit('remove', chip)"
      >
        <span class="filter-bar__chip-label">
          {{ t(chip.labelKey) }}: {{ chipValueLabel(chip) }}
        </span>
        <XIcon :size="12" aria-hidden="true" />
      </button>

      <button
        v-if="hasMultipleFilters && advancedChips.length === 0"
        key="clear"
        class="filter-bar__clear"
        type="button"
        @click="emit('clear')"
      >
        {{ t('dashboard.filters.clearAll') }}
      </button>
    </TransitionGroup>

    <TransitionGroup
      v-if="advancedChips.length > 0"
      name="filter-bar-chip"
      tag="div"
      class="filter-bar__chips filter-bar__chips--advanced"
    >
      <button
        v-for="chip in advancedChips"
        :key="`${chip.key}:${chip.value}`"
        class="filter-bar__chip"
        type="button"
        :title="t('dashboard.filters.removeFilter', { value: chipValueLabel(chip) })"
        @click="emit('remove', chip)"
      >
        <span class="filter-bar__chip-label">
          {{ t(chip.labelKey) }}: {{ chipValueLabel(chip) }}
        </span>
        <XIcon :size="12" aria-hidden="true" />
      </button>

      <button
        v-if="hasMultipleFilters"
        key="clear"
        class="filter-bar__clear"
        type="button"
        @click="emit('clear')"
      >
        {{ t('dashboard.filters.clearAll') }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--gitpulse-border);
  min-width: 0;
}

// ─── Pills row ────────────────────────────────────────────────
.filter-bar__pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

// ─── Panels inside FilterPill ──────────────────────────────────
.filter-bar__autocomplete-panel {
  padding: 0.5rem;
  min-width: 220px;
}

// ─── Chips row ─────────────────────────────────────────────────
.filter-bar__chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-width: 0;
}

.filter-bar__chips--advanced {
  flex-basis: 100%;
}

.filter-bar__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 9999px;
  background: var(--gitpulse-surface-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.75rem;
  color: var(--bulma-text);
  cursor: pointer;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    border-color 0.12s ease,
    color 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-danger);
    color: var(--gitpulse-danger);
  }
}

.filter-bar__chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ─── Clear button ──────────────────────────────────────────────
.filter-bar__clear {
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.75rem;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  padding: 0.125rem 0.25rem;
  border: none;
  background: transparent;
  border-radius: var(--gitpulse-radius-sm);
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-danger);
  }
}

// ─── Mobile adjustments ──────────────────────────────────────
@media (max-width: 860px) {
  .filter-bar__pills {
    flex-basis: 100%;
  }
}

// ─── Chip transition ───────────────────────────────────────────
.filter-bar-chip-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.filter-bar-chip-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.filter-bar-chip-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.filter-bar-chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.filter-bar-chip-move {
  transition: transform 0.2s ease;
}
</style>
