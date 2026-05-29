<template>
  <aside class="tab-sidebar" aria-label="Tab groups">
    <!-- Compact header: title + manage button only -->
    <div class="tab-sidebar__header">
      <h2 class="tab-sidebar__title">{{ t('dashboard.sidebar.views') }}</h2>
      <button class="tab-sidebar__manage-btn" type="button" @click="$emit('manage-tabs')">
        <SlidersHorizontalIcon :size="13" />
        <span>{{ t('dashboard.sidebar.manageViews') }}</span>
      </button>
    </div>

    <!-- Group tree -->
    <div class="tab-sidebar__tree" role="tree" :aria-label="t('dashboard.sidebar.views')">
      <template v-for="group in displayGroups" :key="group.id">
        <!-- Group heading -->
        <button
          class="tab-sidebar__group"
          :class="{
            'tab-sidebar__group--nested': group.depth > 0,
            'tab-sidebar__group--collapsed': group.collapsed,
          }"
          :style="getDepthStyle(group.depth)"
          type="button"
          role="treeitem"
          :aria-expanded="group.source === 'system' ? undefined : !group.collapsed"
          @click="group.source !== 'system' && emit('group-toggle', group.id)"
        >
          <span class="tab-sidebar__group-toggle" aria-hidden="true">
            <PlusIcon v-if="group.collapsed" :size="13" />
            <MinusIcon v-else :size="13" />
          </span>
          <span class="tab-sidebar__group-label">{{ group.name }}</span>
          <span v-if="getGroupTabCount(group.id) > 0" class="tab-sidebar__group-count">
            {{ getGroupTabCount(group.id) }}
          </span>
        </button>

        <!-- Group children (tabs) -->
        <div
          v-if="!group.collapsed"
          class="tab-sidebar__children"
          :style="getDepthStyle(group.depth)"
        >
          <ul class="tab-sidebar__tab-list" role="group">
            <li v-for="tab in getTabsForGroup(group.id)" :key="tab.id">
              <a
                class="tab-sidebar__tab"
                :class="{ 'tab-sidebar__tab--active': activeTabId === tab.id }"
                role="treeitem"
                :aria-current="activeTabId === tab.id ? 'page' : undefined"
                href="#"
                @click.prevent="emit('tab-select', tab.id)"
              >
                <span class="icon is-small tab-sidebar__tab-icon">
                  <component :is="tab.icon" :size="15" />
                </span>
                <span class="tab-sidebar__tab-name">{{ tab.name }}</span>
                <span v-if="(tab.badgeCount ?? 0) > 0" class="tab-sidebar__tab-badge">
                  {{ tab.badgeCount }}
                </span>
              </a>
            </li>
          </ul>

          <!-- Empty group state -->
          <span
            v-if="group.source !== 'system' && !group.collapsed && getGroupTabCount(group.id) === 0"
            class="tab-sidebar__empty-inline"
          >
            {{ t('dashboard.sidebar.emptyGroup') }}
          </span>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { PlusIcon, MinusIcon, SlidersHorizontalIcon } from 'lucide-vue-next';
import type { Component, CSSProperties } from 'vue';
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
        source: 'github-search' as const,
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

// Capped depth offset: max 2rem so deep nesting doesn't waste horizontal space
const getDepthStyle = (depth: number): CSSProperties => ({
  '--depth-offset': `${Math.min(depth * 0.75, 2)}rem`,
});

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

      // Skip system groups (Built-in Views) — they're shown in the ActivityBar
      if (group.source === 'system') {
        continue;
      }

      if (!ancestorCollapsed) {
        rows.push({ ...group, depth });
      }
      visit(group.id, depth + 1, ancestorCollapsed || Boolean(group.collapsed));
    }
  };

  visit(null, 0);

  for (const group of props.groups) {
    if (!visited.has(group.id)) {
      // Skip any system groups that might not have been visited
      if (group.source === 'system') {
        continue;
      }
      rows.push({ ...group, depth: 0 });
    }
  }

  return rows;
});
</script>

<style scoped lang="scss">
.tab-sidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0.5rem 0;
}

.tab-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0 0.75rem 0.5rem;
}

.tab-sidebar__title {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bulma-text-weak, #6b7280);
  line-height: 1;
}

