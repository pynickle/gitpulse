<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  LayoutGridIcon,
  SearchIcon,
  ShieldCheckIcon,
  UnlockIcon,
} from '@lucide/vue';
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { RepoBranchAssociatedPull, RepoBranchDetail } from '#shared/types/repos';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import { serializeDashboardDetailTarget } from '~/utils/dashboardUrlNavigationUtils';
import { getPullRequestStateIcon } from '~/utils/getPullRequestStateVisual';

type BranchTypeFilter = 'all' | 'default' | 'protected' | 'unprotected' | 'with-pr';

interface BranchFilterOption {
  value: BranchTypeFilter;
  label: string;
  icon: Component;
  color: string;
}

const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();
const { openRepository } = useDashboardRepositoryNavigation();
const relativeTimeNow = useRelativeTimeNow();

const { items, defaultBranch, loading, error, fetchBranches } = useRepoBranches();

/** Target repository from the `?repo=owner/name` query. */
const repoTarget = computed(() => {
  const rawValue = getQueryParamValue(route.query.repo);
  return rawValue ? parseGitHubRepoPath(rawValue) : null;
});

const repoFullName = computed(() =>
  repoTarget.value ? `${repoTarget.value.owner}/${repoTarget.value.repo}` : ''
);

const pageTitle = computed(() =>
  repoFullName.value ? t('branchesPage.pageTitle', { repo: repoFullName.value }) : ''
);

usePageMeta(pageTitle);

const initialLoading = computed(() => loading.value && items.value.length === 0 && !error.value);

const typeFilter = ref<BranchTypeFilter>('all');
const searchQuery = ref('');

