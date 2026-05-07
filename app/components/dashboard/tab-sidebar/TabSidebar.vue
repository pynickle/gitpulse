<template>
  <aside class="menu tab-sidebar">
    <template v-for="group in groups" :key="group.id">
      <div class="menu-label-wrapper" @click="$emit('group-toggle', group.id)">
        <p class="menu-label">{{ group.name }}</p>
        <span class="icon is-small collapse-icon" :class="{ 'is-collapsed': group.collapsed }">
          <ChevronDownIcon :size="14" />
        </span>
      </div>
      <div class="group-list-wrap" :class="{ 'is-collapsed': group.collapsed }">
        <VueDraggable
          v-model="groupedTabs[group.id]"
          tag="ul"
          class="menu-list"
          item-key="id"
          :group="tabDragGroup"
          :animation="150"
          @add="handleTabAdd(group.id, $event)"
        >
          <template #item="{ element: tab }">
            <li :key="tab.id">
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
                    v-if="tab.badgeCount > 0"
                    class="tag is-danger is-rounded is-small badge-count"
                  >
                    {{ tab.badgeCount }}
                  </span>
                </div>
              </a>
            </li>
          </template>
        </VueDraggable>
      </div>
    </template>

    <div class="new-group-action mt-4">
      <button class="button is-ghost is-small is-fullwidth" @click="$emit('new-group')">
        <span class="icon is-small mr-1">
          <PlusIcon :size="14" />
        </span>
        <span>New Group</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  ChevronDownIcon,
  PlusIcon,
  BellIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  BookMarkedIcon,
} from 'lucide-vue-next';
import { computed, reactive, watch } from 'vue';
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus';

export interface TabGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface TabItem {
  id: string;
  groupId: string;
  name: string;
  icon: any;
  badgeCount?: number;
}

const props = withDefaults(
  defineProps<{
    groups?: TabGroup[];
    tabs?: TabItem[];
    activeTabId: string;
  }>(),
  {
    groups: () => [{ id: 'default', name: 'General', collapsed: false }],
    tabs: () => [
      { id: 'notifications', groupId: 'default', name: 'Notifications', icon: BellIcon },
      { id: 'issues', groupId: 'default', name: 'Issues', icon: CircleDotIcon },
      { id: 'pulls', groupId: 'default', name: 'Pull Requests', icon: GitPullRequestIcon },
      { id: 'repos', groupId: 'default', name: 'Repositories', icon: BookMarkedIcon },
    ],
  }
);

defineEmits<{
  (e: 'tab-select', tabId: string): void;
  (e: 'group-toggle', groupId: string): void;
  (e: 'new-group'): void;
}>();

const tabDragGroup = {
  name: 'tab-groups',
  pull: true,
  put: true,
};

const groupedTabs = reactive<Record<string, TabItem[]>>({});

const syncGroupedTabs = () => {
  const nextGroupedTabs = props.groups.reduce<Record<string, TabItem[]>>((acc, group) => {
    acc[group.id] = props.tabs.filter((tab) => tab.groupId === group.id);
    return acc;
  }, {});

  for (const group of props.groups) {
    groupedTabs[group.id] = nextGroupedTabs[group.id] ?? [];
  }

  for (const groupId of Object.keys(groupedTabs)) {
    if (!props.groups.some((group) => group.id === groupId)) {
      delete groupedTabs[groupId];
    }
  }
};

const groupsSignature = computed(() => props.groups.map((group) => group.id).join('|'));
const tabsSignature = computed(() => props.tabs.map((tab) => tab.id).join('|'));

watch(() => [groupsSignature.value, tabsSignature.value], syncGroupedTabs, {
  immediate: true,
  deep: true,
});

const handleTabAdd = (groupId: string, event: DraggableEvent<TabItem>) => {
  if (event.data) {
    event.data.groupId = groupId;
  }
};
</script>

<style scoped lang="scss">
.tab-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.menu-label-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0 0.75rem;
  margin-bottom: 0.5em;
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
    margin-bottom: 0;
    margin-top: 0;
    user-select: none;
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
}

.menu-list {
  margin-left: 0;

  li a {
    display: block;
    border-radius: 6px;
    padding: 0.5em 0.75em;
    margin-bottom: 0.25em;
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

.new-group-action {
  padding: 0 0.75rem;
  margin-top: auto;

  .button {
    justify-content: flex-start;
  }
}
</style>
