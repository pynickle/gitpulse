<script setup lang="ts">
import { LayersIcon, PlusIcon } from '@lucide/vue';

import TabsEditorDrawer from '~/components/dashboard/tabs-settings/TabsEditorDrawer.vue';
import TabsLibraryPanel from '~/components/dashboard/tabs-settings/TabsLibraryPanel.vue';
import type { TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const { t, editorOpen, startNewTab, closeEditor } = props.model;
</script>

<template>
  <div class="tabs-settings-page" @keydown.escape="closeEditor">
    <header class="settings-header">
      <div class="settings-header__icon" aria-hidden="true">
        <LayersIcon :size="20" />
      </div>
      <div class="settings-header__copy">
        <h1 class="settings-header__title">{{ t('dashboard.tabsSettings.pageTitle') }}</h1>
        <p class="settings-header__subtitle">{{ t('dashboard.tabsSettings.heroSubtitle') }}</p>
      </div>
      <button class="button is-small new-view-btn" type="button" @click="startNewTab">
        <PlusIcon :size="14" aria-hidden="true" />
        <span>{{ t('dashboard.tabsSettings.editorTitle') }}</span>
      </button>
    </header>

    <TabsLibraryPanel :model="model" />

    <Transition name="scrim">
      <div v-if="editorOpen" class="editor-scrim" aria-hidden="true" @click="closeEditor" />
    </Transition>
    <Transition name="drawer">
      <TabsEditorDrawer v-if="editorOpen" :model="model" />
    </Transition>
  </div>
</template>

<style lang="scss">
.tabs-settings-page {
  width: 100%;
  min-height: 100%;
  max-width: 62rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}

/* --------------------------------- Header ---------------------------------- */

.settings-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 1.15rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.settings-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  border-radius: 10px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.settings-header__copy {
  min-width: 0;
  flex: 1 1 auto;
}

.settings-header__title {
  margin: 0 0 0.15rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.settings-header__subtitle {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.new-view-btn {
  flex: 0 0 auto;
  gap: 0.35rem;
  height: 2.25rem;
  padding-inline: 0.85rem;
  border-color: transparent;
  color: #ffffff;
  background: var(--gitpulse-primary-solid);
  font-weight: 650;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.new-view-btn:hover {
  color: #ffffff;
  background: var(--gitpulse-primary-solid-hover);
}

/* ------------------------------ Built-in strip ----------------------------- */

.builtin-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1.1rem;
}

.builtin-strip__label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-right: 0.25rem;
  color: var(--gitpulse-text-subtle);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.builtin-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.7rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  color: var(--gitpulse-text-muted);
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 80%, transparent);
  font-size: 0.78rem;
  font-weight: 650;
  cursor: default;
}

/* --------------------------------- Library -------------------------------- */

.library-empty {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  padding: 2.5rem 1rem;
  margin-bottom: 1rem;
  border: 1px dashed var(--gitpulse-border-strong);
  border-radius: 12px;
  text-align: center;
}

.library-empty__icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 50%;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.library-empty__title {
  margin: 0.35rem 0 0;
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 750;
}

.library-empty__hint {
  margin: 0;
  max-width: 26rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
}

.tree-list,
.tree-drag-root,
.tree-tabs {
  display: grid;
  gap: 0.6rem;
}

.tree-list {
  margin-bottom: 1rem;
}

.tree-group {
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 10px;
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
  transition: border-color 0.15s ease;
}

.tree-group:hover {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 26%, var(--gitpulse-border));
}

.tree-group-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.85rem;
  padding: 0.6rem 1rem 0.6rem 0.75rem;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 55%, transparent);
}

.tree-depth-spacer {
  display: block;
  flex: 0 0 auto;
}

.group-folder-icon {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: var(--gitpulse-warning);
  background: var(--gitpulse-warning-soft);
}