const filterOptions = computed<BranchFilterOption[]>(() => [
  {
    value: 'all',
    label: t('dashboard.filters.options.all'),
    icon: LayoutGridIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'default',
    label: t('branchesPage.filterDefault'),
    icon: GitBranchIcon,
    color: 'var(--gitpulse-success)',
  },
  {
    value: 'protected',
    label: t('branchesPage.filterProtected'),
    icon: ShieldCheckIcon,
    color: 'var(--gitpulse-info)',
  },
  {
    value: 'unprotected',
    label: t('branchesPage.filterUnprotected'),
    icon: UnlockIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'with-pr',
    label: t('branchesPage.filterWithPr'),
    icon: GitPullRequestIcon,
    color: 'var(--gitpulse-accent, #8250df)',
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

const matchesTypeFilter = (branch: RepoBranchDetail) => {
  switch (typeFilter.value) {
    case 'default':
      return branch.isDefault || branch.name === defaultBranch.value;
    case 'protected':
      return branch.protected;
    case 'unprotected':
      return !branch.protected;
    case 'with-pr':
      return branch.associatedPulls.length > 0;
    default:
      return true;
  }
};

/** Search + type filters apply client-side — the details API returns the full branch set. */
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return items.value.filter((branch) => {
    if (!matchesTypeFilter(branch)) return false;
    if (!query) return true;

    if (branch.name.toLowerCase().includes(query)) return true;
    if (branch.lastCommit?.author.login?.toLowerCase().includes(query)) return true;
    if (branch.lastCommit?.author.name?.toLowerCase().includes(query)) return true;
    if (branch.lastCommit?.message?.toLowerCase().includes(query)) return true;
    if (branch.associatedPulls.some((pull) => pull.title.toLowerCase().includes(query))) {
      return true;
    }

    return false;
  });
});

const authorLabel = (branch: RepoBranchDetail) => {
  return (
    branch.lastCommit?.author.login ||
    branch.lastCommit?.author.name ||
    t('branchesPage.unknownAuthor')
  );
};

const updatedAtLabel = (branch: RepoBranchDetail) => {
  const committedAt = branch.lastCommit?.committedAt;
  if (!committedAt) return t('branchesPage.unknownTime');
  return formatDurationFromNow(committedAt, locale.value, relativeTimeNow.value);
};

const pullStateLabel = (pull: RepoBranchAssociatedPull) => {
  if (pull.merged) return t('branchesPage.prMerged');
  if (pull.state === 'open' && pull.draft) return t('branchesPage.prDraft');
  if (pull.state === 'open') return t('branchesPage.prOpen');
  return t('branchesPage.prClosed');
};

const pullStateIcon = (pull: RepoBranchAssociatedPull): Component => {
  return getPullRequestStateIcon(pull);
};

const pullDetailRoute = (pull: RepoBranchAssociatedPull) => {
  const target = repoTarget.value;
  if (!target) return localePath('/dashboard');

  return localePath({
    path: '/dashboard',
    query: {
      pr: serializeDashboardDetailTarget(target.owner, target.repo, pull.number),
    },
  });
};

const fetchCurrentRepo = async () => {
  const target = repoTarget.value;
  if (!target) return;

  await fetchBranches(target.owner, target.repo);
};

const handleRetry = async () => {
  await fetchCurrentRepo();
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

const handleBranchClick = async (branch: RepoBranchDetail) => {
  const target = repoTarget.value;
  if (!target) return;

  await openRepository(target.owner, target.repo, { branch: branch.name });
};

onMounted(() => {
  void fetchCurrentRepo();
});

watch(repoFullName, () => {
  typeFilter.value = 'all';
  searchQuery.value = '';
  void fetchCurrentRepo();
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('branchesPage.loadingTitle')"
    :loading-subtitle="t('branchesPage.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="branches-page-content"
    @back="handleBack"
    @home="handleHome"
  >
    <div class="branches-page">
      <div class="branches-page__header">
        <div class="branches-page__heading">
          <h1 class="title is-5 mb-0 is-flex is-align-items-center">
            <GitBranchIcon :size="18" class="mr-2" aria-hidden="true" />
            {{ t('branchesPage.heading') }}
          </h1>

          <button
            v-if="repoTarget"
            class="branches-page__repo button is-ghost is-small"
            :title="t('branchesPage.openRepo')"
            @click="handleRepoClick"
          >
            <GitHubIcon :size="15" />
            <span>{{ repoFullName }}</span>
          </button>

          <span
            v-if="repoTarget && !loading && !error && items.length > 0"
            class="branches-page__count"
          >
            {{ t('branchesPage.count', { count: items.length }) }}
          </span>
        </div>

        <div
          v-if="repoTarget"
          class="branches-page__filters"
          role="tablist"
          :aria-label="t('branchesPage.filterLabel')"
          @keydown="handleFilterKeydown"
        >
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            role="tab"
            class="branches-page__filter"
            :class="{ 'is-active': typeFilter === option.value }"
            :aria-selected="typeFilter === option.value"
            :tabindex="typeFilter === option.value ? 0 : -1"
            :disabled="loading"
            :style="typeFilter === option.value ? { '--filter-color': option.color } : undefined"
            @click="typeFilter = option.value"
          >
            <component :is="option.icon" :size="13" class="branches-page__filter-icon" />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div v-if="repoTarget" class="branches-page__search">
        <SearchIcon :size="14" class="branches-page__search-icon" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          class="branches-page__search-input"
          :placeholder="t('branchesPage.searchPlaceholder')"
          :disabled="loading"
          :aria-label="t('branchesPage.searchPlaceholder')"
        />
      </div>

      <div class="branches-page__body">
        <div v-if="!repoTarget" class="branches-page__empty">
          <p>{{ t('branchesPage.noRepo') }}</p>
        </div>

        <div v-else-if="error" class="notification is-danger is-light branches-page__error">
          <p class="mb-2">{{ t('branchesPage.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetry">
            {{ t('branchesPage.retry') }}
          </button>
        </div>

        <div v-else-if="!loading && items.length === 0" class="branches-page__empty">
          <p>{{ t('branchesPage.empty') }}</p>
        </div>

        <div v-else-if="!loading && filteredItems.length === 0" class="branches-page__empty">
          <p>{{ t('branchesPage.emptyFiltered') }}</p>
        </div>

        <div
          v-else
          class="branches-page__list"
          :class="{ 'branches-page__list--loading': loading }"
        >
          <article
            v-for="branch in filteredItems"
            :key="branch.name"
            class="branches-page__item card"
          >
            <button
              type="button"
              class="branches-page__item-main"
              :title="t('branchesPage.openBranch', { branch: branch.name })"
              @click="handleBranchClick(branch)"
            >
              <div class="branches-page__item-title-row">
                <GitBranchIcon :size="15" class="branches-page__item-icon" aria-hidden="true" />
                <span class="branches-page__item-title">{{ branch.name }}</span>

                <span v-if="branch.isDefault" class="tag is-success is-light">
                  {{ t('branchesPage.default') }}
                </span>
                <span v-if="branch.protected" class="tag is-info is-light">
                  {{ t('branchesPage.protected') }}
                </span>
              </div>

              <div class="branches-page__item-meta">
                <span class="branches-page__item-meta-entry">
                  <GitHubAvatar
                    :src="branch.lastCommit?.author.avatarUrl"
                    :alt="authorLabel(branch)"
                    :size="16"
                    class="branches-page__item-avatar"
                  />
                  <span>{{ authorLabel(branch) }}</span>
                </span>

                <span class="branches-page__item-meta-entry">
                  <span>{{ t('branchesPage.updated', { time: updatedAtLabel(branch) }) }}</span>
                </span>

                <span
                  v-if="branch.lastCommit"
                  class="branches-page__item-meta-entry"
                  :title="branch.lastCommit.sha"
                >
                  <code class="branches-page__item-sha">{{ branch.lastCommit.shortSha }}</code>
                </span>

                <span
                  v-if="branch.lastCommit?.message"
                  class="branches-page__item-message"
                  :title="branch.lastCommit.message"
                >
                  {{ branch.lastCommit.message }}
                </span>
              </div>
            </button>

            <div class="branches-page__item-side">
              <div
                v-if="!branch.isDefault && (branch.aheadBy !== null || branch.behindBy !== null)"
                class="branches-page__compare"
                :aria-label="
                  t('branchesPage.compareAria', {
                    ahead: branch.aheadBy ?? 0,
                    behind: branch.behindBy ?? 0,
                  })
                "
              >
                <span
                  v-if="branch.aheadBy !== null"
                  class="branches-page__compare-stat"
                  :class="{ 'is-zero': branch.aheadBy === 0 }"
                  :title="t('branchesPage.ahead', { count: branch.aheadBy })"
                >
                  <ArrowUpIcon :size="13" aria-hidden="true" />
                  <span>{{ branch.aheadBy }}</span>
                </span>
                <span
                  v-if="branch.behindBy !== null"
                  class="branches-page__compare-stat"
                  :class="{ 'is-zero': branch.behindBy === 0 }"
                  :title="t('branchesPage.behind', { count: branch.behindBy })"
                >
                  <ArrowDownIcon :size="13" aria-hidden="true" />
                  <span>{{ branch.behindBy }}</span>
                </span>
              </div>

              <div v-if="branch.associatedPulls.length > 0" class="branches-page__pulls">
                <NuxtLink
                  v-for="pull in branch.associatedPulls"
                  :key="pull.number"
                  :to="pullDetailRoute(pull)"
                  class="branches-page__pull"
                  :class="{
                    'is-open': pull.state === 'open' && !pull.draft && !pull.merged,
                    'is-draft': pull.draft && !pull.merged,
                    'is-merged': pull.merged,
                    'is-closed': pull.state === 'closed' && !pull.merged,
                  }"
                  :title="`${pullStateLabel(pull)} · #${pull.number} ${pull.title}`"
                  @click.stop
                >
                  <component :is="pullStateIcon(pull)" :size="13" aria-hidden="true" />
                  <span class="branches-page__pull-number">#{{ pull.number }}</span>
                  <span class="branches-page__pull-title">{{ pull.title }}</span>
                </NuxtLink>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.branches-page {
  max-width: 56rem;
  margin: 0 auto;
}

.branches-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}

.branches-page__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}

.branches-page__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-text-strong);
  }
}

.branches-page__count {
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
}

.branches-page__filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.branches-page__filter {
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

.branches-page__filter-icon {
  flex-shrink: 0;
}

.branches-page__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.branches-page__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.branches-page__search-input {
  width: 100%;
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

.branches-page__error {
  margin-bottom: 1rem;
}

.branches-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.branches-page__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.branches-page__list--loading {
  opacity: 0.6;
  pointer-events: none;
}

.branches-page__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
}

.branches-page__item-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  min-width: 0;
  flex: 1;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-link);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.branches-page__item-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.branches-page__item-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.branches-page__item-title {
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  font-family: var(--gitpulse-code-font-family);
  overflow-wrap: anywhere;
}

.branches-page__item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem 0.875rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
}

