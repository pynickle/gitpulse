<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BellIcon,
  CheckCircleIcon,
  CircleDotIcon,
  CircleMinusIcon,
  ClockIcon,
  GitMergeIcon,
  LayoutGridIcon,
  ListTodoIcon,
} from '@lucide/vue';
import { computed } from 'vue';

import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import type {
  DashboardFilterSource,
  DashboardRouteSort,
  DashboardRouteFilters,
  DashboardRouteState,
} from '~/composables/useDashboardFilters';
import { sourceSupportsDashboardFilter } from '~/composables/useDashboardFilters';

const props = defineProps<{
  currentTab: DashboardFilterSource;
  filters: DashboardRouteFilters;
}>();

const emit = defineEmits<{
  update: [patch: Partial<DashboardRouteFilters>];
}>();

const { t } = useI18n();

// ─── State pill (segmented control) ────────────────────────────
const stateOptions = computed<SegmentedOption[]>(() => {
  if (props.currentTab === 'notifications') {
    return [
      {
        value: '',
        label: t('dashboard.filters.options.all'),
        icon: LayoutGridIcon,
        color: 'var(--gitpulse-text-muted)',
      },
      {
        value: 'unread',
        label: t('dashboard.filters.options.unread'),
        icon: BellIcon,
        color: 'var(--gitpulse-info)',
      },
      {
        value: 'read',
        label: t('dashboard.filters.options.read'),
        icon: CheckCircleIcon,
        color: 'var(--gitpulse-text-subtle)',
      },
    ];
  }

  if (props.currentTab === 'pulls') {
    return [
      {
        value: '',
        label: t('dashboard.filters.options.open'),
        icon: CircleDotIcon,
        color: 'var(--gitpulse-success)',
      },
      {
        value: 'closed',
        label: t('dashboard.filters.options.closed'),
        icon: CircleMinusIcon,
        color: 'var(--gitpulse-danger)',
      },
      {
        value: 'merged',
        label: t('dashboard.filters.options.merged'),
        icon: GitMergeIcon,
        color: 'var(--gitpulse-purple)',
      },
      {
        value: 'all',
        label: t('dashboard.filters.options.all'),
        icon: LayoutGridIcon,
        color: 'var(--gitpulse-text-muted)',
      },
    ];
  }

  if (props.currentTab === 'issues') {
    return [
      {
        value: '',
        label: t('dashboard.filters.options.open'),
        icon: CircleDotIcon,
        color: 'var(--gitpulse-success)',
      },
      {
        value: 'closed',
        label: t('dashboard.filters.options.closed'),
        icon: CircleMinusIcon,
        color: 'var(--gitpulse-danger)',
      },
      {
        value: 'all',
        label: t('dashboard.filters.options.all'),
        icon: LayoutGridIcon,
        color: 'var(--gitpulse-text-muted)',
      },
    ];
  }

  return [];
});

const selectedState = computed(() =>
  props.filters.state === 'open' ? '' : (props.filters.state ?? '')
);

const handleStateChange = (value: string) => {
  emit('update', { state: (value || undefined) as DashboardRouteState | undefined });
};

const todoSortOptions = computed<SegmentedOption[]>(() => [
  {
    value: 'added',
    label: t('dashboard.filters.options.added'),
    icon: ListTodoIcon,
    color: 'var(--gitpulse-accent)',
  },
  {
    value: 'updated',
    label: t('dashboard.filters.options.updated'),
    icon: ClockIcon,
    color: 'var(--gitpulse-info)',
  },
]);

const todoOrderOptions = computed<SegmentedOption[]>(() => [
  {
    value: 'desc',
    label: t('dashboard.filters.options.desc'),
    icon: ArrowDownIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'asc',
    label: t('dashboard.filters.options.asc'),
    icon: ArrowUpIcon,
    color: 'var(--gitpulse-text-muted)',
  },
]);

const selectedTodoSort = computed(() => (props.filters.sort === 'updated' ? 'updated' : 'added'));
const selectedTodoOrder = computed(() => props.filters.order ?? 'desc');

const handleTodoSortChange = (value: string) => {
  emit('update', { sort: value as DashboardRouteSort });
};

const handleTodoOrderChange = (value: string) => {
  emit('update', { order: value === 'asc' ? 'asc' : 'desc' });
};

const supportsFilter = (key: keyof DashboardRouteFilters) =>
  sourceSupportsDashboardFilter(props.currentTab, key);
const showPills = computed(
  () => supportsFilter('state') || supportsFilter('sort') || supportsFilter('order')
);
const showTodoControls = computed(() => supportsFilter('sort') || supportsFilter('order'));
</script>

<template>
  <div v-if="showPills" class="filter-pills">
    <template v-if="showTodoControls">
      <div class="filter-pills__segmented-control">
        <FilterSegmentedControl
          :options="todoSortOptions"
          :model-value="selectedTodoSort"
          :aria-label="t('dashboard.filters.sort')"
          @update:model-value="handleTodoSortChange"
        />
      </div>
      <div class="filter-pills__segmented-control">
        <FilterSegmentedControl
          :options="todoOrderOptions"
          :model-value="selectedTodoOrder"
          :aria-label="t('dashboard.filters.order')"
          @update:model-value="handleTodoOrderChange"
        />
      </div>
    </template>
    <div v-else-if="stateOptions.length > 0" class="filter-pills__segmented-control">
      <FilterSegmentedControl
        :options="stateOptions"
        :model-value="selectedState"
        :aria-label="t('dashboard.filters.state')"
        @update:model-value="handleStateChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.filter-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.filter-pills__segmented-control {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

@media (max-width: 860px) {
  .filter-pills {
    display: none;
  }
}
</style>