.view-glyph {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.tree-icon {
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
}

.tree-icon svg {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tree-icon svg.is-collapsed {
  transform: rotate(-90deg);
}

.tree-group-main,
.tree-tab-main {
  min-width: 0;
  flex: 1 1 0;
}

.tree-group-actions,
.tree-tab-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 0.2rem;
  max-width: max-content;
  margin-left: auto;
}

.tree-group-actions {
  padding-right: 0.1rem;
}

.group-view-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.tree-tab-actions {
  min-width: 1.65rem;
}

.tree-name-input {
  height: 1.85rem;
  border-color: transparent;
  border-bottom: 1px dashed transparent;
  background: transparent;
  font-weight: 700;
}

.tree-name-input:hover:not(:disabled) {
  border-bottom-color: color-mix(in srgb, var(--gitpulse-accent) 46%, transparent);
}

.tree-name-input:focus {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-surface);
}

.tree-delete,
.tree-action-button {
  width: 1.65rem;
  height: 1.65rem;
  flex: 0 0 1.65rem;
  padding: 0;
}

.tree-delete {
  color: var(--gitpulse-danger);
}

.tree-add {
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  color: var(--gitpulse-accent);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.14s ease,
    background 0.15s ease,
    transform 0.15s ease;
}

.tree-group-row:hover .tree-add,
.tree-group-row:focus-within .tree-add {
  opacity: 1;
  pointer-events: auto;
}

.tree-add:hover,
.tree-add:focus-visible {
  background: var(--gitpulse-accent-soft);
  transform: translateY(-1px);
}

.tree-add.tree-add-view {
  color: var(--gitpulse-success);
}

.tree-add.tree-add-view:hover,
.tree-add.tree-add-view:focus-visible {
  background: var(--gitpulse-success-soft);
}

.inline-child-creator,
.inline-delete-confirm {
  display: grid;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem 0.65rem;
  margin: 0.6rem 0.7rem 0.55rem;
  border: 1px dashed color-mix(in srgb, var(--gitpulse-accent) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-accent) 8%, transparent);
}

.inline-delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-color: color-mix(in srgb, var(--gitpulse-danger) 30%, transparent);
  color: var(--gitpulse-danger);
  background: var(--gitpulse-danger-soft);
  font-size: 0.76rem;
  font-weight: 650;
}

.inline-delete-confirm__actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.35rem;
}

.inline-child-creator__label {
  color: var(--gitpulse-accent);
  font-size: 0.72rem;
  font-weight: 750;
}

.inline-child-creator__controls {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.inline-child-creator__input {
  flex: 1 1 12rem;
}

.tree-tabs {
  min-width: 0;
  padding: 0.55rem 1rem 0.7rem 0.7rem;
  margin-right: 0.7rem;
  border-top: 1px solid color-mix(in srgb, var(--gitpulse-border) 60%, transparent);
}

.tree-tab-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--gitpulse-surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.tree-tab-row:hover,
.tree-tab-row:focus-visible {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 24%, transparent);
  background: var(--gitpulse-accent-soft);
}

.tree-tab-row.is-selected {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
  box-shadow: inset 3px 0 0 var(--gitpulse-accent);
}

.tree-tab-main span,
.tree-tab-main small,
.tab-subtitle-button {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-tab-main > span {
  font-weight: 650;
}

.tab-subtitle-button {
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--gitpulse-text-muted);
  background: transparent;
  font-size: 0.78rem;
  text-align: left;
  cursor: text;
}

.tab-subtitle-button:hover,
.tab-subtitle-button:focus-visible {
  color: var(--gitpulse-accent);
  outline: none;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tab-subtitle-button.is-placeholder {
  color: var(--gitpulse-text-subtle);
  font-style: italic;
}

.tab-subtitle-input {
  height: 1.75rem;
  padding-inline: 0.45rem;
}

.tab-delete-confirm {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.2rem;
  color: var(--gitpulse-danger);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.empty-drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.65rem;
  border: 1px dashed var(--gitpulse-border-strong);
  border-radius: 8px;
  color: var(--gitpulse-text-muted);
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.empty-drop-zone:hover {
  border-color: color-mix(in srgb, var(--gitpulse-success) 50%, transparent);
  color: var(--gitpulse-success);
  background: var(--gitpulse-success-soft);
}

/* ----------------------------- Group creator tile -------------------------- */

.group-creator-tile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.8rem;
  border: 1px dashed var(--gitpulse-border-strong);
  border-radius: 10px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 50%, transparent);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.group-creator-tile:focus-within {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 50%, transparent);
  background: var(--gitpulse-surface);
}

