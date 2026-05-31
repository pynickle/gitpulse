<script setup lang="ts">
import { ArrowLeftIcon, LinkIcon } from 'lucide-vue-next';

import type { TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const { t, localePath, githubPreviewUrl, deselectTab } = props.model;
</script>

<template>
  <div class="tabs-settings-page" @keydown.escape="deselectTab">
    <nav class="tabs-nav-back" aria-label="Page navigation">
      <NuxtLink :to="localePath('/dashboard')" class="button is-ghost is-small nav-back-link">
        <ArrowLeftIcon :size="16" />
        <span>{{ t('dashboard.tabsSettings.backToDashboard') }}</span>
      </NuxtLink>
    </nav>

    <header class="settings-header">
      <div>
        <h1 class="title is-4 mb-1">{{ t('dashboard.tabsSettings.pageTitle') }}</h1>
      </div>
      <a
        class="button is-small is-light preview-link"
        :href="githubPreviewUrl"
        target="_blank"
        rel="noreferrer"
      >
        <span class="icon is-small"><LinkIcon :size="14" /></span>
        <span>{{ t('dashboard.tabsSettings.openQuery') }}</span>
      </a>
    </header>

    <div class="settings-grid">
      <TabsViewsPanel :model="model" />
      <TabsEditorPanel :model="model" />
    </div>
  </div>
</template>

<style lang="scss">
.tabs-settings-page {
  width: 100%;
  min-height: 100%;
  padding: 1.25rem;
}

.settings-header,
.panel-heading-row,
.section-label-row,
.section-label,
.subtitle-label-row,
.builtin-row,
.tree-group-row,
.tree-tab-row,
.preview-header,
.preview-status-row,
.label-heading {
  display: flex;
  align-items: center;
}

.settings-header {
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tabs-nav-back {
  margin-bottom: 1.25rem;
}

.nav-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: auto;
  padding: 0;
  border: none;
  color: var(--gitpulse-accent);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.nav-back-link:hover {
  background: transparent;
  opacity: 0.72;
}

.nav-back-link:focus-visible {
  border-radius: 4px;
  background: transparent;
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

.settings-subtitle,
.panel-caption,
.tree-group-main small,
.tree-tab-main small,
.query-preview,
.chip-label {
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
}

.section-label {
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.settings-subtitle {
  margin: 0;
}

.preview-link {
  flex: 0 0 auto;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.82fr) minmax(28rem, 1.45fr);
  gap: 1rem;
  align-items: start;
}

.views-tree-panel,
.editor-panel {
  margin-bottom: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-card);
}

.panel-heading-row,
.section-label-row,
.preview-header,
.preview-status-row {
  justify-content: space-between;
  gap: 1rem;
}

.section-label {
  gap: 0.4rem;
  color: var(--bulma-text-strong, #111827);
  font-size: 0.72rem;
}

.builtin-section,
.custom-section,
.search-fields-panel,
.preview-panel,
.group-creator-strip,
.pr-field-band {
  padding: 0.85rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 72%, transparent);
}

.builtin-section {
  padding: 0.6rem 0.75rem;
}

.builtin-section,
.custom-section,
.group-creator-strip {
  margin-top: 0.8rem;
}

.group-insights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.group-insight-card {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
}

.group-insight-card strong {
  color: var(--gitpulse-accent);
  font-size: 1rem;
  line-height: 1;
}

.group-insight-card span {
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.group-creator-strip {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.75rem;
  border-color: var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.group-creator-form,
.inline-child-creator__controls,
.inline-delete-confirm,
.inline-delete-confirm__actions,
.tab-delete-confirm,
.tree-group-actions,
.tree-tab-actions {
  display: flex;
  align-items: center;
}

.group-creator-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.group-creator-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.group-creator-title {
  margin: 0;
  color: var(--bulma-text-strong, #111827);
  font-size: 0.9rem;
  font-weight: 750;
}

.group-creator-copy {
  margin: 0.1rem 0 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.group-creator-form {
  gap: 0.55rem;
  align-items: flex-end;
}

.group-creator-form .field:first-child {
  flex: 1 1 11rem;
}

.group-create-button {
  flex: 0 0 auto;
  gap: 0.45rem;
  font-weight: 700;
}

.builtin-list,
.tree-list,
.tree-tabs {
  display: grid;
  gap: 0.6rem;
}

.builtin-list {
  gap: 0.3rem;
  margin-top: 0.4rem;
}

.tree-list {
  margin-top: 0.5rem;
}

.builtin-row,
.tree-tab-row {
  gap: 0.55rem;
  min-height: 2.5rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--bulma-scheme-main, #ffffff);
}

.builtin-row {
  gap: 0.45rem;
  min-height: 1.9rem;
  padding: 0.35rem 0.65rem;
  color: var(--bulma-text, #334155);
}

.tree-group {
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--bulma-scheme-main, #ffffff);
}

.tree-group-row {
  position: relative;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.6rem 1rem 0.6rem 0.75rem;
  border: 1px solid transparent;
  box-shadow: inset 3px 0 0 transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.tree-depth-spacer {
  display: block;
  flex: 0 0 auto;
}

.tree-group-row:hover,
.tree-group-row:focus-within,
.tree-tab-row:hover,
.builtin-row:hover {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 24%, transparent);
  background: var(--gitpulse-accent-soft);
}

.tree-tab-row.is-selected {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
  box-shadow: inset 3px 0 0 var(--gitpulse-accent);
}

.tree-group-row:hover,
.tree-group-row:focus-within {
  box-shadow: inset 3px 0 0 var(--gitpulse-accent);
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
  border-bottom: 1px dashed var(--gitpulse-border-strong);
  background: transparent;
  font-weight: 650;
}

.tree-name-input:hover:not(:disabled) {
  border-bottom-color: color-mix(in srgb, var(--gitpulse-accent) 46%, transparent);
}

.tree-name-input:focus {
  border-color: var(--gitpulse-accent);
  background: var(--bulma-scheme-main, #ffffff);
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

.inline-child-creator,
.inline-delete-confirm {
  display: grid;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem 0.65rem;
  margin-right: 0.7rem;
  margin-bottom: 0.55rem;
  margin-top: 0.6rem;
  border: 1px dashed color-mix(in srgb, var(--gitpulse-accent) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-accent) 8%, transparent);
}

.inline-delete-confirm {
  display: flex;
  justify-content: space-between;
  border-color: color-mix(in srgb, var(--gitpulse-danger) 30%, transparent);
  color: var(--gitpulse-danger);
  background: var(--gitpulse-danger-soft);
  font-size: 0.76rem;
  font-weight: 650;
}

.inline-delete-confirm__actions {
  flex: 0 0 auto;
  gap: 0.35rem;
}

.inline-child-creator__label {
  color: var(--gitpulse-accent);
  font-size: 0.72rem;
  font-weight: 750;
}

.inline-child-creator__controls {
  gap: 0.45rem;
}

.inline-child-creator__input {
  flex: 1 1 12rem;
}

.tree-tabs {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.35rem 1rem 0.7rem 0.7rem;
  margin-right: 0.7rem;
}

.tree-tab-row {
  min-width: 0;
  flex-wrap: wrap;
}

.tree-tab-main span,
.tree-tab-main small,
.tab-subtitle-button {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.tab-subtitle-input {
  height: 1.75rem;
  padding-inline: 0.45rem;
}

.tab-delete-confirm {
  flex: 0 0 auto;
  gap: 0.2rem;
  color: var(--gitpulse-danger);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.subtitle-label-row {
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.subtitle-auto-hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-picker,
.segmented-row,
.source-selector {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.segmented-row.is-wrap,
.group-picker,
.source-selector {
  flex-wrap: wrap;
}

/* 鈹€鈹€ Drag-and-drop 鈹€鈹€ */

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

:deep(.sortable-chosen) {
  opacity: 0.85;
  box-shadow: var(--gitpulse-shadow-card-hover);
}

.chip-button,
.group-choice,
.segmented-button,
.source-option {
  border: 1px solid var(--gitpulse-border);
  color: var(--bulma-text, #334155);
  background: var(--bulma-scheme-main, #ffffff);
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
}

.group-choice {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-size: 0.84rem;
  font-weight: 650;
}

.chip-button:hover:not(:disabled),
.group-choice:hover,
.segmented-button:hover,
.source-option:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 36%, transparent);
  color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.chip-button.is-active {
  border-color: var(--gitpulse-accent);
  color: #ffffff;
  background: var(--gitpulse-accent);
}

.group-choice.is-active {
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
}

.source-option span {
  font-size: 0.84rem;
  font-weight: 750;
}

.source-option small {
  color: var(--bulma-text-light, #6b7280);
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

.field-grid.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.toggle-section {
  margin-bottom: 0.85rem;
}

.segmented-row {
  flex-wrap: wrap;
}

.segmented-row.is-compact-row {
  flex-wrap: nowrap;
}

.label-heading,
.section-label {
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
  background: var(--bulma-scheme-main, #ffffff);
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
  background: var(--bulma-scheme-main, #ffffff);
  box-shadow: var(--gitpulse-shadow-raised);
}

.suggestion-row {
  justify-content: flex-start;
}

.preview-panel {
  margin-top: 1rem;
  border-color: var(--gitpulse-border);
  background: var(--bulma-scheme-main, #ffffff);
}

/* 鈹€鈹€ Tokenized query box 鈹€鈹€ */
.tokenized-query-box {
  margin-top: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 22%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 82%, transparent);
  overflow: hidden;
}

.tqb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.7rem;
  background: var(--gitpulse-accent-soft);
  border-bottom: 1px solid color-mix(in srgb, var(--gitpulse-accent) 18%, transparent);
}

.tqb-label {
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gitpulse-accent);
}

.tqb-gh-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--gitpulse-accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.tqb-body {
  padding: 0.65rem 0.7rem;
  font-family: 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 0.78rem;
}

/* 鈹€鈹€ Preview results 鈹€鈹€ */
.preview-results {
  margin-top: 0.75rem;
}

.pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.pr-label {
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bulma-text-light, #6b7280);
}

/* 鈹€鈹€ Preview pagination 鈹€鈹€ */
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
  background: var(--bulma-scheme-main, #ffffff);
  color: var(--bulma-text, #4a4a4a);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--bulma-link-soft);
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
  color: var(--bulma-text, #4a4a4a);
  min-width: 5rem;
  text-align: center;
}

/* 鈹€鈹€ Compact type/state row 鈹€鈹€ */
.cmpact-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.cmpact-toggle {
  margin-bottom: 0;
  flex: 1;
}

/* 鈹€鈹€ Advanced filters collapsible 鈹€鈹€ */
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

.preview-create-btn {
  background: var(--gitpulse-accent);
  border-color: transparent;
  color: #ffffff;
  font-weight: 600;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: var(--gitpulse-accent-hover);
    color: #ffffff;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.query-preview {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-drop-zone,
.empty-state {
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
}

.empty-drop-zone {
  padding: 0.65rem;
  border: 1px dashed var(--gitpulse-border);
  border-radius: 6px;
  text-align: center;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  min-height: 8rem;
}

@media (max-width: 1160px) {
  .settings-grid,
  .field-grid.is-four {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .settings-header,
  .preview-header,
  .preview-status-row {
    align-items: stretch;
    flex-direction: column;
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

  .tree-tabs {
    margin-left: 0.85rem !important;
    padding-left: 0.7rem;
  }
}

html.dark .builtin-section,
html.dark .custom-section,
html.dark .search-fields-panel,
html.dark .group-creator-strip,
html.dark .pr-field-band,
html.dark .source-selector {
  background: var(--gitpulse-surface-muted);
}

html.dark .preview-panel {
  background: var(--gitpulse-surface);
}

html.dark .tokenized-query-box {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 82%, transparent);
}

html.dark .tqb-header {
  background: var(--gitpulse-accent-soft);
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

html.dark .builtin-row,
html.dark .tree-group,
html.dark .inline-child-creator,
html.dark .tree-tab-row,
html.dark .label-combobox,
html.dark .label-suggestions,
html.dark .chip-button,
html.dark .group-choice,
html.dark .segmented-button,
html.dark .source-option {
  background: var(--gitpulse-surface);
}

html.dark .chip-button.is-active,
html.dark .group-choice.is-active,
html.dark .segmented-button.is-active,
html.dark .source-option.is-active {
  background: var(--gitpulse-accent-soft);
  border-color: color-mix(in srgb, var(--gitpulse-accent) 30%, transparent);
  color: var(--gitpulse-accent);
}

html.dark .source-option.is-active small {
  color: var(--gitpulse-text-muted);
}

html.dark .tree-tab-main small,
html.dark .panel-caption,
html.dark .query-preview,
html.dark .chip-label,
html.dark .group-creator-copy,
html.dark .tab-subtitle-button {
  color: var(--gitpulse-text-subtle);
}

html.dark .group-insight-card span {
  color: var(--gitpulse-text-muted);
}

html.dark .empty-drop-zone,
html.dark .empty-state {
  color: var(--gitpulse-text-subtle);
}

html.dark .advanced-toggle__icon {
  color: var(--gitpulse-text-muted);
}

html.dark .group-view-badge {
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
}

.editor-deselect-btn {
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.8rem;
  height: auto;
  color: var(--gitpulse-accent);
}

.editor-deselect-btn:hover {
  background: var(--gitpulse-accent-soft);
}
</style>
