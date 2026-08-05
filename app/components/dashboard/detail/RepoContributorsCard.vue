<script setup lang="ts">
import { Loader2Icon, UsersIcon } from '@lucide/vue';
import { computed, watch } from 'vue';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import {
  REPO_CONTRIBUTORS_PREVIEW_COUNT,
  useRepoContributors,
} from '~/composables/useRepoContributors';

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const { t } = useI18n();
const localePath = useLocalePath();

const { items, loading, error, fetchPage, reset } = useRepoContributors();

const contributorsRoute = computed(() =>
  localePath({
    path: '/dashboard/contributors',
    query: { repo: `${props.owner}/${props.repo}` },
  })
);

const previewItems = computed(() => items.value.slice(0, REPO_CONTRIBUTORS_PREVIEW_COUNT));

/** Show a trailing “+” only when the preview page is full (more likely exist). */
const countLabel = computed(() => {
  if (previewItems.value.length === 0) return '';
  const full = items.value.length >= REPO_CONTRIBUTORS_PREVIEW_COUNT;
  return full ? `${previewItems.value.length}+` : String(previewItems.value.length);
});

const displayName = (login: string | null, name: string | null) => {
  return login || name || t('repoDetail.contributorsUnknown');
};

const profileRoute = (login: string) =>
  localePath({
    path: '/dashboard/profile',
    query: { user: login },
  });

watch(
  () => [props.owner, props.repo] as const,
  ([owner, repo]) => {
    if (!owner || !repo) {
      reset();
      return;
    }
    void fetchPage(owner, repo, {
      page: 1,
      perPage: REPO_CONTRIBUTORS_PREVIEW_COUNT,
    });
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="loading || error || previewItems.length > 0" class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <UsersIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('repoDetail.contributors') }}</span>
      </div>
      <div v-if="countLabel" class="sidebar-card__header-actions">
        <span class="sidebar-badge">{{ countLabel }}</span>
      </div>
    </div>

    <div class="sidebar-card__content">
      <div v-if="loading && previewItems.length === 0" class="repo-contributors__loading">
        <Loader2Icon :size="16" class="spin-animation" aria-hidden="true" />
        <span class="is-sr-only">{{ t('repoDetail.loadingContributors') }}</span>
      </div>

      <p v-else-if="error && previewItems.length === 0" class="sidebar-card__error">
        {{ t('repoDetail.contributorsError') }}
      </p>

      <template v-else>
        <!--
          GitHub-style compact avatar row: slight negative margin overlap.
          Links open the user profile; the full list lives on the contributors page.
        -->
        <ul class="repo-contributors__avatars" role="list">
          <li
            v-for="item in previewItems"
            :key="String(item.id ?? item.login ?? item.name)"
            class="repo-contributors__avatar-item"
          >
            <NuxtLink
              v-if="item.login"
              :to="profileRoute(item.login)"
              class="repo-contributors__avatar-link"
              :title="displayName(item.login, item.name)"
              :aria-label="displayName(item.login, item.name)"
            >
              <GitHubAvatar
                :src="item.avatarUrl"
                :alt="displayName(item.login, item.name)"
                :size="32"
              />
            </NuxtLink>
            <span
              v-else
              class="repo-contributors__avatar-static"
              :title="displayName(item.login, item.name)"
            >
              <GitHubAvatar
                :src="item.avatarUrl"
                :alt="displayName(item.login, item.name)"
                :size="32"
              />
            </span>
          </li>
        </ul>

        <NuxtLink :to="contributorsRoute" class="sidebar-link">
          <UsersIcon :size="14" />
          <span>{{ t('contributorsPage.viewAll') }}</span>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Child component: must own full sidebar-card chrome. RepoDetail's scoped
// .sidebar-card rules do not apply across component boundaries.
@use '~/assets/scss/_variables' as *;

.sidebar-card {
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left,
.sidebar-card__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: $brand-primary;
}

.sidebar-card__title {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.sidebar-card__error {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 12px;
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--gitpulse-surface-hover);
  color: var(--gitpulse-text-muted);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sidebar-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.12s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }
}

.repo-contributors__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  color: var(--gitpulse-text-muted);
}

.repo-contributors__avatars {
  display: flex;
  flex-wrap: wrap;
  // Even gap only. Negative-margin facepile misaligns wrap rows: the first
  // item on row 2 is still :not(:first-child) and gets pulled left.
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.repo-contributors__avatar-item {
  line-height: 0;
}

.repo-contributors__avatar-link,
.repo-contributors__avatar-static {
  display: inline-flex;
  border-radius: 50%;
  line-height: 0;
}

.repo-contributors__avatar-link {
  transition: transform 0.12s ease;

  &:hover {
    transform: scale(1.06);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-link);
    outline-offset: 2px;
  }
}

.spin-animation {
  animation: repo-contributors-spin 1s linear infinite;
}

@keyframes repo-contributors-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
