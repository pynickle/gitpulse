<script setup lang="ts">
import { FlaskConicalIcon, LayoutGridIcon, PencilLineIcon, RocketIcon } from '@lucide/vue';
import { computed, type Component } from 'vue';

export type ReleaseTypeFilter = 'all' | 'stable' | 'prerelease' | 'draft';

interface ReleaseFilterOption {
  value: ReleaseTypeFilter;
  label: string;
  icon: Component;
  color: string;
}

const filter = defineModel<ReleaseTypeFilter>({ required: true });
const { t } = useI18n();
const filters = computed<ReleaseFilterOption[]>(() => [
  {
    value: 'all',
    label: t('dashboard.filters.options.all'),
    icon: LayoutGridIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'stable',
    label: t('releasesPage.filterStable'),
    icon: RocketIcon,
    color: 'var(--gitpulse-success)',
  },
  {
    value: 'prerelease',
    label: t('releaseDetail.prerelease'),
    icon: FlaskConicalIcon,
    color: 'var(--gitpulse-info)',
  },
  {
    value: 'draft',
    label: t('releaseDetail.draft'),
    icon: PencilLineIcon,
    color: 'var(--gitpulse-warning, #b58a00)',
  },
]);
const handleFilterKeydown = (event: KeyboardEvent) => {
  handleRovingTablistKeydown(event, {
    itemCount: filters.value.length,
    activeIndex: filters.value.findIndex((option) => option.value === filter.value),
    onSelect: (index) => {
      const option = filters.value[index];
      if (option) filter.value = option.value;
    },
  });
};
</script>

<template>
  <div
    class="release-drawer-list__filters"
    role="tablist"
    :aria-label="t('releasesPage.filterLabel')"
    @keydown="handleFilterKeydown"
  >
    <button
      v-for="option in filters"
      :key="option.value"
      type="button"
      role="tab"
      class="release-drawer-list__filter"
      :data-filter="option.value"
      :aria-selected="filter === option.value"
      :tabindex="filter === option.value ? 0 : -1"
      :style="filter === option.value ? { '--filter-color': option.color } : undefined"
      @click="filter = option.value"
    >
      <component :is="option.icon" :size="13" class="release-drawer-list__filter-icon" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-list__filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.release-drawer-list__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.68rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &[aria-selected='true'] {
    border-color: var(--filter-color, var(--gitpulse-info));
    background: color-mix(in srgb, var(--filter-color, var(--gitpulse-info)) 10%, transparent);
    color: var(--filter-color, var(--gitpulse-info));
    font-weight: 600;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-info);
    outline-offset: 2px;
  }
}

.release-drawer-list__filter-icon {
  flex-shrink: 0;
}
</style>
