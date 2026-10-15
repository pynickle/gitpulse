<script setup lang="ts">
import {
  ClockIcon,
  FilterIcon,
  HistoryIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from '@lucide/vue';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    loading: boolean;
    previousBaseline?: string | null;
    recoveredCount?: number;
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
  }
);

const emit = defineEmits<{
  reload: [];
  manage: [];
  recovery: [];
  'filter-click': [];
}>();

const searchQuery = defineModel<string>({ required: true });

const { t } = useI18n();
const previousRefreshLabel = computed(() =>
  props.previousBaseline
    ? t('releaseTimeline.previousRefresh', {
        time: new Date(props.previousBaseline).toLocaleString(),
      })
    : ''
);
const previousRefreshTime = computed(() => {
  if (!props.previousBaseline) return '';
  const date = new Date(props.previousBaseline);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  ).format(date);
});
</script>

<template>
  <div class="release-timeline-header">
    <div v-if="showTitle || previousBaseline" class="release-timeline-header__heading">
      <h2 v-if="showTitle" class="release-timeline-header__title">
        {{ t('releaseTimeline.title') }}
      </h2>
      <time
        v-if="previousBaseline"
        class="release-timeline-header__baseline"
        :datetime="previousBaseline"
        :title="previousRefreshLabel"
        :aria-label="previousRefreshLabel"
      >
        <ClockIcon :size="13" aria-hidden="true" />
        <span>{{ previousRefreshTime }}</span>
      </time>
    </div>
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
        class="button is-ghost is-small release-timeline-header__recovery"
        type="button"
        :aria-label="t('releaseTimeline.recoveredEntry', { count: recoveredCount })"
        :title="t('releaseTimeline.recoveredEntry', { count: recoveredCount })"
        @click="emit('recovery')"
      >
        <HistoryIcon :size="18" aria-hidden="true" /><span>{{ recoveredCount }}</span>
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

.release-timeline-header__heading {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  flex: 0 1 auto;
}

.release-timeline-header__title {
  margin-bottom: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.release-timeline-header__baseline {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  height: 1.5rem;
  padding: 0 0.55rem 0 0.45rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
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
