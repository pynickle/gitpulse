<script setup lang="ts">
import { StarIcon } from '@lucide/vue';
import { computed, onMounted, watch } from 'vue';

import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import RepoItem from '~/components/dashboard/RepoItem.vue';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const { user } = useUserSession();

const { items, pagination, loading, error, fetchPage } = useStarredRepos();

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

const handlePageChange = async (page: number) => {
  await fetchPage(page, requestedUser.value);
};

const handleRetry = async () => {
  await fetchPage(pagination.value.page, requestedUser.value);
};

const handleBack = async () => {
  await router.push(localePath('/dashboard'));
};

onMounted(() => {
  void fetchPage(1, requestedUser.value);
});

watch(requestedUser, () => {
  void fetchPage(1, requestedUser.value);
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('starred.loadingTitle')"
    :loading-subtitle="t('starred.loadingSubtitle')"
    :back-label="t('starred.backToDashboard')"
    home-label=""
    :show-home-button="false"
    content-class="starred-page-content"
    @back="handleBack"
  >
    <div class="starred-page">
      <div class="starred-page__header">
        <h1 class="title is-5 mb-0 is-flex is-align-items-center">
          <StarIcon :size="18" class="mr-2" aria-hidden="true" />
          {{ pageTitle }}
        </h1>
      </div>

      <div class="starred-page__body">
        <div v-if="error" class="notification is-danger is-light starred-page__error">
          <p class="mb-2">{{ t('starred.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetry">
            {{ t('starred.retry') }}
          </button>
        </div>

        <div v-else-if="!loading && items.length === 0" class="starred-page__empty">
          <p>{{ isOwnStars ? t('starred.empty') : t('starred.emptyUser') }}</p>
        </div>

        <div v-else class="starred-page__grid" :class="{ 'starred-page__grid--loading': loading }">
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
  margin-bottom: 1rem;
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

.starred-page__grid--loading {
  opacity: 0.6;
  pointer-events: none;
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
