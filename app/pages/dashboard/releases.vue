<script setup lang="ts">
import { FlaskConicalIcon, LayoutGridIcon, PencilLineIcon, RocketIcon, TagIcon } from '@lucide/vue';
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { ReleaseListItem } from '#shared/types/releases';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import ReleaseListItemCard from '~/components/dashboard/releases/ReleaseListItemCard.vue';
import { serializeReleaseQuery } from '~/utils/dashboardUrlNavigationUtils';

type ReleaseTypeFilter = 'all' | 'stable' | 'prerelease' | 'draft';

interface ReleaseFilterOption {
  value: ReleaseTypeFilter;
  label: string;
  icon: Component;
  color: string;
}

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();
const { openRepository } = useDashboardRepositoryNavigation();

const { items, pagination, loading, error, fetchPage } = useRepoReleases();

/** Target repository from the `?repo=owner/name` query. */
const repoTarget = computed(() => {
  const rawValue = getQueryParamValue(route.query.repo);
  return rawValue ? parseGitHubRepoPath(rawValue) : null;
});

const repoFullName = computed(() =>
  repoTarget.value ? `${repoTarget.value.owner}/${repoTarget.value.repo}` : ''
);

const pageTitle = computed(() =>
  repoFullName.value ? t('releasesPage.pageTitle', { repo: repoFullName.value }) : ''
);

usePageMeta(pageTitle);

const initialLoading = computed(() => loading.value && items.value.length === 0 && !error.value);

const typeFilter = ref<ReleaseTypeFilter>('all');

const filterOptions = computed<ReleaseFilterOption[]>(() => [
  {
    value: 'all',
    label: t('dashboard.filters.options.all'),
    icon: LayoutGridIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'stable',
    label: t('releasesPage.filterStable'),
    icon: RocketIcon,
    color: 'var(--gitpulse-success)',
  },
  {
    value: 'prerelease',
    label: t('releaseDetail.prerelease'),
    icon: FlaskConicalIcon,
    color: 'var(--gitpulse-info)',
  },
  {
    value: 'draft',
    label: t('releaseDetail.draft'),
    icon: PencilLineIcon,
    color: 'var(--gitpulse-warning, #b58a00)',
  },
]);

const handleFilterKeydown = (event: KeyboardEvent) => {
  handleRovingTablistKeydown(event, {
    itemCount: filterOptions.value.length,
    activeIndex: filterOptions.value.findIndex((option) => option.value === typeFilter.value),
    onSelect: (index) => {
      const option = filterOptions.value[index];
      if (option) typeFilter.value = option.value;
    },
  });
};

const matchesTypeFilter = (release: ReleaseListItem) => {
  switch (typeFilter.value) {
    case 'stable':
      return !release.draft && !release.prerelease;
    case 'prerelease':
      return Boolean(release.prerelease) && !release.draft;
    case 'draft':
      return Boolean(release.draft);
    default:
      return true;
  }
};

/** Filters apply to the loaded page only — the GitHub list API has no type filter. */
const filteredItems = computed(() => items.value.filter(matchesTypeFilter));

/** The first published stable release on page 1 mirrors GitHub's "Latest" badge. */
const latestReleaseId = computed(() => {
  if (pagination.value.page !== 1) return null;
  const latest = items.value.find(
    (release) => !release.draft && !release.prerelease && release.published_at
  );
  return latest?.id ?? null;
});

/**
 * Featured hero only when the latest release is still in the filtered set
 * (e.g. hides when filtering to Pre Release / Draft).
 */
const latestRelease = computed(() => {
  const id = latestReleaseId.value;
  if (id == null) return null;
  return filteredItems.value.find((release) => release.id === id) ?? null;
});

const historyItems = computed(() => {
  const latestId = latestRelease.value?.id;
  if (latestId == null) return filteredItems.value;
  return filteredItems.value.filter((release) => release.id !== latestId);
});

const showHistoryHeading = computed(
  () => Boolean(latestRelease.value) && historyItems.value.length > 0
);

const releaseDetailRoute = (release: ReleaseListItem) => {
  const target = repoTarget.value;
  if (!target) return localePath('/dashboard');

  return localePath({
    path: '/dashboard',
    query: serializeReleaseQuery(target.owner, target.repo, { kind: 'id', id: release.id }),
  });
};

const fetchCurrentRepoPage = async (page: number) => {
  const target = repoTarget.value;
  if (!target) return;

  await fetchPage(target.owner, target.repo, page);
};

