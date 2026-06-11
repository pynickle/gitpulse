<template>
  <div class="dashboard-layout">
    <div class="columns dashboard-layout-columns">
      <!-- Activity Bar: 48px fixed width (left) -->
      <div class="column column-activity-bar">
        <slot name="activity-bar"></slot>
      </div>

      <!-- Tab Sidebar: 220-250px width (left-center) -->
      <div class="column column-tab-sidebar" :style="layoutStyle">
        <slot name="tab-sidebar"></slot>
      </div>

      <!-- Main List: 700-800px max-width (center) -->
      <div class="column column-main-content">
        <slot name="main-content"></slot>
      </div>

      <!-- Widgets Panel: 250-300px width (right, collapsible) -->
      <div v-if="isWidgetsPanelVisible" class="column column-widgets-panel" :style="layoutStyle">
        <slot name="widgets-panel"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const { isWidgetsPanelVisible, tabSidebarWidth, widgetsPanelWidth } = useDashboardLayout();

const layoutStyle = computed(() => ({
  '--dashboard-tab-sidebar-width': `${tabSidebarWidth.value}px`,
  '--dashboard-widgets-panel-width': `${widgetsPanelWidth.value}px`,
}));
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

// Layout variables defining the 4-column structure
$activity-bar-width: 48px;
$tab-sidebar-width: 220px;
$widgets-panel-width: 320px;

.dashboard-layout {
  display: flex;
  width: 100%;
  min-height: inherit;
}

.dashboard-layout-columns {
  display: flex;
  width: 100%;
  min-height: inherit;
  margin: 0;
  align-items: stretch;
  justify-content: flex-start;
}

// Left Activity Bar
.column-activity-bar {
  display: flex;
  flex: none;
  align-items: stretch;
  width: $activity-bar-width;
  padding: 0;
  background: var(--gitpulse-shell-bg);
}

// Left-Center Tab Sidebar
.column-tab-sidebar {
  flex: none;
  width: var(--dashboard-tab-sidebar-width, #{$tab-sidebar-width});
  padding: 1.25rem 0.95rem;
  background: var(--gitpulse-shell-bg);
  border-right: 1px solid var(--gitpulse-border);
}

// Center Main List
.column-main-content {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  min-width: 0;
  padding: 1.25rem 1.25rem;
}

// Right Widgets Panel
.column-widgets-panel {
  flex: none;
  width: var(--dashboard-widgets-panel-width, #{$widgets-panel-width});
  padding: 1.25rem 0.75rem 1.25rem 0;
}

// Responsive behavior
@media screen and (max-width: 768px) {
  .dashboard-layout {
    display: block;
  }

  .dashboard-layout-columns {
    display: flex;
    flex-direction: column;
  }

  .column-activity-bar,
  .column-tab-sidebar,
  .column-main-content {
    width: 100%;
    max-width: 100%;
    flex: none;
  }

  .column-activity-bar {
    padding: 0;
  }

  .column-tab-sidebar {
    order: 1;
    padding: 0.75rem;
  }

  .column-main-content {
    order: 2;
    padding: 0.75rem;
  }

  .column-widgets-panel {
    display: none;
  }
}
</style>
