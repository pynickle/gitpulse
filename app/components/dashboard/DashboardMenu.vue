<script setup lang="ts">
import {
  BellIcon,
  BookMarkedIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  InboxIcon,
  ListTodoIcon,
  RocketIcon,
  UserIcon,
} from '@lucide/vue';
import type { Component } from 'vue';
import { nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue';

import TabSidebar from '~/components/dashboard/tab-sidebar/TabSidebar.vue';

interface BuiltInTab {
  id: string;
  name: string;
  icon?: string;
}

interface SidebarGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: 'system' | 'github-search';
}

interface SidebarTab {
  id: string;
  groupId: string;
  name: string;
  subtitle?: string;
  icon: Component;
  badgeCount?: number;
}

const props = defineProps<{
  open: boolean;
  builtInTabs: BuiltInTab[];
  activeTabId: string;
  sidebarGroups: SidebarGroup[];
  sidebarTabs: SidebarTab[];
}>();

const emit = defineEmits<{
  close: [];
  escape: [];
  'tab-select': [tabId: string];
  'group-toggle': [groupId: string];
  'manage-tabs': [];
}>();

const { t } = useI18n();
const panelElement = useTemplateRef<HTMLElement>('dashboardMenuPanel');
const focusTrap = createFocusTrapController();

const iconMap: Record<string, typeof UserIcon> = {
  'list-todo': ListTodoIcon,
  inbox: InboxIcon,
  bell: BellIcon,
  'circle-dot': CircleDotIcon,
  'git-pull-request': GitPullRequestIcon,
  'book-marked': BookMarkedIcon,
  rocket: RocketIcon,
};

const getTabIcon = (icon?: string) => iconMap[icon || 'inbox'] || InboxIcon;

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('escape');
    return;
  }

  if (event.key !== 'Tab' || !panelElement.value) return;

  const panel = panelElement.value;
  if (panel.contains(document.activeElement)) {
    focusTrap.trapTabKey(event, panel);
    return;
  }

  event.preventDefault();
  focusTrap.focusInitialElement(panel);
};

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return;

    if (!open) {
      document.removeEventListener('keydown', handleDocumentKeydown);
      await nextTick();
      focusTrap.restorePreviousFocus();
      return;
    }

    document.addEventListener('keydown', handleDocumentKeydown);
    focusTrap.capturePreviousFocus();
    await nextTick();
    if (panelElement.value) {
      focusTrap.focusInitialElement(panelElement.value);
    }
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown);
});
</script>

<template>
  <div v-if="open" class="dashboard-menu">
    <button
      class="dashboard-menu__scrim"
      type="button"
      :aria-label="t('dashboard.menu.close')"
      tabindex="-1"
      @click="emit('close')"
    ></button>
    <div
      id="dashboard-menu"
      ref="dashboardMenuPanel"
      class="dashboard-menu__panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('dashboard.menu.title')"
      tabindex="-1"
    >
      <nav class="dashboard-menu__built-in" :aria-label="t('dashboard.menu.builtInTabs')">
        <button
          v-for="tab in builtInTabs"
          :key="tab.id"
          class="dashboard-menu__tab"
          :class="{ 'is-current': activeTabId === tab.id }"
          type="button"
          :aria-current="activeTabId === tab.id ? 'page' : undefined"
          @click="emit('tab-select', tab.id)"
        >
          <component :is="getTabIcon(tab.icon)" :size="18" aria-hidden="true" />
          <span class="dashboard-menu__tab-name">{{ tab.name }}</span>
        </button>
      </nav>
      <TabSidebar
        :groups="sidebarGroups"
        :tabs="sidebarTabs"
        :active-tab-id="activeTabId"
        @tab-select="emit('tab-select', $event)"
        @group-toggle="emit('group-toggle', $event)"
        @manage-tabs="emit('manage-tabs')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-menu {
  position: fixed;
  inset: 0;
  z-index: 23;
  pointer-events: none;
}

.dashboard-menu__scrim {
  position: absolute;
  inset: 0;
  z-index: 23;
  border: 0;
  padding: 0;
  background: color-mix(in srgb, #0f172a 42%, transparent);
  cursor: pointer;
  pointer-events: auto;
}

.dashboard-menu__panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 24;
  display: flex;
  flex-direction: column;
  width: min(80vw, 20rem);
  max-width: 20rem;
  background: var(--gitpulse-shell-bg, var(--gitpulse-surface));
  box-shadow: 0.5rem 0 1.5rem color-mix(in srgb, #0f172a 16%, transparent);
  overflow: hidden;
  outline: none;
  pointer-events: auto;

  @media (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) {
    padding-top: env(safe-area-inset-top);
  }
}

.dashboard-menu__built-in {
  display: flex;
  flex-direction: column;
  flex: none;
  gap: 0.15rem;
  padding: 0.75rem 0.65rem 0.5rem;
}

.dashboard-menu__tab {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.7rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--gitpulse-text);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--bulma-background-hover, var(--gitpulse-surface-hover));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }

  &.is-current {
    background: var(--gitpulse-surface-active);
    color: var(--gitpulse-accent);
    font-weight: 600;
  }
}

.dashboard-menu__tab-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-menu__panel :deep(.tab-sidebar) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  border-top: 1px solid var(--gitpulse-border);
}
</style>
