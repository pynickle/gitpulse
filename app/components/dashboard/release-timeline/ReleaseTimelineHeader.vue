<script setup lang="ts">
import {
  FileTextIcon,
  FilterIcon,
  HistoryIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from '@lucide/vue';

import ReleaseTimelineBaselineChip from '~/components/dashboard/release-timeline/ReleaseTimelineBaselineChip.vue';

withDefaults(
  defineProps<{
    loading: boolean;
    previousBaseline?: string | null;
    recoveredCount?: number;
    newCount?: number;
    showTitle?: boolean;
    showReload?: boolean;
    filterActive?: boolean;
  }>(),
  {
    showTitle: true,
    showReload: true,
    filterActive: false,
    previousBaseline: null,
    recoveredCount: 0,
    newCount: 0,
  }
);

const emit = defineEmits<{
  reload: [];
  manage: [];
  recovery: [];
  'filter-click': [];
}>();

const searchQuery = defineModel<string>({ required: true });
const includeReleaseNotes = defineModel<boolean>('includeReleaseNotes', { required: true });

const { t } = useI18n();
</script>

<template>
  <div
    class="release-timeline-header"
    :class="{ 'release-timeline-header--titleless': !showTitle }"
  >
    <div v-if="showTitle" class="release-timeline-header__heading">
      <h2 class="release-timeline-header__title">
        {{ t('releaseTimeline.title') }}
      </h2>
      <ReleaseTimelineBaselineChip v-if="previousBaseline" :baseline="previousBaseline" />
      <span v-if="newCount > 0" class="release-timeline-header__new" aria-live="polite">
        {{ t('releaseTimeline.newBadge', { count: newCount }) }}
      </span>
    </div>
    <div class="release-timeline-header__toolbar">
      <div class="release-timeline-header__search-controls" role="search">
        <div
          class="release-timeline-header__search"
          :class="{ 'release-timeline-header__search--notes': includeReleaseNotes }"
        >
          <SearchIcon
            v-once
            :size="16"
            class="release-timeline-header__search-icon"
            aria-hidden="true"
          />
          <input
            v-model="searchQuery"
            type="search"
            class="release-timeline-header__search-input"
            :placeholder="t('releaseTimeline.searchPlaceholder')"
            :aria-label="t('releaseTimeline.searchPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          />
          <label
            class="release-timeline-header__notes"
            :class="{ 'release-timeline-header__notes--active': includeReleaseNotes }"
            :title="t('releaseTimeline.includeReleaseNotes')"
          >
            <input
              v-model="includeReleaseNotes"
              type="checkbox"
              class="release-timeline-header__notes-input"
              :aria-label="t('releaseTimeline.includeReleaseNotes')"
            />
            <FileTextIcon
              :size="13"
              class="release-timeline-header__notes-icon"
              aria-hidden="true"
            />
            <span class="release-timeline-header__notes-label">
              {{ t('releaseTimeline.includeReleaseNotesShort') }}
            </span>
          </label>
        </div>
      </div>
      <button
        class="button is-ghost is-small release-timeline-header__recovery"
        type="button"
        :aria-label="t('releaseTimeline.recoveredEntry', { count: recoveredCount })"
        :title="t('releaseTimeline.recoveredEntry', { count: recoveredCount })"
        @click="emit('recovery')"
      >
        <HistoryIcon :size="18" aria-hidden="true" />
        <span class="release-timeline-header__action-label">
          {{ t('releaseTimeline.recoveredShort') }}
        </span>
        <span>{{ recoveredCount }}</span>
      </button>
      <button
        v-if="showReload"
        class="button is-ghost is-small release-timeline-header__action"
        type="button"
        :aria-label="t('releaseTimeline.reload')"
        :title="t('releaseTimeline.reload')"
        @click="emit('reload')"
      >
        <RefreshCwIcon
          :size="18"
          class="release-timeline-header__reload-icon"
          :class="{ 'spin-animation': loading }"
          aria-hidden="true"
        />
        <span class="release-timeline-header__action-label">
          {{ t('releaseTimeline.reload') }}
        </span>
      </button>
      <button
        class="button is-ghost is-small release-timeline-header__action"
        type="button"
        :aria-label="t('releaseTimeline.manage')"
        :title="t('releaseTimeline.manage')"
        @click="emit('manage')"
      >
        <SlidersHorizontalIcon v-once :size="18" aria-hidden="true" />
        <span class="release-timeline-header__action-label">
          {{ t('releaseTimeline.manageShort') }}
        </span>
      </button>
      <button
        class="button is-ghost is-small release-timeline-header__action"
        :class="{ 'release-timeline-header__action--active': filterActive }"
        type="button"
        :aria-label="t('releaseTimeline.filter')"
        :title="filterActive ? t('releaseTimeline.filterActive') : t('releaseTimeline.filter')"
        :aria-pressed="filterActive"
        @click="emit('filter-click')"
      >
        <FilterIcon v-once :size="18" aria-hidden="true" />
        <span class="release-timeline-header__action-label">
          {{ t('releaseTimeline.filter') }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-timeline-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 1rem;
  min-width: 0;
}

.release-timeline-header__heading {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.625rem;
  min-width: 0;
  flex: 0 1 auto;
  max-width: 100%;
}

.release-timeline-header__new {
  flex-shrink: 0;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-accent);
  font-size: 0.75rem;
  font-weight: 650;
  white-space: nowrap;
}

