<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  RocketIcon,
  SearchIcon,
  StarIcon,
} from '@lucide/vue';
import { computed, onMounted, shallowRef } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import type { FollowedRepositoryView } from '#shared/types/user-settings';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import FollowedRepositoriesPanel from '~/components/dashboard/release-follows/FollowedRepositoriesPanel.vue';
import ReleaseFollowsRepoGrid from '~/components/dashboard/release-follows/ReleaseFollowsRepoGrid.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import type { StarredDirection, StarredSort } from '~/composables/useStarredRepos';

const { t } = useI18n();

const activeTab = shallowRef<'starred' | 'search'>('starred');
const isSearchTab = computed(() => activeTab.value === 'search');
const followedSheetOpen = shallowRef(false);

const {
  items: starredItems,
  pagination: starredPagination,
  sort,
  direction,
  loading: starredLoading,
  error: starredError,
  fetchPage: fetchStarredPage,
} = useStarredRepos();
const {
  query: searchQuery,
  items: searchItems,
  pagination: searchPagination,
  loading: searchLoading,
  error: searchError,
  hasQuery: searchHasQuery,
  fetchPage: fetchSearchPage,
} = useRepositorySearch();
const { followedRepositories, followedIds, addBlock, toggleFollow, removeFollow, clearFollows } =
  useReleaseFollows();
const { unavailableIds, fetchIdentities } = useFollowedRepositoryLookups();
const { settings, updateReleaseFollows } = useUserSettings();
const { entries: followedRepositoryMetadata, retry: retryFollowedRepositoryMetadata } =
  useFollowedRepositoryMetadata();
const followedView = computed(() => settings.value.releaseFollows.view);

const handleViewChange = (view: FollowedRepositoryView) => {
  if (view === followedView.value) return;
  void updateReleaseFollows({ view });
};

const sourceOptions = computed<SegmentedOption[]>(() => [
  {
    value: 'starred',
    label: t('releaseFollows.starredHeading'),
    icon: StarIcon,
    color: 'var(--gitpulse-accent)',
  },
  {
    value: 'search',
    label: t('releaseFollows.searchHeading'),
    icon: SearchIcon,
    color: 'var(--gitpulse-info)',
  },
]);

const sortOptions = computed<SegmentedOption[]>(() => [
  {
    value: 'created',
    label: t('starred.sort.starred'),
    icon: StarIcon,
    color: 'var(--gitpulse-accent)',
  },
  {
    value: 'updated',
    label: t('starred.sort.updated'),
    icon: ClockIcon,
    color: 'var(--gitpulse-info)',
  },
]);

const directionOptions = computed<SegmentedOption[]>(() => [
  {
    value: 'desc',
    label: t('starred.sort.desc'),
    icon: ArrowDownIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'asc',
    label: t('starred.sort.asc'),
    icon: ArrowUpIcon,
    color: 'var(--gitpulse-text-muted)',
  },
]);

const controlsDisabled = computed(() => starredLoading.value);
const gridItems = computed(() => (isSearchTab.value ? searchItems.value : starredItems.value));
const gridPagination = computed(() =>
  isSearchTab.value ? searchPagination.value : starredPagination.value
);
const gridLoading = computed(() =>
  isSearchTab.value ? searchLoading.value : starredLoading.value
);
const gridError = computed(() => (isSearchTab.value ? searchError.value : starredError.value));
const gridEmptyMessage = computed(() => {
  if (!isSearchTab.value) return t('starred.empty');
  return searchHasQuery.value ? t('releaseFollows.searchEmpty') : t('releaseFollows.searchPrompt');
});
const gridErrorMessage = computed(() => {
  return isSearchTab.value ? t('releaseFollows.searchError') : t('starred.error');
});
const showPagination = computed(() => {
  if (gridError.value) return false;
  return isSearchTab.value ? searchHasQuery.value : true;
});
const followedCountLabel = computed(() =>
  t('releaseFollows.followedCount', { count: followedRepositories.value.length })
);