.branches-page__item-meta-entry {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.branches-page__item-avatar {
  border-radius: 50%;
}

.branches-page__item-sha {
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
  background: transparent;
  padding: 0;
}

.branches-page__item-message {
  min-width: 0;
  max-width: 28rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gitpulse-text-muted);
}

.branches-page__item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
  max-width: 16rem;

  @media (max-width: 640px) {
    align-items: flex-start;
    max-width: 100%;
    width: 100%;
  }
}

.branches-page__compare {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.branches-page__compare-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;

  &.is-zero {
    opacity: 0.55;
  }
}

.branches-page__pulls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  max-width: 100%;

  @media (max-width: 640px) {
    align-items: flex-start;
  }
}

.branches-page__pull {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  text-decoration: none;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-link);
    outline-offset: 1px;
  }

  &.is-open {
    color: var(--gitpulse-success);
    border-color: color-mix(in srgb, var(--gitpulse-success) 35%, var(--gitpulse-border));
  }

  &.is-draft {
    color: var(--gitpulse-text-muted);
  }

  &.is-merged {
    color: var(--gitpulse-accent, #8250df);
    border-color: color-mix(in srgb, var(--gitpulse-accent, #8250df) 35%, var(--gitpulse-border));
  }

  &.is-closed {
    color: var(--gitpulse-danger, #cf222e);
    border-color: color-mix(in srgb, var(--gitpulse-danger, #cf222e) 30%, var(--gitpulse-border));
  }
}

.branches-page__pull-number {
  font-weight: 600;
  flex-shrink: 0;
}

.branches-page__pull-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
