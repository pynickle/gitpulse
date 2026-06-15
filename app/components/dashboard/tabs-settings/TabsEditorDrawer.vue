<script setup lang="ts">
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Code2Icon,
  EyeIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  HashIcon,
  ListFilterIcon,
  MessageSquareIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
  TagsIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-vue-next';
import { GitHubIcon } from 'vue3-simple-icons';

import SearchResultPreview from '~/components/dashboard/SearchResultPreview.vue';
import TokenizedQuery from '~/components/dashboard/TokenizedQuery.vue';
import type { TabsSettingsPageState } from '~/composables/useTabsSettingsPage';

const props = defineProps<{
  model: TabsSettingsPageState;
}>();

const {
  t,
  sourceOptions,
  typeOptions,
  subtitleModeOptions,
  stateOptions,
  scopeOptions,
  sortOptions,
  orderOptions,
  visibilityOptions,
  archivedOptions,
  draftOptions,
  reviewOptions,
  filterIconMap,
  newTab,
  labelDraft,
  advancedFiltersOpen,
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
  activeSource,
  isPullRequestSearch,
  advancedFilterCount,
  labelSuggestions,
  searchQueryParts,
  githubPreviewUrl,
  humanPreview,
  autoSubtitle,
  handleSubtitleInput,
  setSubtitleMode,
  setActiveSource,
  setSearchType,
  setQueryState,
  toggleScope,
  addLabel,
  handleLabelEnter,
  removeLabel,
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
        <div class="source-selector" role="radiogroup" aria-label="API source">
          <button
            v-for="source in sourceOptions"
            :key="source.id"
            class="source-option"
            :class="{ 'is-active': source.id === activeSource }"
            type="button"
            role="radio"
            :aria-checked="source.id === activeSource"
            :disabled="source.disabled"
            @click="setActiveSource(source)"
          >
            <GitHubIcon v-if="source.id === 'github-search'" :size="16" />
            <Code2Icon v-else-if="source.id === 'github-graphql'" :size="16" />
            <TagsIcon v-else :size="16" />
            <span>{{ t(source.labelKey) }}</span>
            <small>{{ t(source.captionKey) }}</small>
          </button>
        </div>

        <div class="field">
          <label class="label">{{ t('dashboard.tabsSettings.viewNameLabel') }}</label>
          <div class="control has-icons-left">
            <input
              v-model="newTab.name"
              class="input"
              type="text"
              :placeholder="t('dashboard.tabsSettings.viewNamePlaceholder')"
            />
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
              :placeholder="autoSubtitle"
              @input="handleSubtitleInput"
            />
            <span class="icon is-small is-left"><ListFilterIcon :size="16" /></span>
          </div>
          <p v-if="newTab.subtitleMode === 'auto'" class="help subtitle-auto-hint">
            {{ t('dashboard.tabsSettings.autoSubtitleHint', { value: autoSubtitle }) }}
          </p>
          <p v-else-if="newTab.subtitleMode === 'none'" class="help subtitle-auto-hint">
            {{ t('dashboard.tabsSettings.noSubtitleHint') }}
          </p>
        </div>

        <section class="search-fields-panel">
          <div class="section-label-row mb-3">
            <div class="section-label">
              <span class="section-icon is-query" aria-hidden="true">
                <ListFilterIcon :size="13" />
              </span>
              <span>{{ t('dashboard.tabsSettings.searchParamsLabel') }}</span>
            </div>
            <span class="tag is-light is-small">{{
              t('dashboard.tabsSettings.searchParamsTag')
            }}</span>
          </div>

          <div class="field">
            <label class="label">{{ t('dashboard.tabsSettings.searchTextLabel') }}</label>
            <div class="control has-icons-left">
              <input
                v-model="newTab.query.text"
                class="input"
                type="text"
                :placeholder="t('dashboard.tabsSettings.searchTextPlaceholder')"
              />
              <span class="icon is-small is-left"><HashIcon :size="16" /></span>
            </div>
          </div>

          <div class="compact-row">
            <div class="toggle-section compact-toggle">
              <label class="label is-sr-only">{{
                t('dashboard.tabsSettings.resultTypeLabel')
              }}</label>
              <div class="segmented-row">
                <button
                  v-for="option in typeOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.type === option.value }"
                  :style="
                    newTab.query.type === option.value && filterIconMap[option.value]
                      ? {
                          '--seg-active-bg': filterIconMap[option.value]!.activeColor,
                          '--seg-active-border': filterIconMap[option.value]!.activeColor,
                        }
                      : {}
                  "
                  type="button"
                  @click="setSearchType(option.value)"
                >
                  <component
                    :is="filterIconMap[option.value]?.icon"
                    v-if="filterIconMap[option.value]"
                    :size="14"
                  />
                  <span>{{ t(option.labelKey) }}</span>
                </button>
              </div>
            </div>
            <div class="toggle-section compact-toggle">
              <label class="label is-sr-only">{{ t('dashboard.tabsSettings.stateLabel') }}</label>
              <div class="segmented-row">
                <button
                  v-for="option in stateOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.state === option.value }"
                  :style="
                    newTab.query.state === option.value && filterIconMap[option.value]
                      ? {
                          '--seg-active-bg': filterIconMap[option.value]!.activeColor,
                          '--seg-active-border': filterIconMap[option.value]!.activeColor,
                        }
                      : {}
                  "
                  type="button"
                  @click="setQueryState(option.value)"
                >
                  <component
                    :is="filterIconMap[option.value]?.icon"
                    v-if="filterIconMap[option.value]"
                    :size="14"
                  />
                  <span>{{ t(option.labelKey) }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Advanced filters (collapsible) -->
          <div class="advanced-section" :class="{ 'is-open': advancedFiltersOpen }">
            <button
              class="advanced-toggle"
              type="button"
              @click="advancedFiltersOpen = !advancedFiltersOpen"
            >
              <ChevronRightIcon
                :size="14"
                class="advanced-toggle__icon"
                :class="{ rotated: advancedFiltersOpen }"
              />
              <span>{{ t('dashboard.tabsSettings.advancedToggle') }}</span>
              <span class="tag is-light is-small advanced-count">{{ advancedFilterCount }}</span>
            </button>

            <Transition name="expand">
              <div v-if="advancedFiltersOpen" class="advanced-body">
                <div class="field-grid is-two">
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.repoLabel') }}</label>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.repo"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.repoPlaceholder')"
                      />
                      <span class="icon is-small is-left"><GitBranchIcon :size="16" /></span>
                    </div>
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.orgUserLabel') }}</label>
                    <div class="scope-grid">
                      <div class="control has-icons-left">
                        <input
                          v-model="newTab.query.org"
                          class="input"
                          type="text"
                          :placeholder="t('dashboard.tabsSettings.orgPlaceholder')"
                        />
                        <span class="icon is-small is-left"><UsersIcon :size="16" /></span>
                      </div>
                      <div class="control has-icons-left">
                        <input
                          v-model="newTab.query.user"
                          class="input"
                          type="text"
                          :placeholder="t('dashboard.tabsSettings.userPlaceholder')"
                        />
                        <span class="icon is-small is-left"><UserIcon :size="16" /></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="field-grid is-two">
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.authorLabel') }}</label>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.author"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.authorPlaceholder')"
                      />
                      <span class="icon is-small is-left"><UserIcon :size="16" /></span>
                    </div>
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.assigneeLabel') }}</label>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.assignee"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.assigneePlaceholder')"
                      />
                      <span class="icon is-small is-left"><CheckIcon :size="16" /></span>
                    </div>
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.mentionsLabel') }}</label>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.mentions"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.mentionsPlaceholder')"
                      />
                      <span class="icon is-small is-left"><MessageSquareIcon :size="16" /></span>
                    </div>
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.involvesLabel') }}</label>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.involves"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.involvesPlaceholder')"
                      />
                      <span class="icon is-small is-left"><EyeIcon :size="16" /></span>
                    </div>
                  </div>
                </div>

                <div class="field-grid is-three">
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.commenterLabel') }}</label>
                    <input
                      v-model="newTab.query.commenter"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.commenterPlaceholder')"
                    />
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.milestoneLabel') }}</label>
                    <input
                      v-model="newTab.query.milestone"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.milestonePlaceholder')"
                    />
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.perPageLabel') }}</label>
                    <input
                      v-model.number="newTab.query.perPage"
                      class="input"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                    />
                  </div>
                </div>

                <div class="toggle-section">
                  <label class="label">{{ t('dashboard.tabsSettings.searchInLabel') }}</label>
                  <div class="segmented-row is-wrap">
                    <button
                      v-for="option in scopeOptions"
                      :key="option.value"
                      class="segmented-button"
                      :class="{ 'is-active': newTab.query.scopes.includes(option.value) }"
                      type="button"
                      @click="toggleScope(option.value)"
                    >
                      {{ t(option.labelKey) }}
                    </button>
                  </div>
                </div>

                <div class="toggle-grid">
                  <div class="toggle-section">
                    <label class="label">{{ t('dashboard.tabsSettings.visibilityLabel') }}</label>
                    <div class="segmented-row is-wrap">
                      <button
                        v-for="option in visibilityOptions"
                        :key="option.value"
                        class="segmented-button"
                        :class="{ 'is-active': newTab.query.visibility === option.value }"
                        type="button"
                        @click="newTab.query.visibility = option.value"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    </div>
                  </div>
                  <div class="toggle-section">
                    <label class="label">{{ t('dashboard.tabsSettings.archivedLabel') }}</label>
                    <div class="segmented-row is-wrap">
                      <button
                        v-for="option in archivedOptions"
                        :key="option.value"
                        class="segmented-button"
                        :class="{ 'is-active': newTab.query.archived === option.value }"
                        type="button"
                        @click="newTab.query.archived = option.value"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="isPullRequestSearch" class="advanced-pr-band">
                  <div class="section-label-row mb-3">
                    <div class="section-label">
                      <GitPullRequestIcon :size="15" />
                      <span>{{ t('dashboard.tabsSettings.prQualifiersTitle') }}</span>
                    </div>
                  </div>
                  <div class="field-grid is-two">
                    <div class="field">
                      <label class="label">{{ t('dashboard.tabsSettings.baseBranchLabel') }}</label>
                      <input
                        v-model="newTab.query.base"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.baseBranchPlaceholder')"
                      />
                    </div>
                    <div class="field">
                      <label class="label">{{ t('dashboard.tabsSettings.headBranchLabel') }}</label>
                      <input
                        v-model="newTab.query.head"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.headBranchPlaceholder')"
                      />
                    </div>
                  </div>
                  <div class="toggle-grid">
                    <div class="toggle-section">
                      <label class="label">{{ t('dashboard.tabsSettings.draftLabel') }}</label>
                      <div class="segmented-row is-wrap">
                        <button
                          v-for="option in draftOptions"
                          :key="option.value"
                          class="segmented-button"
                          :class="{ 'is-active': newTab.query.draft === option.value }"
                          :style="
                            newTab.query.draft === option.value && filterIconMap[option.value]
                              ? {
                                  '--seg-active-bg': filterIconMap[option.value]!.activeColor,
                                  '--seg-active-border': filterIconMap[option.value]!.activeColor,
                                }
                              : {}
                          "
                          type="button"
                          @click="newTab.query.draft = option.value"
                        >
                          <component
                            :is="filterIconMap[option.value]?.icon"
                            v-if="filterIconMap[option.value]"
                            :size="14"
                          />
                          <span>{{ t(option.labelKey) }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="toggle-section">
                      <label class="label">{{ t('dashboard.tabsSettings.reviewLabel') }}</label>
                      <div class="segmented-row is-wrap">
                        <button
                          v-for="option in reviewOptions"
                          :key="option.value"
                          class="segmented-button"
                          :class="{ 'is-active': newTab.query.review === option.value }"
                          :style="
                            newTab.query.review === option.value && filterIconMap[option.value]
                              ? {
                                  '--seg-active-bg': filterIconMap[option.value]!.activeColor,
                                  '--seg-active-border': filterIconMap[option.value]!.activeColor,
                                }
                              : {}
                          "
                          type="button"
                          @click="newTab.query.review = option.value"
                        >
                          <component
                            :is="filterIconMap[option.value]?.icon"
                            v-if="filterIconMap[option.value]"
                            :size="14"
                          />
                          <span>{{ t(option.labelKey) }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <div class="field">
            <label class="label is-flex is-align-items-center label-heading">
              <TagsIcon :size="16" />
              <span>{{ t('dashboard.tabsSettings.labelsLabel') }}</span>
            </label>
            <div class="label-combobox">
              <span
                v-for="label in newTab.query.labels"
                :key="label"
                class="tag is-link is-light label-chip"
              >
                {{ label }}
                <button class="delete is-small" type="button" @click="removeLabel(label)"></button>
              </span>
              <input
                v-model="labelDraft"
                class="label-input"
                type="text"
                :placeholder="t('dashboard.tabsSettings.labelsPlaceholder')"
                @keyup.enter="handleLabelEnter"
              />
            </div>
            <div v-if="labelDraft.trim() || labelSuggestions.length > 0" class="label-suggestions">
              <button
                v-for="label in labelSuggestions"
                :key="label"
                class="button is-ghost is-small suggestion-row"
                type="button"
                @click="addLabel(label)"
              >
                {{ label }}
              </button>
              <button
                v-if="labelDraft.trim()"
                class="button is-ghost is-small suggestion-row"
                type="button"
                @click="addLabel(labelDraft)"
              >
                {{ t('dashboard.tabsSettings.addLabelSuggestion', { label: labelDraft.trim() }) }}
              </button>
            </div>
          </div>

          <div class="sort-row">
            <div class="toggle-section">
              <label class="label">{{ t('dashboard.tabsSettings.sortLabel') }}</label>
              <div class="segmented-row is-wrap">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.sort === option.value }"
                  type="button"
                  @click="newTab.query.sort = option.value"
                >
                  {{ t(option.labelKey) }}
                </button>
              </div>
            </div>
            <div class="toggle-section">
              <label class="label">{{ t('dashboard.tabsSettings.orderLabel') }}</label>
              <div class="segmented-row is-wrap">
                <button
                  v-for="option in orderOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.order === option.value }"
                  :style="
                    newTab.query.order === option.value && filterIconMap[option.value]
                      ? {
                          '--seg-active-bg': filterIconMap[option.value]!.activeColor,
                          '--seg-active-border': filterIconMap[option.value]!.activeColor,
                        }
                      : {}
                  "
                  type="button"
                  @click="newTab.query.order = option.value"
                >
                  <component
                    :is="filterIconMap[option.value]?.icon"
                    v-if="filterIconMap[option.value]"
                    :size="14"
                  />
                  <span>{{ t(option.labelKey) }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="drawer-preview">
        <div class="section-label drawer-preview__label">
          <span class="section-icon is-preview" aria-hidden="true">
            <RadarIcon :size="13" />
          </span>
          <span>{{ t('dashboard.tabsSettings.previewLabel') }}</span>
        </div>
        <strong class="preview-human">{{ humanPreview }}</strong>

        <div class="tokenized-query-box">
          <div class="tqb-header">
            <span class="tqb-label">{{ t('dashboard.tabsSettings.previewGithubQuery') }}</span>
            <a class="tqb-gh-link" :href="githubPreviewUrl" target="_blank" rel="noreferrer">
              <GitHubIcon :size="12" aria-hidden="true" />
              <span>{{ t('dashboard.tabsSettings.testInGithub') }}</span>
            </a>
          </div>
          <div class="tqb-body">
            <TokenizedQuery :parts="searchQueryParts" />
          </div>
        </div>

        <div class="preview-results">
          <div class="pr-header">
            <span class="pr-label">{{ t('dashboard.tabsSettings.previewResultsLabel') }}</span>
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
          <SearchResultPreview
            :items="previewResult?.items ?? null"
            :total-count="previewResult?.total_count ?? null"
            :loading="previewLoading"
            :error="previewError"
            :github-url="githubPreviewUrl"
            :loading-label="t('dashboard.tabsSettings.previewLoading')"
            :count-label="
              t('dashboard.tabsSettings.previewMatches', {
                count: previewResult?.total_count ?? 0,
              })
            "
            :open-in-github-label="t('dashboard.tabsSettings.testInGithub')"
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
        :disabled="!newTab.name.trim() || !selectedGroupExists"
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