.group-creator-tile__icon {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: var(--gitpulse-warning);
  background: var(--gitpulse-warning-soft);
}

.group-creator-tile__input {
  flex: 1 1 12rem;
}

.group-create-button {
  flex: 0 0 auto;
  gap: 0.45rem;
  font-weight: 700;
}

/* ------------------------------- Drag-and-drop ----------------------------- */

.drag-handle {
  flex: 0 0 auto;
  padding: 0 0.15rem;
  cursor: grab;
  color: var(--gitpulse-text-subtle);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tree-group-row:hover .drag-handle,
.tree-group-row:focus-within .drag-handle,
.tree-tab-row:hover .drag-handle,
.tree-tab-row:focus-within .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.sortable-ghost {
  opacity: 0.4;
  background: var(--gitpulse-accent-soft);
}

.sortable-chosen {
  opacity: 0.85;
  box-shadow: var(--gitpulse-shadow-card-hover);
}

.sortable-drag {
  opacity: 0.9;
}

/* ------------------------------- Editor drawer ----------------------------- */

.editor-scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--gitpulse-overlay-bg);
}

.editor-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 41;
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: min(68rem, 94vw);
  border-left: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
}

.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 0.22s ease;
}

.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}

.drawer-enter-active {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.drawer-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(102%);
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 65%, transparent);
}

.drawer-header__titles {
  min-width: 0;
  flex: 1 1 auto;
}

.drawer-title {
  margin: 0;
  color: var(--gitpulse-text-strong);
  font-size: 1.05rem;
  font-weight: 800;
}

.drawer-caption {
  margin: 0.15rem 0 0;
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.destination-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 14rem;
  flex: 0 0 auto;
  padding: 0.18rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 24%, transparent);
  border-radius: 999px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
  font-size: 0.74rem;
  font-weight: 700;
}

.destination-chip svg {
  flex: 0 0 auto;
}

.destination-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-close {
  flex: 0 0 auto;
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
  color: var(--gitpulse-text-muted);
}

.drawer-close:hover {
  color: var(--gitpulse-danger);
  background: var(--gitpulse-danger-soft);
}

.drawer-body {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  min-height: 0;
}

.drawer-form,
.drawer-preview {
  min-width: 0;
  padding: 1.15rem 1.25rem 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.drawer-preview {
  border-left: 1px solid var(--gitpulse-border);
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 45%, transparent);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-preview__label {
  margin-bottom: 0;
}

.pr-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 0.7rem;
  min-height: 2rem;
  flex: 0 0 auto;
  padding-bottom: 0.55rem;
}

.preview-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.preview-content .search-result-preview {
  min-height: 100%;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--gitpulse-border);
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 65%, transparent);
}

.drawer-cancel-btn {
  font-weight: 600;
}

.drawer-save-btn {
  gap: 0.4rem;
  min-width: 13rem;
  justify-content: center;
  border-color: transparent;
  color: #ffffff;
  background: var(--gitpulse-primary-solid) !important;
  font-weight: 700;

  &:hover:not(:disabled) {
    color: #ffffff;
    background: var(--gitpulse-primary-solid-hover);
  }

  &:disabled {
    opacity: 0.5;
  }
}

/* ------------------------------ Section labels ----------------------------- */

.section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.search-section-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
  min-width: 0;
}

.github-test-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.6rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-surface);
  font-size: 0.72rem;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;

  svg {
    fill: currentColor;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--gitpulse-accent) 36%, transparent);
    color: var(--gitpulse-accent);
    background: color-mix(in srgb, var(--gitpulse-accent) 12%, var(--gitpulse-surface));
  }
}

.section-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--gitpulse-text-strong);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-icon {
  display: inline-grid;
  width: 1.45rem;
  height: 1.45rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.section-icon.is-query {
  color: var(--gitpulse-purple);
  background: var(--gitpulse-purple-soft);
}

.section-icon.is-preview {
  color: var(--gitpulse-success);
  background: var(--gitpulse-success-soft);
}

/* ------------------------------- Editor form ------------------------------- */

.search-fields-panel {
  padding: 0.85rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 72%, transparent);
}

.subtitle-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.subtitle-auto-hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle-mode-row {
  flex-shrink: 0;
}