const reloadStarredFirstPage = async () => {
  await fetchStarredPage({
    page: 1,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleTabChange = (value: string) => {
  activeTab.value = value === 'search' ? 'search' : 'starred';
};

const handlePageChange = async (page: number) => {
  if (isSearchTab.value) {
    await fetchSearchPage({ page });
    return;
  }

  await fetchStarredPage({
    page,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleSortChange = async (value: string) => {
  const nextSort: StarredSort = value === 'updated' ? 'updated' : 'created';
  if (nextSort === sort.value) return;
  sort.value = nextSort;
  await reloadStarredFirstPage();
};

const handleDirectionChange = async (value: string) => {
  const nextDirection: StarredDirection = value === 'asc' ? 'asc' : 'desc';
  if (nextDirection === direction.value) return;
  direction.value = nextDirection;
  await reloadStarredFirstPage();
};

const handleRetry = async () => {
  if (isSearchTab.value) {
    await fetchSearchPage({ page: searchPagination.value.page });
    return;
  }

  await fetchStarredPage({
    page: starredPagination.value.page,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleToggle = async (repo: FollowedRepository) => {
  await toggleFollow(repo);
};

onMounted(() => {
  void reloadStarredFirstPage();
  void fetchIdentities();
});
</script>

<template>
  <div class="release-follows-page">
    <div class="release-follows-page__main">
      <div class="release-follows-page__chrome">
        <FilterSegmentedControl
          class="release-follows-page__source"
          :options="sourceOptions"
          :model-value="activeTab"
          :aria-label="t('releaseFollows.tablistLabel')"
          @update:model-value="handleTabChange"
        />

        <template v-if="!isSearchTab">
          <FilterSegmentedControl
            class="release-follows-page__sort"
            :options="sortOptions"
            :model-value="sort"
            :disabled="controlsDisabled"
            :aria-label="t('starred.sortLabel')"
            @update:model-value="handleSortChange"
          />
          <FilterSegmentedControl
            class="release-follows-page__direction"
            :options="directionOptions"
            :model-value="direction"
            :disabled="controlsDisabled"
            :aria-label="t('starred.orderLabel')"
            @update:model-value="handleDirectionChange"
          />
        </template>

        <div v-else class="release-follows-page__search" role="search">
          <SearchIcon :size="14" class="release-follows-page__search-icon" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="search"
            class="release-follows-page__search-input"
            :placeholder="t('releaseFollows.searchPlaceholder')"
            :aria-label="t('releaseFollows.searchPlaceholder')"
            autocomplete="off"
          />
        </div>

        <p v-if="addBlock === 'valid-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.validCap') }}
        </p>
        <p v-else-if="addBlock === 'stored-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.storedCap') }}
        </p>
      </div>

      <ScrollArea
        class="release-follows-page__scroll"
        content-class="release-follows-page__scroll-flow"
      >
        <ReleaseFollowsRepoGrid
          :items="gridItems"
          :loading="gridLoading"
          :error="gridError"
          :followed-ids="followedIds"
          :add-block="addBlock"
          :empty-message="gridEmptyMessage"
          :error-message="gridErrorMessage"
          :retry-label="t('releaseFollows.retry')"
          @retry="handleRetry"
          @toggle="handleToggle"
        />
      </ScrollArea>

      <div
        class="release-follows-page__footer"
        :class="{ 'release-follows-page__footer--pager-hidden': !showPagination }"
      >
        <div v-if="showPagination" class="release-follows-page__pager">
          <DashboardPagination :pagination="gridPagination" @change="handlePageChange" />
        </div>
        <button
          class="release-follows-page__followed-trigger"
          type="button"
          :aria-expanded="followedSheetOpen"
          :aria-label="followedCountLabel"
          :title="followedCountLabel"
          @click="followedSheetOpen = true"
        >
          <RocketIcon :size="16" aria-hidden="true" />
          <span class="release-follows-page__followed-count">
            {{ followedRepositories.length }}
          </span>
        </button>
      </div>
    </div>

    <FollowedRepositoriesPanel
      v-model:open="followedSheetOpen"
      :items="followedRepositories"
      :unavailable-ids="unavailableIds"
      :view="followedView"
      :metadata="followedRepositoryMetadata"
      @remove="removeFollow"
      @clear="clearFollows"
      @update:view="handleViewChange"
      @retry="retryFollowedRepositoryMetadata"
    />
  </div>
</template>

<style scoped lang="scss">
/* The overlay hands this page one definite-height flex box, so the filter and
   pager bands are plain flex items and only the middle band scrolls. Nothing
   here depends on position: sticky inside a nested scroll area. */
.release-follows-page {
  display: flex;
  align-items: stretch;
  gap: 1.25rem;
  width: 100%;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 1.5rem;
}

.release-follows-page__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.release-follows-page__chrome {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  flex: 0 0 auto;
  padding: 0 0 1rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.release-follows-page__source {
  flex: 0 0 auto;
}

.release-follows-page__sort {
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
}

.release-follows-page__direction {
  flex: 0 0 auto;
}

.release-follows-page__cap {
  flex: 1 1 100%;
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: var(--gitpulse-radius-md, 6px);
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-text);
  font-size: 0.85rem;
}

.release-follows-page__search {
  display: flex;
  align-items: center;
  flex: 1 1 16rem;
  min-width: 0;
  max-width: 28rem;
  gap: 0.5rem;
  margin-left: auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.release-follows-page__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.release-follows-page__search-input {
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
}

.release-follows-page__scroll {
  flex: 1 1 auto;
  min-height: 0;
}

/* Keeps the grid's empty and loading states vertically centred inside the
   scrolling band. */
:deep(.release-follows-page__scroll-flow) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.release-follows-page__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  min-height: 3rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--gitpulse-border);
}

.release-follows-page__pager {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.release-follows-page__pager > * {
  flex: 1 1 auto;
  min-width: 0;
}

/* The wide layout keeps the followed list in the side panel, so its trigger
   only exists where that panel is replaced by the sheet. */
.release-follows-page__followed-trigger {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  /* Keeps the trigger on the trailing edge when no pager shares the row. */
  margin-left: auto;
  height: 2.25rem;
  padding: 0 0.7rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-accent);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-accent);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.release-follows-page__followed-count {
  color: var(--gitpulse-text-strong);
  font-size: 0.85rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 860px) {
  .release-follows-page {
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  .release-follows-page__chrome {
    gap: 0.5rem;
    padding: 0.7rem 0.9rem;
  }

  /* Source tabs own the first row so both halves stay equal, then the sort and
     order controls share the second row. The order control keeps its labels
     only for assistive tech, which holds the pair on one row at any width. */
  .release-follows-page__source {
    flex: 1 1 100%;
  }

  .release-follows-page__sort {
    flex: 1 1 auto;
    margin-left: 0;
  }

  .release-follows-page__sort :deep(.segmented-control-option) {
    min-width: 0;
  }

  .release-follows-page__sort :deep(.segmented-control-option-label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .release-follows-page__direction :deep(.segmented-control-option) {
    padding: 0.375rem 0.7rem;
  }

  .release-follows-page__direction :deep(.segmented-control-option-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
  }

  .release-follows-page__search {
    flex: 1 1 100%;
    max-width: none;
    margin-left: 0;
  }

  .release-follows-page__footer {
    padding: 0.5rem 0.9rem;
  }

  .release-follows-page__followed-trigger {
    display: inline-flex;
  }
}

@media (min-width: 861px) {
  .release-follows-page__footer--pager-hidden {
    display: none;
  }
}
</style>
