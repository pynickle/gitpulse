<template>
  <div class="dashboard-layout">
    <div class="columns dashboard-layout-columns">
      <!-- Activity Bar: 48px fixed width (left) -->
      <div class="column column-activity-bar">
        <slot name="activity-bar"></slot>
      </div>

      <!-- Tab Sidebar: persisted width (left-center) -->
      <div class="column column-tab-sidebar" :style="tabSidebarStyle">
        <slot name="tab-sidebar"></slot>
      </div>

      <!-- Draggable divider between the tab sidebar and the main list. -->
      <div
        ref="splitterHandleRef"
        class="dashboard-splitter"
        :class="{ 'is-dragging': isDragging }"
        role="separator"
        :aria-orientation="'vertical'"
        :aria-label="t('dashboard.sidebar.resizeHandle')"
        :aria-valuenow="displayWidth"
        :aria-valuemin="TAB_SIDEBAR_WIDTH_MIN"
        :aria-valuemax="TAB_SIDEBAR_WIDTH_MAX"
        tabindex="0"
        @pointerdown="onPointerDown"
      >
        <button
          type="button"
          class="dashboard-splitter__reset"
          :aria-label="t('dashboard.sidebar.resetWidth')"
          :title="t('dashboard.sidebar.resetWidth')"
          @pointerdown.stop
          @click.stop="handleReset"
        >
          <component :is="RotateCcwIcon" :size="13" aria-hidden="true" />
        </button>
      </div>

      <!-- Main List: 700-800px max-width (center) -->
      <div class="column column-main-content">
        <slot name="main-content"></slot>
      </div>

      <!-- Widgets Panel: 320px width (right) -->
      <div class="column column-widgets-panel">
        <slot name="widgets-panel"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RotateCcw as RotateCcwIcon } from '@lucide/vue';
import { computed, shallowRef, useTemplateRef, watch } from 'vue';

import {
  TAB_SIDEBAR_WIDTH_DEFAULT,
  TAB_SIDEBAR_WIDTH_MAX,
  TAB_SIDEBAR_WIDTH_MIN,
} from '#shared/types/user-settings';

const { t } = useI18n();
const { settings, updateLayout } = useUserSettings();

// Persisted width from user settings. Falls back to the default constant if the
// stored value is somehow missing or out of range.
const settingsWidth = computed(() => settings.value.layout.tabSidebarWidth);

// Local drag buffer: equals the persisted width at rest, mutated per-frame while
// the user drags. Keeping this separate from settings avoids spamming the save
// queue — we commit once on pointer release via `onCommit`.
const dragWidth = shallowRef(settingsWidth.value);

const displayWidth = computed(() => (isDragging.value ? dragWidth.value : settingsWidth.value));

// Drive the column width through a CSS custom property rather than an inline
// `width` so the mobile media query (which sets `width: 100%`) can still win.
const tabSidebarStyle = computed(() => ({
  '--tab-sidebar-width': `${displayWidth.value}px`,
}));

const {
  onPointerDown,
  handleRef: bindSplitterHandle,
  isDragging,
} = usePointerSplitter({
  width: dragWidth,
  min: TAB_SIDEBAR_WIDTH_MIN,
  max: TAB_SIDEBAR_WIDTH_MAX,
  onCommit: (width) => {
    if (width !== settingsWidth.value) {
      void updateLayout({ tabSidebarWidth: width });
    }
  },
});

const splitterHandleRef = useTemplateRef<HTMLElement>('splitterHandleRef');

watch(splitterHandleRef, (el) => {
  bindSplitterHandle(el);
});

// Keep dragWidth tracking the persisted value while not actively dragging so
// remote changes (login switch, reset, server correction) show up immediately.
watch(
  settingsWidth,
  (next) => {
    if (!isDragging.value) {
      dragWidth.value = next;
    }
  },
  { immediate: true }
);

const handleReset = () => {
  void updateLayout({ tabSidebarWidth: TAB_SIDEBAR_WIDTH_DEFAULT });
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

// Layout variables defining the 4-column structure
$activity-bar-width: 48px;
$widgets-panel-width: 320px;

// Splitter visual width (the visible line). The interactive hover zone is wider
// via a transparent ::before pseudo-element so the reset button appears before
// the cursor touches the thin line itself.
$splitter-width: 1px;
$splitter-hover-zone: 14px;

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

// Left-Center Tab Sidebar. Width is driven by the inline `--tab-sidebar-width`
// custom property (set from user settings); the media query below overrides
// this with `width: 100%` for mobile stacking.
.column-tab-sidebar {
  flex: none;
  width: var(--tab-sidebar-width, 220px);
  min-width: $splitter-width;
  padding: 1.25rem 0.95rem;
  background: var(--gitpulse-shell-bg);
  // The visible divider now lives on the splitter element, not the column.
}

// Draggable divider between the tab sidebar and the main content.
.dashboard-splitter {
  position: relative;
  flex: none;
  width: $splitter-width;
  min-width: $splitter-width;
  background: var(--gitpulse-border);
  cursor: col-resize;
  user-select: none;
  touch-action: none;
  outline: none;

  // Widen the interactive/hover zone symmetrically around the visible line so
  // the reset button reveals before the cursor lands on the 1px line itself.
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: (($splitter-hover-zone - $splitter-width) * -0.5);
    width: $splitter-hover-zone;
    height: 100%;
  }

  &:hover,
  &:focus-visible,
  &.is-dragging {
    background: var(--gitpulse-border-strong, var(--gitpulse-border));
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--gitpulse-focus-ring, rgba(0, 122, 255, 0.45));
  }

  &.is-dragging {
    cursor: ew-resize;
  }
}

// Reset-to-default button — faded in at the vertical midpoint of the divider
// when the user hovers the splitter zone. Hidden during drag so a stray click
// can't fire while resizing.
.dashboard-splitter__reset {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  margin: 0;
  background: var(--gitpulse-surface, var(--gitpulse-shell-bg));
  color: var(--gitpulse-text-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  cursor: pointer;
  // Center on the line, then sit above the splitter so the wider hit-area
  // pseudo-element doesn't swallow the click.
  transform: translate(-50%, -50%);
  z-index: 2;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.14s ease,
    color 0.14s ease,
    background 0.14s ease,
    border-color 0.14s ease;

  .dashboard-splitter:hover &,
  .dashboard-splitter:focus-visible & {
    opacity: 1;
    pointer-events: auto;
  }

  &:hover {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    background: var(--gitpulse-surface-hover, var(--gitpulse-shell-bg));
    border-color: var(--gitpulse-border-strong, var(--gitpulse-border));
  }

  // Hide while actively dragging — resizing is a separate intent from resetting.
  .dashboard-splitter.is-dragging & {
    opacity: 0;
    pointer-events: none;
  }
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
  width: $widgets-panel-width;
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

  // No resizing on mobile — the sidebar is full-width above the list.
  .dashboard-splitter {
    display: none;
  }
}
</style>