.segmented-button.is-subtitle-mode {
  min-height: 1.55rem;
  padding: 0.15rem 0.45rem;
  font-size: 0.7rem;
}

.segmented-row,
.source-selector {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.segmented-row.is-wrap,
.source-selector {
  flex-wrap: wrap;
}

.chip-button,
.segmented-button,
.source-option {
  border: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text);
  background: var(--gitpulse-surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.chip-button,
.segmented-button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.85rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 650;
  white-space: nowrap;
}

.chip-button.is-compact {
  min-height: 1.6rem;
  padding: 0.18rem 0.45rem;
}

.chip-button:hover:not(:disabled),
.segmented-button:hover,
.source-option:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 36%, transparent);
  color: var(--gitpulse-accent);
  background: color-mix(in srgb, var(--gitpulse-accent) 14%, var(--gitpulse-surface));
}

.source-option:hover:not(:disabled) small {
  color: var(--gitpulse-accent);
}

.source-option.is-active:hover:not(:disabled) {
  border-color: var(--gitpulse-accent);
  color: #ffffff;
  background: color-mix(in srgb, var(--gitpulse-accent) 86%, #ffffff);
}

.source-option.is-active:hover:not(:disabled) small {
  color: rgba(255, 255, 255, 0.76);
}

.chip-button.is-active {
  border-color: var(--gitpulse-accent);
  color: #ffffff;
  background: var(--gitpulse-accent);
}

.segmented-button.is-active {
  --active: var(--seg-active-bg, var(--gitpulse-accent));
  border-color: var(--seg-active-border, var(--active));
  color: #ffffff;
  background: var(--active);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--active) 30%, transparent);
}

.chip-button:disabled,
.source-option:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.source-selector {
  padding: 0.25rem;
  margin-bottom: 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 95%, transparent);
}

.source-option {
  display: inline-grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.45rem;
  min-width: 11rem;
  padding: 0.48rem 0.65rem;
  border-radius: 6px;
  text-align: left;
}

.source-option svg {
  grid-row: 1 / span 2;
  align-self: center;
  fill: currentColor;
}

.source-option span {
  font-size: 0.84rem;
  font-weight: 750;
}

.source-option small {
  color: var(--gitpulse-text-muted);
  font-size: 0.7rem;
}

.source-option.is-active {
  border-color: var(--gitpulse-accent);
  color: #ffffff;
  background: var(--gitpulse-accent);
}

.source-option.is-active small {
  color: rgba(255, 255, 255, 0.76);
}

.endpoint-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
}

.endpoint-row__label {
  flex: 0 0 auto;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.field-grid,
.toggle-grid,
.sort-row,
.scope-grid {
  display: grid;
  gap: 0.75rem;
}

.field-grid.is-two,
.toggle-grid,
.sort-row,
.scope-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-grid.is-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.toggle-section {
  margin-bottom: 0.85rem;
}

.label-heading {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.label-combobox {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-height: 2.6rem;
  padding: 0.45rem;
  border: 1px solid var(--bulma-border, #dbdbdb);
  border-radius: 6px;
  background: var(--gitpulse-surface);
}

.label-chip {
  gap: 0.25rem;
}

.label-input {
  min-width: 12rem;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
}

.label-suggestions {
  display: grid;
  gap: 0.15rem;
  max-height: 11rem;
  padding: 0.35rem;
  margin-top: 0.35rem;
  overflow: auto;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
}

.suggestion-row {
  justify-content: flex-start;
}

/* Compact type/state row */
.compact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.compact-toggle {
  margin-bottom: 0;
  flex: 1;
  min-width: fit-content;
}

/* Advanced filters collapsible */
.advanced-section {
  margin: 0.85rem 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 50%, transparent);
  transition: border-color 0.15s ease;

  &.is-open {
    border-color: color-mix(in srgb, var(--gitpulse-accent) 26%, transparent);
    background: color-mix(in srgb, var(--gitpulse-surface-muted) 72%, transparent);
  }
}

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  font-weight: 650;
  transition: color 0.15s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }
}

.advanced-toggle__icon {
  transition: transform 0.2s ease;
  color: var(--gitpulse-text-muted);
  flex: 0 0 auto;

  &.rotated {
    transform: rotate(90deg);
    color: var(--gitpulse-accent);
  }
}

