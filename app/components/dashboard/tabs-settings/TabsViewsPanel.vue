<script setup lang="ts">
import {
  BellIcon,
  BookMarkedIcon,
  ChevronDownIcon,
  CircleDotIcon,
  DatabaseIcon,
  FolderOpenIcon,
  GitPullRequestIcon,
  GripVerticalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';

import type { TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const {
  t,
  maxGroupDepth,
  customTabs,
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
  parentGroupOptions,
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
} = props.model;
</script>
<template>
  <section class="box views-tree-panel">
    <div class="panel-heading-row">
      <div>
        <h2 class="title is-6 mb-1">{{ t('dashboard.tabsSettings.viewsPanelTitle') }}</h2>
      </div>
    </div>

    <section class="builtin-section">
      <div class="section-label-row">
        <div class="section-label">
          <DatabaseIcon :size="15" />
          <span>{{ t('dashboard.tabsSettings.builtinSectionTitle') }}</span>
        </div>
      </div>
      <div class="builtin-list" role="list">
        <article
          v-for="tab in builtinTabs"
          :key="tab.id"
          class="builtin-row"
          role="listitem"
          :aria-label="`${t('dashboard.tabsSettings.builtinLocked')}: ${tab.name}`"
          :title="t('dashboard.tabsSettings.builtinLocked')"
        >
          <BellIcon v-if="tab.id === 'notifications'" :size="14" />
          <CircleDotIcon v-else-if="tab.id === 'issues'" :size="14" />
          <GitPullRequestIcon v-else-if="tab.id === 'pulls'" :size="14" />
          <BookMarkedIcon v-else :size="14" />
          <div class="tree-tab-main">
            <span>{{ tab.name }}</span>
          </div>
          <span class="tag is-light is-small">{{ t('dashboard.tabsSettings.builtinLocked') }}</span>
        </article>
      </div>
    </section>

    <section class="custom-section">
      <div class="section-label-row">
        <div class="section-label">
          <FolderOpenIcon :size="15" />
          <span>{{ t('dashboard.tabsSettings.customSectionTitle') }}</span>
        </div>
      </div>

      <div class="group-insights" :aria-label="t('dashboard.tabsSettings.groupOverviewLabel')">
        <div class="group-insight-card">
          <strong>{{ customGroupRows.length }}</strong>
          <span>{{ t('dashboard.tabsSettings.groupInsightGroups') }}</span>
        </div>
        <div class="group-insight-card">
          <strong>{{ customTabs.length }}</strong>
          <span>{{ t('dashboard.tabsSettings.groupInsightViews') }}</span>
        </div>
        <div class="group-insight-card">
          <strong>{{ parentGroupOptions.length }}</strong>
          <span>{{ t('dashboard.tabsSettings.groupInsightParents') }}</span>
        </div>
      </div>

      <section class="group-creator-strip">
        <div class="group-creator-header">
          <div class="group-creator-icon" aria-hidden="true">
            <FolderOpenIcon :size="18" />
          </div>
          <div>
            <h3 class="group-creator-title">
              {{ t('dashboard.tabsSettings.groupCreatorTitle') }}
            </h3>
            <p class="group-creator-copy">
              {{ t('dashboard.tabsSettings.groupCreatorCaption') }}
            </p>
          </div>
        </div>
        <div class="group-creator-form">
          <div class="field mb-0">
            <label class="label is-small" for="new-group-name">
              {{ t('dashboard.tabsSettings.groupNameLabel') }}
            </label>
            <div class="control has-icons-left">
              <input
                id="new-group-name"
                v-model="newGroup.name"
                class="input is-small"
                type="text"
                :placeholder="t('dashboard.tabsSettings.groupNamePlaceholder')"
                @keyup.enter="handleCreateGroup"
              />
              <span class="icon is-small is-left"><FolderOpenIcon :size="14" /></span>
            </div>
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
      </section>

      <div v-if="customGroupRows.length === 0" class="empty-state">
        <FolderOpenIcon :size="36" />
        <p class="empty-state-title">{{ t('dashboard.tabsSettings.customSectionEmpty') }}</p>
        <p class="empty-state-hint">{{ t('dashboard.tabsSettings.customSectionEmptyHint') }}</p>
      </div>

      <div v-else class="tree-list">
        <VueDraggable
          v-model="draggableGroupRows"
          :animation="200"
          handle=".drag-handle"
          item-key="id"
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
              <span>{{
                t('dashboard.tabsSettings.deleteGroupConfirm', { group: group.name })
              }}</span>
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
                  <span class="icon is-small is-left"><FolderOpenIcon :size="14" /></span>
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

            <div
              v-if="!group.collapsed"
              class="tree-tabs"
              :style="getNestedPanelStyle(group.depth)"
            >
              <VueDraggable
                v-model="groupTabLists[group.id]"
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
                  @click="model.selectTabForEdit(tab)"
                  @keydown.enter="model.selectTabForEdit(tab)"
                >
                  <button
                    class="button is-ghost is-small drag-handle"
                    type="button"
                    :aria-label="t('dashboard.tabsSettings.dragHandleTab')"
                    @click.stop
                  >
                    <GripVerticalIcon :size="14" />
                  </button>
                  <SearchIcon :size="15" />
                  <div class="tree-tab-main">
                    <span>{{ tab.name }}</span>
                    <input
                      v-if="editingSubtitleTabId === tab.id"
                      v-model="editingSubtitleDraft"
                      class="input is-small tab-subtitle-input"
                      type="text"
                      :aria-label="
                        t('dashboard.tabsSettings.editSubtitleLabel', { view: tab.name })
                      "
                      @keyup.enter="saveSubtitleEdit(tab)"
                      @keyup.esc="cancelSubtitleEdit"
                      @blur="saveSubtitleEdit(tab)"
                      @click.stop
                    />
                    <button
                      v-else
                      class="tab-subtitle-button"
                      type="button"
                      :title="getQueryPreview(tab)"
                      @click.stop="startSubtitleEdit(tab)"
                    >
                      {{ getTabSubtitle(tab) }}
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
              <p v-if="(groupTabLists[group.id] ?? []).length === 0" class="empty-drop-zone">
                {{ t('dashboard.tabsSettings.groupEmptyTabs') }}
              </p>
            </div>
          </article>
        </VueDraggable>
      </div>
    </section>
  </section>
</template>
