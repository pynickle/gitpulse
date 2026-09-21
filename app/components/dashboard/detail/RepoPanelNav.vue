<script setup lang="ts">
import { computed, type Component } from 'vue';

import FilterDropdown, { type FilterOption } from '~/components/ui/FilterDropdown.vue';

export interface RepoPanelNavTab<V extends string = string> {
  value: V;
  label: string;
  icon: Component;
}

const props = defineProps<{
  tabs: RepoPanelNavTab[];
  modelValue: string;
  /** Accessible name for the tablist / dropdown control group. */
  label: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const activeIndex = computed(() => props.tabs.findIndex((tab) => tab.value === props.modelValue));

/* Below 1024px the tab strip collapses to a dropdown, mirroring the profile
   page tab nav: four icon tabs overflow a phone-width pane otherwise. */
const dropdownOptions = computed<FilterOption[]>(() =>
  props.tabs.map((tab) => ({ value: tab.value, label: tab.label, icon: tab.icon }))
);

const selectByIndex = (index: number) => {
  const tab = props.tabs[index];
  if (tab) emit('update:modelValue', tab.value);
};

const handleTablistKeydown = (event: KeyboardEvent) => {
  handleRovingTablistKeydown(event, {
    itemCount: props.tabs.length,
    activeIndex: activeIndex.value,
    onSelect: selectByIndex,
  });
};
</script>

<template>
  <div class="repo-panel-nav">
    <nav
      class="repo-panel-nav__tabs"
      role="tablist"
      :aria-label="label"
      @keydown="handleTablistKeydown"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="repo-panel-nav__tab"
        :class="{ 'is-active': modelValue === tab.value }"
        :aria-selected="modelValue === tab.value"
        :tabindex="modelValue === tab.value ? 0 : -1"
        @click="emit('update:modelValue', tab.value)"
      >
        <component :is="tab.icon" :size="14" class="repo-panel-nav__icon" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="repo-panel-nav__select">
      <FilterDropdown
        :model-value="modelValue"
        :options="dropdownOptions"
        :aria-label="label"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.repo-panel-nav {
  min-width: 0;
}

.repo-panel-nav__tabs {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  min-width: 0;
  padding: 0 0.15rem;
  border-bottom: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
}

.repo-panel-nav__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: -1px;
  padding: 0.5rem 0.75rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover:not(.is-active) {
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: -2px;
    border-radius: 4px;
  }

  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-bottom-color: var(--gitpulse-accent, var(--gitpulse-link));
  }
}

.repo-panel-nav__icon {
  flex-shrink: 0;
}

.repo-panel-nav__select {
  display: none;
}

@media (max-width: 1024px) {
  .repo-panel-nav__tabs {
    display: none;
  }

  .repo-panel-nav__select {
    display: block;
  }

  .repo-panel-nav__select :deep(.filter-dropdown),
  .repo-panel-nav__select :deep(.filter-dropdown-trigger) {
    width: 100%;
  }

  .repo-panel-nav__select :deep(.filter-dropdown-trigger) {
    justify-content: space-between;
    height: 2.25rem;
  }

  .repo-panel-nav__select :deep(.filter-dropdown-trigger-content) {
    flex: 1;
    min-width: 0;
  }
}
</style>
