<script setup lang="ts">
import { useId } from 'vue';

import type {
  DashboardFilterSource,
  DashboardRouteFilters,
  DashboardRouteState,
} from '~/composables/useDashboardFilters';

const props = defineProps<{
  currentTab: DashboardFilterSource;
  filters: DashboardRouteFilters;
  repoSuggestions?: string[];
  authorSuggestions?: string[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<DashboardRouteFilters>];
}>();

const { t } = useI18n();
const componentId = useId();
const repoListId = `${componentId}-repos`;
const authorListId = `${componentId}-authors`;

const stateOptions = computed<{ value: DashboardRouteState | ''; label: string }[]>(() => {
  if (props.currentTab === 'notifications') {
    return [
      { value: '', label: t('dashboard.filters.options.all') },
      { value: 'unread', label: t('dashboard.filters.options.unread') },
      { value: 'read', label: t('dashboard.filters.options.read') },
    ];
  }

  if (props.currentTab === 'pulls') {
    return [
      { value: '', label: t('dashboard.filters.options.open') },
      { value: 'closed', label: t('dashboard.filters.options.closed') },
      { value: 'merged', label: t('dashboard.filters.options.merged') },
      { value: 'all', label: t('dashboard.filters.options.all') },
    ];
  }

  if (props.currentTab === 'issues') {
    return [
      { value: '', label: t('dashboard.filters.options.open') },
      { value: 'closed', label: t('dashboard.filters.options.closed') },
      { value: 'all', label: t('dashboard.filters.options.all') },
    ];
  }

  return [];
});

const selectedState = computed(() => props.filters.state ?? '');

const updateState = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as DashboardRouteState | '';
  emit('update', { state: value || undefined });
};

const updateText = (key: 'repo' | 'author', event: Event) => {
  const value = (event.target as HTMLInputElement).value.trim();
  emit('update', { [key]: value || undefined });
};
</script>

<template>
  <div class="dashboard-filter-toolbar">
    <label v-if="stateOptions.length > 0" class="dashboard-filter-toolbar__control">
      <span class="dashboard-filter-toolbar__label">{{ t('dashboard.filters.state') }}</span>
      <span class="select is-small">
        <select :value="selectedState" @change="updateState">
          <option
            v-for="option in stateOptions"
            :key="option.value || 'default'"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </span>
    </label>

    <label v-if="currentTab !== 'repos'" class="dashboard-filter-toolbar__control">
      <span class="dashboard-filter-toolbar__label">{{ t('dashboard.filters.repo') }}</span>
      <input
        class="input is-small"
        type="text"
        :value="filters.repo ?? ''"
        :placeholder="t('dashboard.filters.repoPlaceholder')"
        :list="repoListId"
        @change="updateText('repo', $event)"
      />
      <datalist :id="repoListId">
        <option v-for="repo in repoSuggestions" :key="repo" :value="repo" />
      </datalist>
    </label>

    <label v-if="currentTab !== 'repos'" class="dashboard-filter-toolbar__control">
      <span class="dashboard-filter-toolbar__label">{{ t('dashboard.filters.author') }}</span>
      <input
        class="input is-small"
        type="text"
        :value="filters.author ?? ''"
        :placeholder="t('dashboard.filters.authorPlaceholder')"
        :list="authorListId"
        @change="updateText('author', $event)"
      />
      <datalist :id="authorListId">
        <option v-for="author in authorSuggestions" :key="author" :value="author" />
      </datalist>
    </label>
  </div>
</template>

<style scoped lang="scss">
.dashboard-filter-toolbar {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 0.65rem;
  min-width: 0;
}

.dashboard-filter-toolbar__control {
  display: grid;
  min-width: 9rem;
  gap: 0.25rem;
}

.dashboard-filter-toolbar__label {
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.dashboard-filter-toolbar__control .input,
.dashboard-filter-toolbar__control .select,
.dashboard-filter-toolbar__control select {
  width: 100%;
}
</style>
