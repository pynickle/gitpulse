<script setup lang="ts">
import {
  BellIcon,
  BookMarkedIcon,
  ChevronDownIcon,
  CircleDotIcon,
  FolderIcon,
  FolderPlusIcon,
  GitPullRequestIcon,
  GripVerticalIcon,
  ListPlusIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from '@lucide/vue';
import { nextTick, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import type { SettingsTab, TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const {
  t,
  maxGroupDepth,
  newGroup,
  childGroupName,
  activeChildCreatorGroupId,
  editingSubtitleTabId,
  editingSubtitleDraft,
  confirmingTabId,
  confirmingGroupId,
  selectedTabId,
  builtinTabs,
  customGroupRows,
  groupTabLists,
  draggableGroupRows,
  getInputValue,
  getGroupTabCount,
  getGroupDepthStyle,
  getNestedPanelStyle,
  canEditGroup,
  updateGroup,
  toggleGroupCollapsed,
  getTabSubtitle,
  getQueryPreview,
  startSubtitleEdit,
  cancelSubtitleEdit,
  saveSubtitleEdit,
  requestDeleteTab,
  confirmDeleteTab,
  requestDeleteGroup,
  cancelDeleteConfirmation,
  confirmDeleteGroup,
  handleGroupReorder,
  handleTabsChanged,
  handleCreateGroup,
  handleStartChildGroup,
  handleCancelChildGroup,
  handleCreateChildGroup,
  startNewTabInGroup,
} = props.model;

const subtitleInputRef = shallowRef<HTMLInputElement | null>(null);
let suppressNextRowSelection = false;
let suppressNextRowSelectionTimer: ReturnType<typeof setTimeout> | null = null;
const rowSelectionSuppressMs = 150;

const setSubtitleInputRef = (element: Element | ComponentPublicInstance | null) => {
  subtitleInputRef.value = element instanceof HTMLInputElement ? element : null;
};

const focusSubtitleInput = () => {
  void nextTick(() => {
    const input = subtitleInputRef.value;
    if (!input) {
      return;
    }

    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
};

watch(editingSubtitleTabId, (tabId) => {
  if (tabId) {
    focusSubtitleInput();
  }
});

const suppressNextTabRowSelection = () => {
  suppressNextRowSelection = true;
  if (suppressNextRowSelectionTimer) {
    clearTimeout(suppressNextRowSelectionTimer);
  }
  suppressNextRowSelectionTimer = setTimeout(() => {
    suppressNextRowSelection = false;
    suppressNextRowSelectionTimer = null;
  }, rowSelectionSuppressMs);
};

const selectTabFromRow = (tab: SettingsTab) => {
  if (suppressNextRowSelection) {
    suppressNextRowSelection = false;
    if (suppressNextRowSelectionTimer) {
      clearTimeout(suppressNextRowSelectionTimer);
      suppressNextRowSelectionTimer = null;
    }
    return;
  }

  props.model.selectTabForEdit(tab);
};

const saveSubtitleFromInput = (tab: SettingsTab, suppressRowSelection = false) => {
  if (editingSubtitleTabId.value !== tab.id) {
    return;
  }

  if (suppressRowSelection) {
    suppressNextTabRowSelection();
  }
  saveSubtitleEdit(tab);
};

onBeforeUnmount(() => {
  if (suppressNextRowSelectionTimer) {
    clearTimeout(suppressNextRowSelectionTimer);
  }
});
</script>
<template>
  <div class="library">
    <section class="builtin-strip" :aria-label="t('dashboard.tabsSettings.builtinSectionTitle')">
      <span class="builtin-strip__label">
        <LockIcon :size="12" aria-hidden="true" />
        <span>{{ t('dashboard.tabsSettings.builtinSectionTitle') }}</span>
      </span>
      <span
        v-for="tab in builtinTabs"
        :key="tab.id"
        class="builtin-pill"
        :title="t('dashboard.tabsSettings.builtinLocked')"
      >
        <BellIcon v-if="tab.id === 'notifications'" :size="13" />
        <CircleDotIcon v-else-if="tab.id === 'issues'" :size="13" />
        <GitPullRequestIcon v-else-if="tab.id === 'pulls'" :size="13" />
        <BookMarkedIcon v-else :size="13" />
        <span>{{ tab.name }}</span>
      </span>
    </section>

    <div v-if="customGroupRows.length === 0" class="library-empty">
      <span class="library-empty__icon" aria-hidden="true"><SparklesIcon :size="26" /></span>
      <p class="library-empty__title">{{ t('dashboard.tabsSettings.customSectionEmpty') }}</p>
      <p class="library-empty__hint">{{ t('dashboard.tabsSettings.customSectionEmptyHint') }}</p>
    </div>

    <div v-else class="tree-list">
      <VueDraggable
        v-model="draggableGroupRows"
        :animation="200"
        handle=".drag-handle"
        item-key="id"
        class="tree-drag-root"
        @end="handleGroupReorder"
      >
        <article v-for="group in draggableGroupRows" :key="group.id" class="tree-group">
          <div class="tree-group-row">
            <span class="tree-depth-spacer" :style="getGroupDepthStyle(group.depth)" />
            <button
              class="button is-ghost is-small drag-handle"
              type="button"
              :aria-label="t('dashboard.tabsSettings.dragHandleGroup')"
            >
              <GripVerticalIcon :size="14" />
            </button>
            <button
              class="button is-ghost is-small tree-icon"
              type="button"
              @click="toggleGroupCollapsed(group.id)"
            >
              <ChevronDownIcon :class="{ 'is-collapsed': group.collapsed }" :size="14" />
            </button>
            <span class="group-folder-icon" aria-hidden="true">
              <FolderIcon :size="14" />
            </span>
            <div class="tree-group-main">
              <input
                class="input is-small tree-name-input"
                :value="group.name"
                :disabled="!canEditGroup(group)"
                @change="
                  updateGroup(group.id, { name: getInputValue($event).trim() || group.name })
                "
              />
            </div>
            <div class="tree-group-actions">
              <span class="group-view-badge">{{
                t('dashboard.tabsSettings.groupViewCount', {
                  count: getGroupTabCount(group.id),
                })
              }}</span>
              <button
                class="button is-ghost is-small tree-add tree-add-view"
                type="button"
                :title="t('dashboard.tabsSettings.addViewToGroup', { group: group.name })"
                :aria-label="t('dashboard.tabsSettings.addViewToGroup', { group: group.name })"
                @click="startNewTabInGroup(group.id)"
              >
                <ListPlusIcon :size="14" />
              </button>
              <button
                v-if="group.depth < maxGroupDepth"
                class="button is-ghost is-small tree-add"
                type="button"
                :title="t('dashboard.tabsSettings.addChildGroupTitle', { group: group.name })"
                @click="handleStartChildGroup(group.id)"
              >
                <PlusIcon :size="14" />
              </button>
              <button
                class="button is-ghost is-small tree-delete"
                type="button"
                :disabled="!canEditGroup(group)"
                :aria-label="t('dashboard.tabsSettings.deleteGroupLabel', { group: group.name })"
                @click="requestDeleteGroup(group.id)"
              >
                <Trash2Icon :size="14" />
              </button>
            </div>
          </div>

          <div
            v-if="confirmingGroupId === group.id"
            class="inline-delete-confirm"
            role="alert"
            aria-live="polite"
            :style="getNestedPanelStyle(group.depth)"
          >
            <span>{{ t('dashboard.tabsSettings.deleteGroupConfirm', { group: group.name }) }}</span>
            <div class="inline-delete-confirm__actions">
              <button
                class="button is-small is-light"
                type="button"
                @click="cancelDeleteConfirmation"
              >
                {{ t('dashboard.tabsSettings.cancelDeleteButton') }}
              </button>
              <button
                class="button is-small is-danger"
                type="button"
                @click="confirmDeleteGroup(group.id)"
              >
                {{ t('dashboard.tabsSettings.confirmDeleteGroupButton') }}
              </button>
            </div>
          </div>

          <div
            v-if="activeChildCreatorGroupId === group.id"
            class="inline-child-creator"
            :style="getNestedPanelStyle(group.depth)"
          >
            <div class="inline-child-creator__label">
              {{ t('dashboard.tabsSettings.addChildGroupLabel', { group: group.name }) }}
            </div>
            <div class="inline-child-creator__controls">
              <div class="control has-icons-left inline-child-creator__input">
                <input
                  v-model="childGroupName"
                  class="input is-small"
                  type="text"
                  :placeholder="t('dashboard.tabsSettings.childGroupNamePlaceholder')"
                  @keyup.enter="handleCreateChildGroup"
                  @keyup.esc="handleCancelChildGroup"
                />
                <span class="icon is-small is-left"><FolderIcon :size="14" /></span>
              </div>
              <button
                class="button is-primary is-small"
                type="button"
                :disabled="!childGroupName.trim()"
                @click="handleCreateChildGroup"
              >
                <PlusIcon :size="14" />
                <span>{{ t('dashboard.tabsSettings.createGroupButton') }}</span>
              </button>
              <button
                class="button is-ghost is-small"
                type="button"
                @click="handleCancelChildGroup"
              >
                {{ t('dashboard.tabsSettings.cancelChildGroupButton') }}
              </button>
            </div>
          </div>

          <div v-if="!group.collapsed" class="tree-tabs" :style="getNestedPanelStyle(group.depth)">
            <VueDraggable
              v-model="groupTabLists[group.id]!"
              group="custom-tabs"
              :animation="200"
              handle=".drag-handle"
              item-key="id"
              @change="() => handleTabsChanged(group.id)"
            >
              <div
                v-for="tab in groupTabLists[group.id]"
                :key="tab.id"
                class="tree-tab-row"
                :class="{ 'is-selected': selectedTabId === tab.id }"
                role="button"
                :tabindex="confirmingTabId === tab.id ? -1 : 0"
                :aria-label="t('dashboard.tabsSettings.selectViewToEdit', { view: tab.name })"
                @click="selectTabFromRow(tab)"
                @keydown.enter.self="selectTabFromRow(tab)"
              >
                <button
                  class="button is-ghost is-small drag-handle"
                  type="button"
                  :aria-label="t('dashboard.tabsSettings.dragHandleTab')"
                  @click.stop
                >
                  <GripVerticalIcon :size="14" />
                </button>
                <span class="view-glyph" aria-hidden="true"><SearchIcon :size="13" /></span>
                <div class="tree-tab-main">
                  <span>{{ tab.name }}</span>
                  <input
                    v-if="editingSubtitleTabId === tab.id"
                    :ref="setSubtitleInputRef"
                    v-model="editingSubtitleDraft"
                    class="input is-small tab-subtitle-input"
                    type="text"
                    :aria-label="t('dashboard.tabsSettings.editSubtitleLabel', { view: tab.name })"
                    @keydown.enter.stop.prevent="saveSubtitleFromInput(tab)"
                    @keydown.esc.stop.prevent="cancelSubtitleEdit"
                    @blur="saveSubtitleFromInput(tab, true)"
                    @click.stop
                  />
                  <button
                    v-else
                    class="tab-subtitle-button"
                    :class="{ 'is-placeholder': tab.subtitleMode === 'none' }"
                    type="button"
                    :title="getQueryPreview(tab)"
                    @click.stop="startSubtitleEdit(tab)"
                  >
                    {{
                      tab.subtitleMode === 'none'
                        ? t('dashboard.tabsSettings.noSubtitlePlaceholder')
                        : getTabSubtitle(tab)
                    }}
                  </button>
                </div>
                <div class="tree-tab-actions" @click.stop>
                  <div
                    v-if="confirmingTabId === tab.id"
                    class="tab-delete-confirm"
                    role="alert"
                    aria-live="polite"
                  >
                    <span>{{ t('dashboard.tabsSettings.deleteViewConfirm') }}</span>
                    <button
                      class="button is-ghost is-small tree-action-button"
                      type="button"
                      :aria-label="t('dashboard.tabsSettings.cancelDeleteButton')"
                      @click="cancelDeleteConfirmation"
                    >
                      <XIcon :size="14" />
                    </button>
                    <button
                      class="button is-ghost is-small tree-delete"
                      type="button"
                      :aria-label="t('dashboard.tabsSettings.confirmDeleteViewButton')"
                      @click="confirmDeleteTab(tab.id)"
                    >
                      <Trash2Icon :size="14" />
                    </button>
                  </div>
                  <button
                    v-else
                    class="button is-ghost is-small tree-delete"
                    type="button"
                    :aria-label="t('dashboard.tabsSettings.deleteViewLabel', { view: tab.name })"
                    @click="requestDeleteTab(tab.id)"
                  >
                    <Trash2Icon :size="14" />
                  </button>
                </div>
              </div>
            </VueDraggable>
            <button
              v-if="(groupTabLists[group.id] ?? []).length === 0"
              class="empty-drop-zone"
              type="button"
              @click="startNewTabInGroup(group.id)"
            >
              <ListPlusIcon :size="14" aria-hidden="true" />
              <span>{{ t('dashboard.tabsSettings.groupEmptyTabs') }}</span>
            </button>
          </div>
        </article>
      </VueDraggable>
    </div>

    <div class="group-creator-tile">
      <span class="group-creator-tile__icon" aria-hidden="true">
        <FolderPlusIcon :size="16" />
      </span>
      <div class="control has-icons-left group-creator-tile__input">
        <input
          id="new-group-name"
          v-model="newGroup.name"
          class="input is-small"
          type="text"
          :aria-label="t('dashboard.tabsSettings.groupNameLabel')"
          :placeholder="t('dashboard.tabsSettings.groupNamePlaceholder')"
          @keyup.enter="handleCreateGroup"
        />
        <span class="icon is-small is-left"><FolderIcon :size="14" /></span>
      </div>
      <button
        class="button is-primary is-small group-create-button"
        type="button"
        :disabled="!newGroup.name.trim()"
        @click="handleCreateGroup"
      >
        <PlusIcon :size="14" />
        <span>{{ t('dashboard.tabsSettings.createGroupButton') }}</span>
      </button>
    </div>
  </div>
</template>
