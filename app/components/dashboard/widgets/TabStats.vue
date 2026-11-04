<template>
  <div class="tab-stats">
    <nav class="level is-mobile">
      <div v-for="(stat, index) in displayStats" :key="index" class="level-item has-text-centered">
        <div>
          <p class="heading" :class="stat.colorClass">{{ stat.label }}</p>
          <p class="title is-4">{{ stat.value }}</p>
        </div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const { t } = useI18n();

const { currentTab, stats } = defineProps<{
  currentTab: string;
  stats: Record<string, number>;
}>();

const displayStats = computed(() => {
  if (currentTab === 'notifications') {
    return [
      {
        label: t('dashboard.widgets.stats.unread'),
        value: stats.unread || 0,
        colorClass: 'has-text-warning',
      },
      {
        label: t('dashboard.widgets.stats.read'),
        value: stats.read || 0,
        colorClass: 'has-text-success',
      },
      {
        label: t('dashboard.widgets.stats.total'),
        value: stats.total || Object.values(stats).reduce((a, b) => a + b, 0),
        colorClass: 'has-text-info',
      },
    ];
  } else if (currentTab === 'pulls') {
    return [
      {
        label: t('dashboard.widgets.stats.open'),
        value: stats.open || 0,
        colorClass: 'has-text-success',
      },
      {
        label: t('dashboard.widgets.stats.merged'),
        value: stats.merged || 0,
        colorClass: 'has-text-purple',
      },
      {
        label: t('dashboard.widgets.stats.closed'),
        value: stats.closed || 0,
        colorClass: 'has-text-danger',
      },
    ];
  } else {
    return [
      {
        label: t('dashboard.widgets.stats.open'),
        value: stats.open || 0,
        colorClass: 'has-text-success',
      },
      {
        label: t('dashboard.widgets.stats.closed'),
        value: stats.closed || 0,
        colorClass: 'has-text-danger',
      },
      {
        label: t('dashboard.widgets.stats.total'),
        value: stats.total || (stats.open || 0) + (stats.closed || 0),
        colorClass: 'has-text-info',
      },
    ];
  }
});
</script>

<style scoped lang="scss">
.tab-stats {
  padding: 1rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--bulma-border);

  .heading {
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
    font-weight: 600;

    &.has-text-warning {
      color: var(--gitpulse-warning);
    }

    &.has-text-success {
      color: var(--gitpulse-success);
    }

    &.has-text-info {
      color: var(--gitpulse-info);
    }

    &.has-text-danger {
      color: var(--gitpulse-danger);
    }

    &.has-text-purple {
      color: var(--gitpulse-purple);
    }
  }

  .title {
    font-weight: 600;
    color: var(--bulma-text-strong);
  }
}
</style>
