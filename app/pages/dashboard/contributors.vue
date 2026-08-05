<script setup lang="ts">
import { GitCommitHorizontalIcon, Loader2Icon, SearchIcon, UsersIcon } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { RepoContributorWeek } from '#shared/types/repos';
import ContributorCommitSparkline from '~/components/dashboard/contributors/ContributorCommitSparkline.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import { useRepoContributors } from '~/composables/useRepoContributors';
import { useRepoContributorStats } from '~/composables/useRepoContributorStats';

/** Unified card model so stats + list fallback share one matrix layout. */
interface ContributorCard {
  key: string;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
  commits: number;
  weeks: RepoContributorWeek[] | null;
}

const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();
const { openRepository } = useDashboardRepositoryNavigation();

const {
  items: statsItems,
  status: statsStatus,
  loading: statsLoading,
  error: statsError,
  fetchStats,
} = useRepoContributorStats();

const {
  items: listItems,
  loading: listLoading,
  error: listError,
  fetchPage: fetchList,
} = useRepoContributors();

const searchQuery = ref('');

const repoTarget = computed(() => {
  const rawValue = getQueryParamValue(route.query.repo);
  return rawValue ? parseGitHubRepoPath(rawValue) : null;
});

const repoFullName = computed(() =>
  repoTarget.value ? `${repoTarget.value.owner}/${repoTarget.value.repo}` : ''
);

const pageTitle = computed(() =>
  repoFullName.value ? t('contributorsPage.pageTitle', { repo: repoFullName.value }) : ''
);

usePageMeta(pageTitle);

const useStatsView = computed(() => statsStatus.value === 'ready' && statsItems.value.length > 0);

const isComputing = computed(() => statsLoading.value || statsStatus.value === 'computing');

const initialLoading = computed(() => {
  if (!repoTarget.value) return false;
  if (useStatsView.value) return false;
  if (listItems.value.length > 0) return false;
  return (statsLoading.value || listLoading.value) && !statsError.value && !listError.value;
});

const pageError = computed(() => {
  if (useStatsView.value) return null;
  if (listItems.value.length > 0) return null;
  return statsError.value || listError.value;
});

const gridLoadingSoft = computed(() => {
  return isComputing.value && !useStatsView.value && listItems.value.length > 0;
});

const compactFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      notation: 'compact',
      maximumFractionDigits: 1,
    })
);

const formatCount = (count: number) => {
  if (!Number.isFinite(count) || count <= 0) return '0';
  return compactFormatter.value.format(count);
};

const displayName = (card: ContributorCard) => {
  return card.login || card.name || t('contributorsPage.unknownAuthor');
};

const matchesSearch = (login: string | null, name?: string | null) => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return true;
  if (login?.toLowerCase().includes(query)) return true;
  if (name?.toLowerCase().includes(query)) return true;
  return false;
};

const matrixCards = computed<ContributorCard[]>(() => {
  if (useStatsView.value) {
    return statsItems.value
      .filter((item) => matchesSearch(item.login))
      .map((item) => ({
        key: String(item.id ?? item.login ?? item.total),
        login: item.login,
        name: null,
        avatarUrl: item.avatarUrl,
        commits: item.total,
        weeks: item.weeks,
      }));
  }

  return listItems.value
    .filter((item) => matchesSearch(item.login, item.name))
    .map((item) => ({
      key: String(item.id ?? item.login ?? item.name),
      login: item.login,
      name: item.name,
      avatarUrl: item.avatarUrl,
      commits: item.contributions,
      weeks: null,
    }));
});

const totalShown = computed(() => matrixCards.value.length);

const hasSourceData = computed(() => useStatsView.value || listItems.value.length > 0);

const profileRoute = (login: string) =>
  localePath({
    path: '/dashboard/profile',
    query: { user: login },
  });

const sparklineLabel = (card: ContributorCard) =>
  t('contributorsPage.sparklineLabel', {
    user: displayName(card),
    count: card.commits,
  });

const loadData = async () => {
  const target = repoTarget.value;
  if (!target) return;

  searchQuery.value = '';
  await Promise.all([
    fetchStats(target.owner, target.repo),
    fetchList(target.owner, target.repo, { page: 1, perPage: 100 }),
  ]);
};

const handleRetry = async () => {
  await loadData();
};

const handleBack = async () => {
  await goBackToPreviousPage();
};

const handleHome = async () => {
  await goToDashboardHome();
};

const handleRepoClick = async () => {
  const target = repoTarget.value;
  if (!target) return;
  await openRepository(target.owner, target.repo);
};

onMounted(() => {
  void loadData();
});