.release-timeline-header__title {
  margin-bottom: 0;
  min-width: 0;
  overflow: hidden;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-timeline-header--titleless .release-timeline-header__toolbar {
  flex: 1 1 auto;
  margin-left: 0;
}

.release-timeline-header--titleless .release-timeline-header__search-controls {
  flex: 1 1 auto;
  width: auto;
}

.release-timeline-header__toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  min-width: 0;
}

.release-timeline-header__search-controls {
  display: flex;
  align-items: center;
  flex: 0 1 19rem;
  width: 19rem;
  max-width: 100%;
  min-width: 0;
}

.release-timeline-header__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 auto;
  min-width: 0;
  height: 2.25rem;
  padding: 0 0.375rem 0 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  transition: border-color 0.15s ease;
}

.release-timeline-header__search:focus-within {
  border-color: var(--gitpulse-link);
}

.release-timeline-header__search--notes {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 45%, var(--gitpulse-border));
}

.release-timeline-header__notes {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-left: auto;
  padding: 0.1875rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.6875rem;
  font-weight: 650;
  line-height: 1.15;
  cursor: pointer;
  user-select: none;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.release-timeline-header__notes:hover {
  border-color: var(--gitpulse-border-strong);
  color: var(--gitpulse-text);
}

.release-timeline-header__notes:has(.release-timeline-header__notes-input:focus-visible) {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 1px;
}

.release-timeline-header__notes--active,
.release-timeline-header__notes--active:hover {
  border-color: color-mix(in srgb, var(--gitpulse-accent) 55%, var(--gitpulse-border));
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-accent);
}

.release-timeline-header__notes-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.release-timeline-header__notes-icon {
  flex-shrink: 0;
}

.release-timeline-header__notes-label {
  pointer-events: none;
}

.release-timeline-header__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.release-timeline-header__search-input {
  flex: 1 1 0%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-strong);
  font-size: 0.875rem;
  outline: none;

  &::placeholder {
    color: var(--gitpulse-text-muted);
  }

  &::-webkit-search-cancel-button,
  &::-webkit-search-decoration {
    appearance: none;
  }
}

.release-timeline-header__recovery {
  gap: 0.35rem;
  flex-shrink: 0;
}

.release-timeline-header__action {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  color: var(--gitpulse-text-muted);
}

// Visible labels for the wrapped narrow-screen chip row; hidden on wide screens
// where the buttons stay icon-only.
.release-timeline-header__action-label {
  display: none;
}

.release-timeline-header__action:hover,
.release-timeline-header__action:focus-visible {
  color: var(--gitpulse-link);
  background: var(--gitpulse-info-soft);
}

.release-timeline-header__action--active {
  border-color: var(--gitpulse-accent);
  color: var(--gitpulse-accent);
}

.release-timeline-header__action--active:hover,
.release-timeline-header__action--active:focus-visible {
  color: var(--gitpulse-accent);
  background: var(--gitpulse-info-soft);
}

.release-timeline-header__action:hover .release-timeline-header__reload-icon:not(.spin-animation),
.release-timeline-header__action:focus-visible
  .release-timeline-header__reload-icon:not(.spin-animation) {
  transform: rotate(15deg);
}

.release-timeline-header__reload-icon {
  transition: transform 0.2s ease;
}

.spin-animation {
  animation: release-timeline-header-spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes release-timeline-header-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 700px) {
  .release-timeline-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .release-timeline-header__heading {
    flex-wrap: nowrap;
  }

  // Narrow screens split the toolbar into two rows: the search field owns a
  // full-width row and the action buttons wrap to a second row beneath it,
  // instead of all of them competing for (and crushing) one line.
  .release-timeline-header__toolbar,
  .release-timeline-header--titleless .release-timeline-header__toolbar {
    flex: 1 1 100%;
    flex-wrap: wrap;
    margin-left: 0;
    row-gap: 0.625rem;
  }

  .release-timeline-header__search-controls,
  .release-timeline-header--titleless .release-timeline-header__search-controls {
    flex: 1 1 100%;
    width: auto;
    max-width: 100%;
  }

  // Slightly taller targets for thumbs.
  .release-timeline-header__search {
    height: 2.5rem;
  }

  // The wrapped second row reads as one pill toolbar: labeled chips instead of
  // bare icons, so the row looks deliberate and each action keeps a visible name.
  .release-timeline-header__action-label {
    display: inline;
  }

  .release-timeline-header__recovery,
  .release-timeline-header__action {
    height: 2.5rem;
    width: auto;
    gap: 0.25rem;
    padding: 0 0.625rem;
    border-radius: 999px;
    font-weight: 600;
  }

  .release-timeline-header__recovery {
    border: 1px solid var(--gitpulse-border);
    background: var(--gitpulse-surface, var(--gitpulse-page-bg));
    color: var(--gitpulse-text-muted);
  }

  .release-timeline-header__recovery:hover,
  .release-timeline-header__recovery:focus-visible {
    color: var(--gitpulse-link);
    background: var(--gitpulse-info-soft);
  }
}
</style>
