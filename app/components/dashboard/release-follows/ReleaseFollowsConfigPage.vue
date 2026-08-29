<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, Loader2Icon, StarIcon } from '@lucide/vue';
import { computed, onMounted } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import FollowableRepoCard from '~/components/dashboard/release-follows/FollowableRepoCard.vue';
import FollowedRepositoriesPanel from '~/components/dashboard/release-follows/FollowedRepositoriesPanel.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type { StarredDirection, StarredSort } from '~/composables/useStarredRepos';

const { t } = useI18n();

const emit = defineEmits<{
  return: [];
}>();

const { items, pagination, sort, direction, loading, error, fetchPage } = useStarredRepos();
const { followedRepositories, followedIds, addBlock, toggleFollow, removeFollow, clearFollows } =
  useReleaseFollows();

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

const controlsDisabled = computed(() => loading.value);

const reloadFirstPage = async () => {
  await fetchPage({
    page: 1,
    sort: sort.value,
    direction: direction.value,
  });
};

const handlePageChange = async (page: number) => {
  await fetchPage({
    page,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleSortChange = async (value: string) => {
  const nextSort: StarredSort = value === 'updated' ? 'updated' : 'created';
  if (nextSort === sort.value) return;
  sort.value = nextSort;
  await reloadFirstPage();
};

const handleDirectionChange = async (value: string) => {
  const nextDirection: StarredDirection = value === 'asc' ? 'asc' : 'desc';
  if (nextDirection === direction.value) return;
  direction.value = nextDirection;
  await reloadFirstPage();
};

const handleRetry = async () => {
  await fetchPage({
    page: pagination.value.page,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleToggle = async (repo: FollowedRepository) => {
  await toggleFollow(repo);
};

onMounted(() => {
  void reloadFirstPage();
});
</script>

<template>
  <div class="release-follows-page">
    <div class="release-follows-page__main">
      <div class="release-follows-page__chrome">
        <div class="release-follows-page__header">
          <h1 class="title is-5 mb-0 is-flex is-align-items-center">
            <StarIcon :size="18" class="mr-2" aria-hidden="true" />
            {{ t('releaseFollows.starredHeading') }}
          </h1>

          <div class="release-follows-page__controls">
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
        </div>

        <p v-if="addBlock === 'valid-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.validCap') }}
        </p>
        <p v-else-if="addBlock === 'stored-cap'" class="release-follows-page__cap" role="status">
          {{ t('releaseFollows.storedCap') }}
        </p>
      </div>

      <div class="release-follows-page__body">
        <div v-if="error" class="notification is-danger is-light">
          <p class="mb-2">{{ t('starred.error') }}</p>
          <button class="button is-small is-danger is-outlined" type="button" @click="handleRetry">
            {{ t('starred.retry') }}
          </button>
        </div>

        <div v-else-if="loading" class="release-follows-page__empty" aria-busy="true">
          <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
        </div>

        <div v-else-if="items.length === 0" class="release-follows-page__empty">
          <p>{{ t('starred.empty') }}</p>
        </div>

        <div v-else class="release-follows-page__grid">
          <FollowableRepoCard
            v-for="repo in items"
            :key="repo.node_id || repo.id"
            class="release-follows-page__cell"
            :repo="repo"
            :followed="Boolean(repo.node_id && followedIds.has(repo.node_id))"
            :add-block="addBlock"
            @toggle="handleToggle"
          />
        </div>
      </div>

      <div v-if="!error" class="release-follows-page__pagination">
        <DashboardPagination :pagination="pagination" @change="handlePageChange" />
      </div>
    </div>

    <FollowedRepositoriesPanel
      :items="followedRepositories"
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

.release-follows-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.release-follows-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1rem;
  align-items: stretch;
}

.spin-animation {
  animation: spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.release-follows-page__cell {
  height: 100%;
}

.release-follows-page__cell :deep(.card-content) {
  height: 100%;
  display: flex;
}

.release-follows-page__cell :deep(.dashboard-list-card__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.release-follows-page__cell :deep(.dashboard-list-card__meta) {
  margin-top: auto;
}

.release-follows-page__cell :deep(.dashboard-list-card__description) {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.release-follows-page__pagination {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  padding: 0.75rem 0;
  background: var(--gitpulse-surface);
  border-top: 1px solid var(--gitpulse-border);
}

@media (max-width: 860px) {
  .release-follows-page {
    flex-direction: column;
    gap: 0;
  }

  .release-follows-page__pagination {
    position: sticky;
    bottom: 0;
  }
}
</style>