watch(repoFullName, () => {
  void loadData();
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('contributorsPage.loadingTitle')"
    :loading-subtitle="t('contributorsPage.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="contributors-page-content"
    @back="handleBack"
    @home="handleHome"
  >
    <div class="contributors-page">
      <div class="contributors-page__header">
        <div class="contributors-page__heading">
          <h1 class="title is-5 mb-0 is-flex is-align-items-center">
            <UsersIcon :size="18" class="mr-2" aria-hidden="true" />
            {{ t('contributorsPage.heading') }}
          </h1>

          <button
            v-if="repoTarget"
            class="contributors-page__repo button is-ghost is-small"
            :title="t('contributorsPage.openRepo')"
            @click="handleRepoClick"
          >
            <GitHubIcon :size="15" />
            <span>{{ repoFullName }}</span>
          </button>

          <span
            v-if="repoTarget && !initialLoading && !pageError && totalShown > 0"
            class="contributors-page__count"
          >
            {{ t('contributorsPage.count', { count: totalShown }) }}
          </span>
        </div>

        <div v-if="repoTarget" class="contributors-page__search">
          <SearchIcon :size="14" class="contributors-page__search-icon" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="search"
            class="contributors-page__search-input"
            :placeholder="t('contributorsPage.searchPlaceholder')"
            :disabled="initialLoading"
            :aria-label="t('contributorsPage.searchPlaceholder')"
          />
        </div>
      </div>

      <div v-if="gridLoadingSoft" class="contributors-page__computing" role="status">
        <Loader2Icon :size="14" class="spin-animation" aria-hidden="true" />
        <span>{{ t('contributorsPage.computing') }}</span>
      </div>

      <div class="contributors-page__body">
        <div v-if="!repoTarget" class="contributors-page__empty">
          <p>{{ t('contributorsPage.noRepo') }}</p>
        </div>

        <div v-else-if="pageError" class="notification is-danger is-light contributors-page__error">
          <p class="mb-2">{{ t('contributorsPage.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetry">
            {{ t('contributorsPage.retry') }}
          </button>
        </div>

        <div
          v-else-if="
            !initialLoading && !isComputing && statsStatus === 'empty' && listItems.length === 0
          "
          class="contributors-page__empty"
        >
          <p>{{ t('contributorsPage.empty') }}</p>
        </div>

        <div
          v-else-if="!initialLoading && hasSourceData && matrixCards.length === 0"
          class="contributors-page__empty"
        >
          <p>{{ t('contributorsPage.emptyFiltered') }}</p>
        </div>

        <div
          v-else-if="matrixCards.length > 0"
          class="contributors-page__grid"
          :class="{ 'contributors-page__grid--loading': gridLoadingSoft }"
        >
          <article v-for="card in matrixCards" :key="card.key" class="contributors-page__card card">
            <div class="contributors-page__card-top">
              <NuxtLink
                v-if="card.login"
                :to="profileRoute(card.login)"
                class="contributors-page__avatar-link"
              >
                <GitHubAvatar
                  :src="card.avatarUrl"
                  :alt="displayName(card)"
                  :size="48"
                  class="contributors-page__avatar"
                />
              </NuxtLink>
              <GitHubAvatar
                v-else
                :src="card.avatarUrl"
                :alt="displayName(card)"
                :size="48"
                class="contributors-page__avatar"
              />

              <div class="contributors-page__card-identity">
                <NuxtLink
                  v-if="card.login"
                  :to="profileRoute(card.login)"
                  class="contributors-page__login-link"
                  :title="displayName(card)"
                >
                  {{ displayName(card) }}
                </NuxtLink>
                <span v-else class="contributors-page__login" :title="displayName(card)">
                  {{ displayName(card) }}
                </span>

                <span class="contributors-page__commits">
                  <GitCommitHorizontalIcon :size="13" aria-hidden="true" />
                  <span>
                    {{ t('contributorsPage.commits', { count: formatCount(card.commits) }) }}
                  </span>
                </span>
              </div>
            </div>

            <div v-if="card.weeks" class="contributors-page__card-chart">
              <ContributorCommitSparkline
                :weeks="card.weeks"
                :height="36"
                :label="sparklineLabel(card)"
              />
            </div>
            <div v-else class="contributors-page__card-chart contributors-page__card-chart--empty">
              <span class="contributors-page__chart-placeholder">
                {{
                  gridLoadingSoft
                    ? t('contributorsPage.computing')
                    : t('contributorsPage.commits', { count: formatCount(card.commits) })
                }}
              </span>
            </div>
          </article>
        </div>

        <div
          v-else-if="isComputing"
          class="contributors-page__empty contributors-page__empty--computing"
          role="status"
        >
          <Loader2Icon :size="20" class="spin-animation" aria-hidden="true" />
          <p>{{ t('contributorsPage.computing') }}</p>
        </div>
      </div>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.contributors-page {
  // Fill the overlay content width (same idea as starred grid).
  width: 100%;
  max-width: 76rem;
  margin: 0 auto;
}

.contributors-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.contributors-page__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}

.contributors-page__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-text-strong);
  }
}

.contributors-page__count {
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
}

.contributors-page__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 14rem;
  max-width: 22rem;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.contributors-page__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.contributors-page__search-input {
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

  &:disabled {
    opacity: 0.6;
  }
}

.contributors-page__computing {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
}

.contributors-page__error {
  margin-bottom: 1rem;
}

.contributors-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.contributors-page__empty--computing {
  flex-direction: column;
  gap: 0.75rem;
}

.contributors-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  gap: 0.85rem;
  align-items: stretch;
}

.contributors-page__grid--loading {
  opacity: 0.72;
}

.contributors-page__card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  height: 100%;
  padding: 0.9rem 0.95rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 10px;
  background: var(--gitpulse-surface);
  box-shadow: none;
}

.contributors-page__card-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.contributors-page__avatar-link {
  flex-shrink: 0;
  border-radius: 50%;
  line-height: 0;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-link);
    outline-offset: 2px;
  }
}

.contributors-page__avatar {
  flex-shrink: 0;
}

.contributors-page__card-identity {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.contributors-page__login,
.contributors-page__login-link {
  min-width: 0;
  overflow: hidden;
  color: var(--gitpulse-text-strong);
  font-weight: 600;
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contributors-page__login-link {
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-link);
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-link);
    outline-offset: 2px;
    border-radius: 2px;
  }
}

.contributors-page__commits {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  white-space: nowrap;
}

.contributors-page__card-chart {
  margin-top: auto;
  min-height: 2.25rem;
}

.contributors-page__card-chart--empty {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);
}

.contributors-page__chart-placeholder {
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  line-height: 1.3;
}
</style>