.tab-sidebar__manage-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  height: 1.5rem;
  padding: 0 0.45rem;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--bulma-text-weak, #9ca3af);
  font-size: 0.68rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--bulma-background-hover, rgba(0, 0, 0, 0.045));
    color: var(--bulma-text, #374151);
  }

  &:focus-visible {
    outline: 2px solid var(--bulma-primary, #4f46e5);
    outline-offset: 2px;
  }

  &:active {
    background: var(--bulma-background-hover, rgba(0, 0, 0, 0.08));
  }
}

.tab-sidebar__tree {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding-inline: 0.35rem;
  overflow: hidden auto;
}

.tab-sidebar__group {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  padding: 0.4rem 0.5rem 0.4rem calc(0.6rem + var(--depth-offset, 0rem));
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bulma-text-strong, #1e293b);
  font: inherit;
  font-size: 0.81rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--bulma-background-hover, rgba(0, 0, 0, 0.045));
  }

  &:focus-visible {
    outline: 2px solid var(--bulma-primary, #4f46e5);
    outline-offset: 1px;
    border-radius: 6px;
  }

  &:active {
    background: var(--bulma-background-hover, rgba(0, 0, 0, 0.08));
  }

  &--nested {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--bulma-text, #475569);
    padding-left: calc(0.6rem + var(--depth-offset, 0rem));
  }

  &--collapsed {
    color: var(--bulma-text-weak, #6b7280);
  }
}

.tab-sidebar__group-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--bulma-text-weak, #9ca3af);
  transition: color 0.15s ease;

  .tab-sidebar__group:hover & {
    color: var(--bulma-text, #374151);
  }
}

.tab-sidebar__group-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-sidebar__group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.05rem;
  flex-shrink: 0;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 0.63rem;
  font-weight: 800;
  margin-left: auto;

  @media (prefers-color-scheme: dark) {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }
}

.tab-sidebar__children {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  margin-top: 0.22rem;
  padding-left: calc(1.6rem + var(--depth-offset, 0rem));
  transition:
    grid-template-rows 0.2s ease,
    opacity 0.15s ease,
    margin 0.2s ease;

  &--collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
    margin-bottom: -0.2rem;
    pointer-events: none;
  }
}

.tab-sidebar__tab-list {
  min-height: 0;
  margin: 0 0 0.3rem;
  overflow: hidden;
  list-style: none;
  padding: 0;
}

.tab-sidebar__tab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.55rem 0.38rem 0.45rem;
  border-radius: 6px;
  color: var(--bulma-text, #475569);
  font-size: 0.79rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--bulma-text-strong, #1e293b);
  }

  &:focus-visible {
    outline: 2px solid var(--bulma-primary, #4f46e5);
    outline-offset: 1px;
    border-radius: 6px;
  }

  &:active {
    background: rgba(0, 0, 0, 0.07);
  }

  &--active {
    background: #eef2ff;
    color: #4f46e5;
    font-weight: 650;

    .tab-sidebar__tab-icon {
      color: #4f46e5;
    }

    &:hover {
      background: #e0e7ff;
    }

    @media (prefers-color-scheme: dark) {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;

      .tab-sidebar__tab-icon {
        color: #a5b4fc;
      }

      &:hover {
        background: rgba(99, 102, 241, 0.2);
      }
    }
  }
}

.tab-sidebar__tab-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: var(--bulma-text-weak, #9ca3af);
}

.tab-sidebar__tab-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-sidebar__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.1rem;
  flex-shrink: 0;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

  .tab-sidebar__tab--active & {
    box-shadow: 0 1px 3px rgba(239, 68, 68, 0.25);
  }

  @media (prefers-color-scheme: dark) {
    background: #f87171;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);

    .tab-sidebar__tab--active & {
      box-shadow: 0 1px 3px rgba(248, 113, 113, 0.3);
    }
  }
}

.tab-sidebar__empty-inline {
  display: block;
  margin: 0 0 0.3rem;
  color: #9ca3af;
  font-size: 0.65rem;
  font-style: italic;
  line-height: 1.8;

  @media (prefers-color-scheme: dark) {
    color: #6b7280;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab-sidebar__children,
  .tab-sidebar__group,
  .tab-sidebar__tab,
  .tab-sidebar__manage-btn,
  .tab-sidebar__group-toggle {
    transition: none;
  }

  .tab-sidebar__tab:active,
  .tab-sidebar__group:active {
    background: rgba(0, 0, 0, 0.04);
  }
}
</style>
