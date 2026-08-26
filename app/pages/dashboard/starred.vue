<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, Loader2Icon, StarIcon } from '@lucide/vue';
import { computed, onMounted, watch } from 'vue';

import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import RepoItem from '~/components/dashboard/RepoItem.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type { StarredDirection, StarredSort } from '~/composables/useStarredRepos';

const { t } = useI18n();
const route = useRoute();
const { user } = useUserSession();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();

const { items, pagination, sort, direction, loading, error, fetchPage } = useStarredRepos();

const sessionLogin = computed(() => user.value?.login ?? '');

/** Target user: `?user=` query, falling back to the signed-in user's own stars. */
const targetUser = computed(() => getQueryParamValue(route.query.user)?.trim() || null);

const isOwnStars = computed(() => !targetUser.value || targetUser.value === sessionLogin.value);

const pageTitle = computed(() =>
  isOwnStars.value
    ? t('starred.pageTitle')
    : t('starred.pageTitleUser', { login: targetUser.value })
);

usePageMeta(pageTitle);

const initialLoading = computed(() => loading.value && items.value.length === 0 && !error.value);

const requestedUser = computed(() => (isOwnStars.value ? null : targetUser.value));

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
    user: requestedUser.value,
    sort: sort.value,
    direction: direction.value,
  });
};

const handlePageChange = async (page: number) => {
  await fetchPage({
    page,
    user: requestedUser.value,
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
    user: requestedUser.value,
    sort: sort.value,
    direction: direction.value,
  });
};

const handleBack = async () => {
  await goBackToPreviousPage();
};

const handleHome = async () => {
  await goToDashboardHome();
};

onMounted(() => {
  void reloadFirstPage();
});

watch(requestedUser, () => {
  void reloadFirstPage();
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('starred.loadingTitle')"
    :loading-subtitle="t('starred.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="starred-page-content"
    @back="handleBack"
    @home="handleHome"
  >
    <div class="starred-page">
      <div class="starred-page__header">
        <h1 class="title is-5 mb-0 is-flex is-align-items-center">
          <StarIcon :size="18" class="mr-2" aria-hidden="true" />
          {{ pageTitle }}
        </h1>

        <div class="starred-page__controls">
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

      <div class="starred-page__body">
        <div v-if="error" class="notification is-danger is-light starred-page__error">
          <p class="mb-2">{{ t('starred.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetry">
            {{ t('starred.retry') }}
          </button>
        </div>

        <div v-else-if="loading" class="starred-page__empty" aria-busy="true">
          <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
        </div>

        <div v-else-if="items.length === 0" class="starred-page__empty">
          <p>{{ isOwnStars ? t('starred.empty') : t('starred.emptyUser') }}</p>
        </div>

        <div v-else class="starred-page__grid">
          <RepoItem v-for="repo in items" :key="repo.id" :repo="repo" class="starred-page__cell" />
        </div>
      </div>

      <div v-if="!error" class="starred-page__pagination">
        <DashboardPagination :pagination="pagination" @change="handlePageChange" />
      </div>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.starred-page {
  max-width: 76rem;
  margin: 0 auto;
}

.starred-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.starred-page__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.starred-page__error {
  margin-bottom: 1rem;
}

.starred-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.starred-page__grid {
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

/* Cards fill their grid cell so rows stay even regardless of description length. */
.starred-page__cell {
  height: 100%;
}

/* Pin the stats row to the card bottom so it doesn't drift with description length. */
.starred-page__cell :deep(.card-content) {
  height: 100%;
  display: flex;
}

.starred-page__cell :deep(.dashboard-list-card__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.starred-page__cell :deep(.dashboard-list-card__meta) {
  margin-top: auto;
}

/* The shared card style clamps descriptions to a single line; give grid cards
   room for up to three lines before truncating. */
.starred-page__cell :deep(.dashboard-list-card__description) {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

/* Always visible: pinned to the bottom edge of the overlay's scroll area. */
.starred-page__pagination {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  padding: 0.75rem 0;
  background: var(--gitpulse-surface);
  border-top: 1px solid var(--gitpulse-border);
}
</style>

<style lang="scss">
/* The overlay frame's card-content has a 2rem bottom padding; strip it so the
   sticky pagination bar sits flush with the bottom of the scrollport. */
.card-content.starred-page-content {
  padding-bottom: 0;
}
</style>
