<script setup lang="ts">
import { computed } from 'vue';

export type ReleaseTypeFilter = 'all' | 'stable' | 'prerelease' | 'draft';

const filter = defineModel<ReleaseTypeFilter>({ required: true });
const { t } = useI18n();
const filters = computed(() => [
  { value: 'all' as const, label: t('dashboard.filters.options.all') },
  { value: 'stable' as const, label: t('releasesPage.filterStable') },
  { value: 'prerelease' as const, label: t('releaseDetail.prerelease') },
  { value: 'draft' as const, label: t('releaseDetail.draft') },
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
      :data-filter="option.value"
      :aria-selected="filter === option.value"
      :tabindex="filter === option.value ? 0 : -1"
      @click="filter = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.release-drawer-list__filters button {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  cursor: pointer;
}
.release-drawer-list__filters [aria-selected='true'] {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-link);
  border-color: var(--gitpulse-info);
}
.release-drawer-list__filters button:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}
</style>
