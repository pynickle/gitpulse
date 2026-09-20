<script setup lang="ts">
import { FilterIcon, RefreshCwIcon, SearchIcon, SlidersHorizontalIcon } from '@lucide/vue';

withDefaults(
  defineProps<{
    loading: boolean;
    showTitle?: boolean;
    showReload?: boolean;
    filterActive?: boolean;
  }>(),
  {
    showTitle: true,
    showReload: true,
    filterActive: false,
  }
);

const emit = defineEmits<{
  reload: [];
  manage: [];
  'filter-click': [];
}>();

const searchQuery = defineModel<string>({ required: true });

const { t } = useI18n();
</script>

<template>
  <div class="release-timeline-header">
    <h2 v-if="showTitle" class="release-timeline-header__title">
      {{ t('releaseTimeline.title') }}
    </h2>
    <div class="release-timeline-header__toolbar">
      <div class="release-timeline-header__search" role="search">
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
      </div>
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
      </button>
      <button
        class="button is-ghost is-small release-timeline-header__action"
        type="button"
        :aria-label="t('releaseTimeline.manage')"
        :title="t('releaseTimeline.manage')"
        @click="emit('manage')"
      >
        <SlidersHorizontalIcon v-once :size="18" aria-hidden="true" />
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

.release-timeline-header__title {
  margin-bottom: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.release-timeline-header__toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  min-width: 0;
}

.release-timeline-header__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 1 16.5rem;
  width: 16.5rem;
  max-width: 100%;
  min-width: 0;
  height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
}

.release-timeline-header__search:focus-within {
  border-color: var(--gitpulse-link);
}

.release-timeline-header__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.release-timeline-header__search-input {
  width: 100%;
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

  .release-timeline-header__toolbar {
    flex: 1 1 100%;
    margin-left: 0;
  }

  .release-timeline-header__search {
    flex: 1 1 auto;
    width: auto;
  }
}
</style>
