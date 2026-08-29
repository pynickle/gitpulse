<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, SearchIcon, StarIcon } from '@lucide/vue';
import { computed, onMounted, shallowRef } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import FollowedRepositoriesPanel from '~/components/dashboard/release-follows/FollowedRepositoriesPanel.vue';
import ReleaseFollowsRepoGrid from '~/components/dashboard/release-follows/ReleaseFollowsRepoGrid.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type { StarredDirection, StarredSort } from '~/composables/useStarredRepos';

const { t } = useI18n();

const emit = defineEmits<{
  return: [];
}>();

const activeTab = shallowRef<'starred' | 'search'>('starred');
const isSearchTab = computed(() => activeTab.value === 'search');

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
        <div class="release-follows-page__header">
          <FilterSegmentedControl
            :options="sourceOptions"
            :model-value="activeTab"
            :aria-label="t('releaseFollows.tablistLabel')"
            @update:model-value="handleTabChange"
          />

          <div v-if="!isSearchTab" class="release-follows-page__controls">
            <FilterSegmentedControl
              :options="sortOptions"
              :model-value="sort"
              :disabled="controlsDisabled"
              :aria-label="t('starred.sortLabel')"
              @update:model-value="handleSortChange"
            />
            <FilterSegmentedControl
              :options="directionOptions"
              :model-value="direction"
              :disabled="controlsDisabled"
              :aria-label="t('starred.orderLabel')"
              @update:model-value="handleDirectionChange"
            />
          </div>

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
        </div>

        <p v-if="addBlock === 'valid-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.validCap') }}
        </p>
        <p v-else-if="addBlock === 'stored-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.storedCap') }}
        </p>
      </div>

      <ReleaseFollowsRepoGrid
        :items="gridItems"
        :pagination="gridPagination"
        :loading="gridLoading"
        :error="gridError"
        :followed-ids="followedIds"
        :add-block="addBlock"
        :empty-message="gridEmptyMessage"
        :error-message="gridErrorMessage"
        :retry-label="t('releaseFollows.retry')"
        :show-pagination="showPagination"
        @retry="handleRetry"
        @page-change="handlePageChange"
        @toggle="handleToggle"
      />
    </div>

    <FollowedRepositoriesPanel
      :items="followedRepositories"
      :unavailable-ids="unavailableIds"
      @remove="removeFollow"
      @clear="clearFollows"
      @return="emit('return')"
    />
  </div>
</template>

<style scoped lang="scss">
.release-follows-page {
  display: flex;
  align-items: stretch;
  gap: 1.25rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
}

.release-follows-page__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.release-follows-page__chrome {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--gitpulse-surface);
  padding-bottom: 0.25rem;
}

.release-follows-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.release-follows-page__cap {
  margin: -0.25rem 0 1rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--gitpulse-radius-md, 6px);
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-text);
  font-size: 0.85rem;
}

.release-follows-page__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.release-follows-page__search {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 12rem;
  max-width: 28rem;
  gap: 0.5rem;
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
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-strong);
  font-size: 0.875rem;
  outline: none;

  &::placeholder {
    color: var(--gitpulse-text-muted);
  }
}

@media (max-width: 860px) {
  .release-follows-page {
    flex-direction: column;
    gap: 0;
  }

  .release-follows-page__search {
    max-width: none;
  }
}
</style>
