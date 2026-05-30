<template>
  <div class="quick-filters">
    <div class="quick-filters__group" v-if="options.length > 0">
      <h3 class="quick-filters__title">{{ t('dashboard.widgets.filters.title') }}</h3>
      <div class="quick-filters__list">
        <label
          class="quick-filters__item"
          v-for="option in options"
          :key="option.value"
          :class="{ 'is-active': selectedValues.includes(option.value) }"
        >
          <input
            type="checkbox"
            :value="option.value"
            v-model="selectedValues"
            @change="onChange"
            class="is-hidden"
          />
          <span class="quick-filters__checkbox">
            <svg
              v-if="selectedValues.includes(option.value)"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              stroke="currentColor"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <span class="quick-filters__label">{{ option.label }}</span>
        </label>
      </div>
    </div>
    <div v-else class="quick-filters__empty">
      <p>{{ t('dashboard.widgets.filters.empty') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const { t } = useI18n();

const props = defineProps<{
  currentTab: string;
  filters?: Record<string, boolean>;
}>();

const emit = defineEmits<{
  'filter-change': [filters: Record<string, boolean>];
}>();

// Filter options mapped by tab
const TAB_OPTIONS = computed<Record<string, { label: string; value: string }[]>>(() => ({
  issues: [
    { label: t('dashboard.widgets.filters.options.open'), value: 'open' },
    { label: t('dashboard.widgets.filters.options.closed'), value: 'closed' },
  ],
  pulls: [
    { label: t('dashboard.widgets.filters.options.open'), value: 'open' },
    { label: t('dashboard.widgets.filters.options.closed'), value: 'closed' },
    { label: t('dashboard.widgets.filters.options.merged'), value: 'merged' },
  ],
  notifications: [
    { label: t('dashboard.widgets.filters.options.unread'), value: 'unread' },
    { label: t('dashboard.widgets.filters.options.read'), value: 'read' },
  ],
}));

const options = computed(() => {
  return TAB_OPTIONS.value[props.currentTab] || [];
});

// Initialize selected values from props.filters
const selectedValues = ref<string[]>([]);

// When props change, update local state
watch(
  () => props.filters,
  (newFilters) => {
    if (!newFilters) {
      selectedValues.value = [];
      return;
    }
    selectedValues.value = Object.entries(newFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => key);
  },
  { immediate: true, deep: true }
);

const onChange = () => {
  // Convert array back to object Record<string, boolean>
  const newFilters: Record<string, boolean> = {};

  // Set all current options to false by default to ensure we send the full state
  options.value.forEach((opt) => {
    newFilters[opt.value] = false;
  });

  // Set checked ones to true
  selectedValues.value.forEach((val) => {
    newFilters[val] = true;
  });

  emit('filter-change', newFilters);
};
</script>

<style scoped lang="scss">
.quick-filters {
  &__group {
    margin-bottom: 1.5rem;
  }

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--gitpulse-text-muted);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__empty {
    color: var(--gitpulse-text-muted);
    font-size: 0.875rem;
    font-style: italic;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: -0.75rem; /* pull left to align text while keeping padding */
    margin-right: -0.75rem;

    &:hover {
      background-color: var(--bulma-background-hover);

      .quick-filters__checkbox {
        border-color: var(--gitpulse-border-strong);
      }
    }

    &.is-active {
      .quick-filters__checkbox {
        background-color: var(--bulma-primary);
        border-color: var(--bulma-primary);
        color: #ffffff;
      }

      .quick-filters__label {
        color: var(--bulma-text-strong);
        font-weight: 500;
      }
    }
  }

  &__checkbox {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid var(--gitpulse-border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    color: transparent;
  }

  &__label {
    font-size: 0.875rem;
    color: var(--bulma-text);
    transition: color 0.2s ease;
    user-select: none;
  }
}
</style>
