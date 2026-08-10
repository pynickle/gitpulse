<template>
  <div
    class="card dashboard-list-card dashboard-list-card--repo dashboard-list-card--compact repo-item"
  >
    <div class="card-content p-3 pl-4">
      <div class="dashboard-list-card__content">
        <div class="is-flex is-align-items-flex-start mb-2">
          <div class="dashboard-list-card__text-stack">
            <p class="title is-6 mb-1 dashboard-list-card__title">{{ repo.name }}</p>
            <p
              v-if="repo.description"
              class="subtitle is-7 has-text-grey mb-0 dashboard-list-card__description"
            >
              {{ repo.description }}
            </p>
          </div>
          <div v-if="repo.language" class="repo-language ml-3">
            <span class="repo-language-dot" :style="{ backgroundColor: languageColor }" />
            <span class="repo-language-text">{{ repo.language }}</span>
          </div>
        </div>

        <div class="is-flex is-align-items-center dashboard-list-card__meta">
          <div class="is-flex is-align-items-center mr-4">
            <StarIcon :size="14" class="mr-1 has-text-grey" />
            <span class="is-size-7 has-text-grey" :title="fullCountTitle(repo.stargazers_count)">
              {{ compactCount(repo.stargazers_count) }}
            </span>
          </div>
          <div class="is-flex is-align-items-center mr-4">
            <EyeIcon :size="14" class="mr-1 has-text-grey" />
            <span class="is-size-7 has-text-grey" :title="fullCountTitle(repo.watchers_count)">
              {{ compactCount(repo.watchers_count) }}
            </span>
          </div>
          <div class="is-flex is-align-items-center mr-4">
            <GitForkIcon :size="14" class="mr-1 has-text-grey" />
            <span class="is-size-7 has-text-grey" :title="fullCountTitle(repo.forks_count)">
              {{ compactCount(repo.forks_count) }}
            </span>
          </div>
          <div v-if="repo.private" class="is-flex is-align-items-center repo-private-badge">
            <LockIcon :size="12" class="mr-1" />
            <span class="is-size-7">{{ t('repoItem.private') }}</span>
          </div>
        </div>
      </div>
    </div>
    <a
      v-if="opensGitHubLinks && preferredHref"
      class="repo-item__link"
      :href="preferredHref"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="openRepositoryLabel"
      :title="openRepositoryLabel"
    />
    <NuxtLinkLocale
      v-else
      class="repo-item__link"
      :to="detailPath"
      :aria-label="openRepositoryLabel"
      :title="openRepositoryLabel"
    />
  </div>
</template>

<script setup lang="ts">
import { EyeIcon, GitForkIcon, LockIcon, StarIcon } from '@lucide/vue';
import { computed } from 'vue';

import { createDashboardRepositoryTarget } from '~/utils/dashboardUrlNavigationUtils';

interface RepositoryListItem {
  name: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  private?: boolean;
  owner?: {
    login?: string;
  };
}

const props = defineProps<{
  repo: RepositoryListItem;
}>();

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { opensGitHubLinks, getPreferredTargetHref } = useGitHubLinkRouting();

const compactCount = (value?: number | null) => {
  const count = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return formatCompactNumber(count, locale.value);
};

const fullCountTitle = (value?: number | null) => {
  const count = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return count.toLocaleString(locale.value);
};

const repoOwner = computed(() => props.repo.owner?.login ?? '');

const openRepositoryLabel = computed(() => {
  return t('repoItem.openRepository', { repo: `${repoOwner.value}/${props.repo.name}` });
});

const repoTarget = computed(() => {
  return repoOwner.value ? createDashboardRepositoryTarget(repoOwner.value, props.repo.name) : null;
});

const detailPath = computed(() => {
  return localePath({
    path: '/dashboard',
    query: {
      tab: 'repos',
      repo: `${repoOwner.value}/${props.repo.name}`,
    },
  });
});

const preferredHref = computed(() => {
  const target = repoTarget.value;
  return target ? getPreferredTargetHref(target, detailPath.value) : '';
});

const languageColor = computed(() => {
  return getLanguageColor(props.repo.language);
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/card.scss';

.repo-item {
  position: relative;
}

.repo-item__link {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  color: inherit;
  text-decoration: none;
}

.repo-item__link:focus-visible {
  outline: 2px solid var(--gitpulse-link);
  outline-offset: 2px;
}

.repo-language {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.repo-language-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}

.repo-language-text {
  font-size: 0.8rem;
  font-weight: normal;
  color: var(--gitpulse-text-muted, #6b7280);
}

.repo-private-badge {
  color: var(--gitpulse-text-muted, #6b7280);
  background-color: rgba(128, 128, 128, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
}
</style>
