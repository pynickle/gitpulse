<template>
  <div class="dashboard-layout">
    <div class="columns dashboard-layout-columns">
      <!-- Activity Bar: 48px fixed width (left) -->
      <div class="column column-activity-bar">
        <slot name="activity-bar"></slot>
      </div>

      <!-- Tab Sidebar: 220-250px width (left-center) -->
      <div class="column column-tab-sidebar">
        <slot name="tab-sidebar"></slot>
      </div>

      <!-- Main List: 700-800px max-width (center) -->
      <div class="column column-main-content">
        <slot name="main-content"></slot>
      </div>

      <!-- Widgets Panel: 250-300px width (right, collapsible) -->
      <div class="column column-widgets-panel">
        <slot name="widgets-panel"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 4-column layout container for the redesigned dashboard
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

// Layout variables defining the 4-column structure
$activity-bar-width: 48px;
$tab-sidebar-width: 240px;
$widgets-panel-width: 280px;

.dashboard-layout {
  width: 100%;
  min-height: 100%;
  display: flex;
}

.dashboard-layout-columns {
  width: 100%;
  margin: 0;
  justify-content: center; // Centered layout for large screens
}

// Left Activity Bar
.column-activity-bar {
  flex: none;
  width: $activity-bar-width;
  padding: 0.75rem 0; // Adjust padding to fit the narrow width
  display: flex;
  flex-direction: column;
  align-items: center;
}

// Left-Center Tab Sidebar
.column-tab-sidebar {
  flex: none;
  width: $tab-sidebar-width;
}

// Center Main List
.column-main-content {
  flex: 1 1 auto;
  min-width: 0;
}

// Right Widgets Panel
.column-widgets-panel {
  flex: none;
  width: $widgets-panel-width;
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
    flex-direction: row;
    padding: 0.75rem;
  }

  .column-tab-sidebar {
    order: 1;
  }

  .column-main-content {
    order: 2;
  }

  .column-widgets-panel {
    display: none;
  }
}
</style>
