<template>
  <div class="tab-stats">
    <nav class="tab-stats__list">
      <div v-for="(stat, index) in displayStats" :key="index" class="tab-stats__item">
        <div>
          <p class="heading" :class="stat.colorClass">{{ stat.label }}</p>
          <p class="tab-stats__value">{{ stat.value }}</p>
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
        colorClass: 'tab-stats__heading--warning',
      },
      {
        label: t('dashboard.widgets.stats.read'),
        value: stats.read || 0,
        colorClass: 'tab-stats__heading--success',
      },
      {
        label: t('dashboard.widgets.stats.total'),
        value: stats.total || Object.values(stats).reduce((a, b) => a + b, 0),
        colorClass: 'tab-stats__heading--info',
      },
    ];
  } else if (currentTab === 'pulls') {
    return [
      {
        label: t('dashboard.widgets.stats.open'),
        value: stats.open || 0,
        colorClass: 'tab-stats__heading--success',
      },
      {
        label: t('dashboard.widgets.stats.merged'),
        value: stats.merged || 0,
        colorClass: 'tab-stats__heading--purple',
      },
      {
        label: t('dashboard.widgets.stats.closed'),
        value: stats.closed || 0,
        colorClass: 'tab-stats__heading--danger',
      },
    ];
  } else {
    return [
      {
        label: t('dashboard.widgets.stats.open'),
        value: stats.open || 0,
        colorClass: 'tab-stats__heading--success',
      },
      {
        label: t('dashboard.widgets.stats.closed'),
        value: stats.closed || 0,
        colorClass: 'tab-stats__heading--danger',
      },
      {
        label: t('dashboard.widgets.stats.total'),
        value: stats.total || (stats.open || 0) + (stats.closed || 0),
        colorClass: 'tab-stats__heading--info',
      },
    ];
  }
});
</script>

<style scoped lang="scss">
.tab-stats {
  padding: 1rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--gitpulse-border);

  .tab-stats__list {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .tab-stats__item {
    display: flex;
    flex: 1 0 auto;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .heading {
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
    font-weight: 600;

    &.tab-stats__heading--warning {
      color: var(--gitpulse-warning);
    }

    &.tab-stats__heading--success {
      color: var(--gitpulse-success);
    }

    &.tab-stats__heading--info {
      color: var(--gitpulse-info);
    }

    &.tab-stats__heading--danger {
      color: var(--gitpulse-danger);
    }

    &.tab-stats__heading--purple {
      color: var(--gitpulse-purple);
    }
  }

  .tab-stats__value {
    margin-bottom: 0;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.125;
    color: var(--gitpulse-text-strong);
  }
}
</style>
