<template>
  <aside class="menu tab-sidebar">
    <div class="sidebar-header">
      <p class="sidebar-header-title">{{ t('dashboard.sidebar.views') }}</p>
      <button
        class="button is-ghost is-small sidebar-manage-button"
        type="button"
        @click="$emit('manage-tabs')"
      >
        <span class="icon is-small mr-1">
          <SlidersHorizontalIcon :size="14" />
        </span>
        <span>{{ t('dashboard.sidebar.manageViews') }}</span>
      </button>
    </div>

    <template v-for="group in displayGroups" :key="group.id">
      <div
        class="menu-label-wrapper"
        :class="{ 'is-nested': group.depth > 0, 'is-system': group.source === 'system' }"
        :style="{ paddingLeft: `${0.75 + group.depth * 0.75}rem` }"
        @click="group.source !== 'system' && $emit('group-toggle', group.id)"
      >
        <p class="menu-label">
          <span>{{ group.name }}</span>
          <span v-if="getGroupTabCount(group.id) > 0" class="group-count">
            {{ getGroupTabCount(group.id) }}
          </span>
        </p>
        <span
          v-if="group.source !== 'system'"
          class="icon is-small collapse-icon"
          :class="{ 'is-collapsed': group.collapsed }"
        >
          <ChevronDownIcon :size="14" />
        </span>
      </div>
      <div
        class="group-list-wrap"
        :class="{ 'is-collapsed': group.collapsed, 'is-system': group.source === 'system' }"
      >
        <ul class="menu-list">
          <li v-for="tab in getTabsForGroup(group.id)" :key="tab.id">
            <a
              :class="{ 'is-active': activeTabId === tab.id }"
              @click="$emit('tab-select', tab.id)"
            >
              <div class="tab-item-content">
                <span class="icon is-small mr-2">
                  <component :is="tab.icon" :size="16" />
                </span>
                <span class="tab-name">{{ tab.name }}</span>
                <span
                  v-if="(tab.badgeCount ?? 0) > 0"
                  class="tag is-danger is-rounded is-small badge-count"
                >
                  {{ tab.badgeCount }}
                </span>
              </div>
            </a>
          </li>
        </ul>
        <p
          v-if="group.source !== 'system' && !group.collapsed && getGroupTabCount(group.id) === 0"
          class="empty-group-note"
        >
          {{ t('dashboard.sidebar.emptyGroup') }}
        </p>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ChevronDownIcon, SlidersHorizontalIcon } from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed } from 'vue';

import { DEFAULT_CUSTOM_TAB_GROUP_ID } from '~/composables/useTabGroups';

const { t } = useI18n();

interface TabSidebarGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: 'system' | 'github-search';
}

interface DisplayTabSidebarGroup extends TabSidebarGroup {
  depth: number;
}

interface TabSidebarItem {
  id: string;
  groupId: string;
  name: string;
  icon: Component;
  badgeCount?: number;
}

const props = withDefaults(
  defineProps<{
    groups?: TabSidebarGroup[];
    tabs?: TabSidebarItem[];
    activeTabId: string;
  }>(),
  {
    groups: () => [
      {
        id: DEFAULT_CUSTOM_TAB_GROUP_ID,
        name: 'General',
        collapsed: false,
        source: 'github-search',
      },
    ],
    tabs: () => [],
  }
);

const emit = defineEmits<{
  (e: 'tab-select', tabId: string): void;
  (e: 'group-toggle', groupId: string): void;
  (e: 'manage-tabs'): void;
}>();

const getTabsForGroup = (groupId: string) => props.tabs.filter((tab) => tab.groupId === groupId);
const getGroupTabCount = (groupId: string) => getTabsForGroup(groupId).length;

const displayGroups = computed<DisplayTabSidebarGroup[]>(() => {
  const rows: DisplayTabSidebarGroup[] = [];
  const visited = new Set<string>();

  const visit = (parentId: string | null, depth: number, ancestorCollapsed = false) => {
    for (const group of props.groups) {
      const currentParentId = group.parentId ?? null;
      if (currentParentId !== parentId || visited.has(group.id)) {
        continue;
      }

      visited.add(group.id);
      if (!ancestorCollapsed) {
        rows.push({ ...group, depth });
      }
      visit(group.id, depth + 1, ancestorCollapsed || Boolean(group.collapsed));
    }
  };

  visit(null, 0);

  for (const group of props.groups) {
    if (!visited.has(group.id)) {
      rows.push({ ...group, depth: 0 });
    }
  }

  return rows;
});
</script>

<style scoped lang="scss">
.tab-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
  padding: 0 0.75rem 0.55rem;
}

.sidebar-header-title {
  min-width: 0;
  flex: 1;
  margin: 0;
  color: var(--bulma-text-light, #6b7280);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sidebar-manage-button {
  flex: 0 0 auto;
  height: 1.85rem;
  padding-inline: 0.45rem;
  font-weight: 650;
}

.menu-label-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0 0.75rem;
  margin-bottom: 0.35em;
  border-radius: 4px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    background-color: var(--bulma-background-hover, rgba(0, 0, 0, 0.05));
    transform: translateX(0.125rem);
  }

  .menu-label {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0;
    margin-top: 0;
    user-select: none;
  }

  .group-count {
    display: inline-flex;
    min-width: 1.45rem;
    height: 1.15rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--bulma-background-hover, rgba(0, 0, 0, 0.08));
    color: var(--bulma-text, #334155);
    font-size: 0.72rem;
    font-weight: 700;
  }

  &.is-nested .menu-label::before {
    content: '->';
    margin-right: 0.35rem;
    color: var(--bulma-text-light, #888);
  }

  &.is-system {
    cursor: default;
    border-left: 3px solid var(--bulma-primary, #485fc7);
    color: var(--bulma-text-light, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.04em;

    &:hover {
      background-color: transparent;
      transform: none;
    }
  }
}

.collapse-icon {
  color: var(--bulma-text-light, #888);
  transition:
    transform 0.25s ease,
    color 0.2s ease;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.group-list-wrap {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 0.25s ease,
    opacity 0.2s ease,
    margin 0.25s ease;

  &.is-collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
    margin-bottom: -0.25rem;
    pointer-events: none;
  }

  .menu-list {
    min-height: 0;
    overflow: hidden;
  }

  &.is-system {
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--bulma-border-light, rgba(0, 0, 0, 0.05));
  }
}

.empty-group-note {
  padding: 0.45rem 0.75rem 0.65rem;
  margin: 0;
  color: var(--bulma-text-light, #94a3b8);
  font-size: 0.78rem;
}

.menu-list {
  margin-left: 0;

  li a {
    display: block;
    border-radius: 6px;
    padding: 0.38em 0.75em;
    margin-bottom: 0.15em;
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      transform: translateX(0.2rem);
    }

    &.is-active {
      transform: translateX(0.2rem);
      box-shadow: inset 0 0 0 1px var(--bulma-primary, #485fc7);
    }
  }
}

.tab-item-content {
  display: flex;
  align-items: center;
  width: 100%;

  .tab-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-count {
    margin-left: 0.5rem;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }
}

@media (prefers-color-scheme: dark) {
  .menu-label-wrapper .group-count {
    background: rgba(148, 163, 184, 0.18);
    color: #e2e8f0;
  }
}
</style>
