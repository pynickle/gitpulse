<script setup lang="ts">
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  ListFilterIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
  XIcon,
} from '@lucide/vue';
import { GitHubIcon } from 'vue3-simple-icons';

import SearchResultPreview from '~/components/dashboard/SearchResultPreview.vue';
import GitHubSearchAstPanel from '~/components/dashboard/tabs-settings/GitHubSearchAstPanel.vue';
import GitHubSearchSyntaxEditor from '~/components/dashboard/tabs-settings/GitHubSearchSyntaxEditor.vue';
import type { TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const {
  t,
  endpointOptions,
  subtitleModeOptions,
  newTab,
  previewLoading,
  previewError,
  previewResult,
  previewPage,
  previewTotalPages,
  isEditing,
  editorTitle,
  editorCaption,
  selectedGroupExists,
  selectedGroupName,
  searchSyntaxAst,
  hasSearchSyntaxFeedback,
  operatorWarningMessage,
  canSaveTab,
  saveValidationMessage,
  githubPreviewUrl,
  handleSubtitleInput,
  setSubtitleMode,
  setSearchEndpoint,
  closeEditor,
  handleSaveTab,
  goToPreviewPage,
} = props.model;
</script>
<template>
  <aside
    class="editor-drawer"
    role="dialog"
    aria-modal="false"
    :aria-label="editorTitle"
    @keydown.esc.stop="closeEditor"
  >
    <header class="drawer-header">
      <div class="drawer-header__titles">
        <h2 class="drawer-title">{{ editorTitle }}</h2>
        <p class="drawer-caption">
          {{ editorCaption }}
        </p>
      </div>
      <span class="destination-chip" :title="editorCaption">
        <FolderOpenIcon :size="12" aria-hidden="true" />
        <span>{{ selectedGroupName }}</span>
      </span>
      <button
        class="button is-ghost drawer-close"
        type="button"
        :aria-label="t('dashboard.tabsSettings.closeEditorLabel')"
        @click="closeEditor"
      >
        <XIcon :size="16" />
      </button>
    </header>

    <div class="drawer-body">
      <div class="drawer-form">
        <div class="field">
          <label class="label">{{ t('dashboard.tabsSettings.viewNameLabel') }}</label>
          <div class="control has-icons-left">
            <input v-model="newTab.name" class="input" type="text" />
            <span class="icon is-small is-left"><SearchIcon :size="16" /></span>
          </div>
        </div>

        <div class="field">
          <div class="subtitle-label-row">
            <label class="label mb-0" for="new-tab-subtitle">
              {{ t('dashboard.tabsSettings.viewSubtitleLabel') }}
            </label>
            <div
              class="segmented-row subtitle-mode-row"
              role="radiogroup"
              :aria-label="t('dashboard.tabsSettings.viewSubtitleLabel')"
            >
              <button
                v-for="option in subtitleModeOptions"
                :key="option.value"
                class="segmented-button is-subtitle-mode"
                :class="{ 'is-active': newTab.subtitleMode === option.value }"
                type="button"
                role="radio"
                :aria-checked="newTab.subtitleMode === option.value"
                @click="setSubtitleMode(option.value)"
              >
                {{ t(option.labelKey) }}
              </button>
            </div>
          </div>
          <div v-if="newTab.subtitleMode === 'custom'" class="control has-icons-left">
            <input
              id="new-tab-subtitle"
              class="input"
              type="text"
              :value="newTab.subtitle"
              @input="handleSubtitleInput"
            />
            <span class="icon is-small is-left"><ListFilterIcon :size="16" /></span>
          </div>
          <p v-if="newTab.subtitleMode === 'none'" class="help subtitle-auto-hint">
            {{ t('dashboard.tabsSettings.noSubtitleHint') }}
          </p>
        </div>

        <section class="search-fields-panel">
          <div class="section-label-row mb-3">
            <div class="section-label">
              <span class="section-icon is-query" aria-hidden="true">
                <ListFilterIcon :size="13" />
              </span>
              <span>{{ t('dashboard.tabsSettings.searchSyntaxLabel') }}</span>
            </div>
            <div class="search-section-actions">
              <a class="github-test-link" :href="githubPreviewUrl" target="_blank" rel="noreferrer">
                <GitHubIcon :size="13" aria-hidden="true" />
                <span>{{ t('dashboard.tabsSettings.testInGithub') }}</span>
              </a>
            </div>
          </div>

          <div class="endpoint-row">
            <span class="endpoint-row__label">{{ t('dashboard.tabsSettings.endpointLabel') }}</span>
            <div
              class="segmented-row"
              role="radiogroup"
              :aria-label="t('dashboard.tabsSettings.endpointLabel')"
            >
              <button
                v-for="endpoint in endpointOptions"
                :key="endpoint.value"
                class="segmented-button"
                :class="{ 'is-active': newTab.query.endpoint === endpoint.value }"
                type="button"
                role="radio"
                :aria-checked="newTab.query.endpoint === endpoint.value"
                @click="setSearchEndpoint(endpoint.value)"
              >
                {{ t(endpoint.labelKey) }}
              </button>
            </div>
          </div>

          <div class="field">
            <label class="label">{{ t('dashboard.tabsSettings.searchSyntaxInputLabel') }}</label>
            <GitHubSearchSyntaxEditor
              v-model="newTab.query.syntax"
              :ast="searchSyntaxAst"
              :placeholder="t('dashboard.tabsSettings.searchSyntaxPlaceholder')"
            />
          </div>

          <GitHubSearchAstPanel
            v-if="hasSearchSyntaxFeedback"
            :ast="searchSyntaxAst"
            :operator-warning-message="operatorWarningMessage"
            :t="t"
          />
        </section>
      </div>
      <aside class="drawer-preview">
        <div class="pr-header">
          <div class="section-label drawer-preview__label">
            <span class="section-icon is-preview" aria-hidden="true">
              <RadarIcon :size="13" />
            </span>
            <span>{{ t('dashboard.tabsSettings.previewLabel') }}</span>
          </div>
          <div class="preview-pagination">
            <button
              class="preview-page-btn"
              :disabled="previewPage <= 1"
              :aria-label="t('dashboard.pagination.previous')"
              @click="goToPreviewPage(Math.max(1, previewPage - 1))"
            >
              <ChevronLeftIcon :size="14" aria-hidden="true" />
            </button>
            <span class="preview-page-info">
              {{
                t('dashboard.tabsSettings.previewPage', {
                  page: previewPage,
                  total: previewTotalPages,
                })
              }}
            </span>
            <button
              class="preview-page-btn"
              :disabled="previewPage >= previewTotalPages"
              :aria-label="t('dashboard.pagination.next')"
              @click="goToPreviewPage(Math.min(previewTotalPages, previewPage + 1))"
            >
              <ChevronRightIcon :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="preview-content">
          <SearchResultPreview
            :items="previewResult?.items ?? null"
            :loading="previewLoading"
            :error="previewError"
            :loading-label="t('dashboard.tabsSettings.previewLoading')"
            :waiting-label="t('dashboard.tabsSettings.previewWaiting')"
            :empty-label="t('dashboard.tabsSettings.previewEmptyResults')"
          />
        </div>
      </aside>
    </div>

    <footer class="drawer-footer">
      <button class="button is-light drawer-cancel-btn" type="button" @click="closeEditor">
        {{ t('dashboard.tabsSettings.cancelEditorButton') }}
      </button>
      <button
        class="button drawer-save-btn"
        type="button"
        :disabled="!canSaveTab"
        :title="saveValidationMessage || undefined"
        @click="handleSaveTab"
      >
        <PlusIcon v-if="!isEditing" :size="14" />
        <CheckIcon v-else :size="14" />
        <span>{{
          isEditing
            ? t('dashboard.tabsSettings.saveViewButton')
            : t('dashboard.tabsSettings.createViewButton')
        }}</span>
      </button>
    </footer>
  </aside>
</template>