.advanced-count {
  margin-left: auto;
}

.advanced-body {
  padding: 0 0.65rem 0.65rem;
}

.advanced-pr-band {
  padding: 0.75rem;
  margin-top: 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-success-soft);
}

/* ------------------------------ Live preview ------------------------------- */

.preview-results {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}

.preview-pagination {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.preview-page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--bulma-border, #dbdbdb);
  border-radius: 5px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-accent-soft);
    border-color: var(--gitpulse-accent);
    color: var(--gitpulse-accent);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.preview-page-info {
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--gitpulse-text);
  min-width: 5rem;
  text-align: center;
}

/* ------------------------------- Responsive -------------------------------- */

@media (max-width: 1160px) {
  .drawer-body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .drawer-form,
  .drawer-preview {
    overflow-y: visible;
  }

  .drawer-preview {
    border-left: 0;
    border-top: 1px solid var(--gitpulse-border);
  }

  .editor-drawer {
    width: min(46rem, 100vw);
  }
}

@media (max-width: 820px) {
  .settings-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .settings-header__copy {
    flex-basis: calc(100% - 3.35rem);
  }

  .new-view-btn {
    margin-left: 3.35rem;
  }

  .editor-drawer {
    width: 100vw;
    border-left: 0;
  }

  .field-grid.is-two,
  .field-grid.is-three,
  .toggle-grid,
  .sort-row,
  .scope-grid {
    grid-template-columns: 1fr;
  }

  .source-selector {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .source-option {
    min-width: 10.5rem;
  }

  .endpoint-row {
    flex-wrap: wrap;
  }

  .tree-tabs {
    margin-left: 0.85rem !important;
    padding-left: 0.7rem;
  }

  .drawer-header {
    flex-wrap: wrap;
  }
}

/* -------------------------------- Dark mode -------------------------------- */

html.dark .builtin-pill {
  background: var(--gitpulse-surface-muted);
}

html.dark .tree-group {
  background: var(--gitpulse-surface-raised);
}

html.dark .tree-group-row {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 70%, transparent);
}

html.dark .tree-tab-row,
html.dark .inline-child-creator,
html.dark .label-combobox,
html.dark .label-suggestions,
html.dark .chip-button,
html.dark .segmented-button,
html.dark .github-test-link,
html.dark .source-option,
html.dark .preview-page-btn {
  background: var(--gitpulse-surface);
}

html.dark .chip-button.is-active,
html.dark .segmented-button.is-active,
html.dark .source-option.is-active {
  background: var(--gitpulse-accent-soft);
  border-color: color-mix(in srgb, var(--gitpulse-accent) 30%, transparent);
  color: var(--gitpulse-accent);
}

html.dark .source-option:hover:not(:disabled) small,
html.dark .source-option.is-active small {
  color: var(--gitpulse-accent);
}

html.dark .source-option.is-active:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 50%, transparent);
  color: var(--gitpulse-accent);
  background: color-mix(in srgb, var(--gitpulse-accent) 28%, var(--gitpulse-surface));
}

html.dark .source-option.is-active:hover:not(:disabled) small {
  color: var(--gitpulse-accent);
}

html.dark .search-fields-panel,
html.dark .source-selector {
  background: var(--gitpulse-surface-muted);
}

html.dark .group-creator-tile {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 65%, transparent);
}

html.dark .group-creator-tile:focus-within {
  background: var(--gitpulse-surface-raised);
}

html.dark .editor-drawer {
  background: var(--gitpulse-shell-bg);
}

html.dark .drawer-header,
html.dark .drawer-footer {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 80%, transparent);
}

html.dark .drawer-preview {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 55%, transparent);
}

html.dark .advanced-section {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 58%, transparent);
}

html.dark .advanced-section.is-open {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 76%, transparent);
}

html.dark .advanced-pr-band {
  background: var(--gitpulse-success-soft);
}

html.dark .tab-subtitle-button,
html.dark .tree-tab-main small {
  color: var(--gitpulse-text-subtle);
}

html.dark .section-icon.is-query {
  background: var(--gitpulse-purple-soft);
  color: var(--gitpulse-purple);
}

html.dark .library-empty,
html.dark .empty-drop-zone {
  color: var(--gitpulse-text-subtle);
}
</style>