const handlePageChange = async (page: number) => {
  await fetchCurrentRepoPage(page);
};

const handleRetry = async () => {
  await fetchCurrentRepoPage(pagination.value.page);
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
  void fetchCurrentRepoPage(1);
});

watch(repoFullName, () => {
  typeFilter.value = 'all';
  void fetchCurrentRepoPage(1);
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('releasesPage.loadingTitle')"
    :loading-subtitle="t('releasesPage.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="releases-page-content"
    @back="handleBack"
    @home="handleHome"
  >
    <div class="releases-page">
      <div class="releases-page__header">
        <div class="releases-page__heading">
          <h1 class="title is-5 mb-0 is-flex is-align-items-center">
            <TagIcon :size="18" class="mr-2" aria-hidden="true" />
            {{ t('releasesPage.heading') }}
          </h1>

          <button
            v-if="repoTarget"
            class="releases-page__repo button is-ghost is-small"
            :title="t('releasesPage.openRepo')"
            @click="handleRepoClick"
          >
            <GitHubIcon :size="15" />
            <span>{{ repoFullName }}</span>
          </button>
        </div>

        <div
          v-if="repoTarget"
          class="releases-page__filters"
          role="tablist"
          :aria-label="t('releasesPage.filterLabel')"
          @keydown="handleFilterKeydown"
        >
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            role="tab"
            class="releases-page__filter"
            :class="{ 'is-active': typeFilter === option.value }"
            :aria-selected="typeFilter === option.value"
            :tabindex="typeFilter === option.value ? 0 : -1"
            :disabled="loading"
            :style="typeFilter === option.value ? { '--filter-color': option.color } : undefined"
            @click="typeFilter = option.value"
          >
            <component :is="option.icon" :size="13" class="releases-page__filter-icon" />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="releases-page__body">
        <div v-if="!repoTarget" class="releases-page__empty">
          <p>{{ t('releasesPage.noRepo') }}</p>
        </div>

        <div v-else-if="error" class="notification is-danger is-light releases-page__error">
          <p class="mb-2">{{ t('releasesPage.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetry">
            {{ t('releasesPage.retry') }}
          </button>
        </div>

        <div v-else-if="!loading && items.length === 0" class="releases-page__empty">
          <p>{{ t('releasesPage.empty') }}</p>
        </div>

        <div v-else-if="!loading && filteredItems.length === 0" class="releases-page__empty">
          <p>{{ t('releasesPage.emptyFiltered') }}</p>
        </div>

        <div
          v-else
          class="releases-page__list"
          :class="{ 'releases-page__list--loading': loading }"
        >
          <ReleaseListItemCard
            v-if="latestRelease"
            :release="latestRelease"
            :to="releaseDetailRoute(latestRelease)"
            :is-latest="true"
            variant="hero"
          />

          <div v-if="showHistoryHeading" class="releases-page__section-label">
            {{ t('releasesPage.previousReleases') }}
          </div>

          <ReleaseListItemCard
            v-for="release in historyItems"
            :key="release.id"
            :release="release"
            :to="releaseDetailRoute(release)"
            :is-latest="release.id === latestReleaseId"
            variant="row"
          />
        </div>
      </div>

      <div v-if="repoTarget && !error" class="releases-page__pagination">
        <DashboardPagination :pagination="pagination" @change="handlePageChange" />
      </div>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.releases-page {
  max-width: 56rem;
  margin: 0 auto;
}

.releases-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.releases-page__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}

.releases-page__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-text-strong);
  }
}

.releases-page__filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.releases-page__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover:not([disabled]) {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &[disabled] {
    opacity: 0.6;
    cursor: default;
  }

  &.is-active {
    border-color: var(--filter-color, var(--gitpulse-info));
    color: var(--filter-color, var(--gitpulse-info));
    background: color-mix(in srgb, var(--filter-color, var(--gitpulse-info)) 10%, transparent);
    font-weight: 600;
  }
}

.releases-page__filter-icon {
  flex-shrink: 0;
}

.releases-page__error {
  margin-bottom: 1rem;
}

.releases-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.releases-page__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.releases-page__list--loading {
  opacity: 0.6;
  pointer-events: none;
}

.releases-page__section-label {
  margin: 0.65rem 0 0.15rem;
  padding: 0 0.15rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Always visible: pinned to the bottom edge of the overlay's scroll area. */
.releases-page__pagination {
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
.card-content.releases-page-content {
  padding-bottom: 0;
}
</style>
