<script setup lang="ts">
import {
  BellIcon,
  CheckCircleIcon,
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  LayoutGridIcon,
} from 'lucide-vue-next';
import { computed } from 'vue';

import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import type {
  DashboardFilterSource,
  DashboardRouteFilters,
  DashboardRouteState,
} from '~/composables/useDashboardFilters';

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

const selectedState = computed(() => props.filters.state ?? '');

const handleStateChange = (value: string) => {
  emit('update', { state: (value || undefined) as DashboardRouteState | undefined });
};

const showPills = computed(() => props.currentTab !== 'repos');
</script>

<template>
  <div v-if="showPills" class="filter-pills">
    <div v-if="stateOptions.length > 0" class="filter-pills__segmented-control">
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
