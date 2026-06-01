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
            <span class="is-size-7 has-text-grey">{{ repo.stargazers_count }}</span>
          </div>
          <div class="is-flex is-align-items-center mr-4">
            <EyeIcon :size="14" class="mr-1 has-text-grey" />
            <span class="is-size-7 has-text-grey">{{ repo.watchers_count || 0 }}</span>
          </div>
          <div v-if="repo.private" class="is-flex is-align-items-center repo-private-badge">
            <LockIcon :size="12" class="mr-1" />
            <span class="is-size-7">Private</span>
          </div>
        </div>
      </div>
    </div>
    <NuxtLinkLocale
      class="repo-item__link"
      :to="detailPath"
      :aria-label="`Open repository ${repo.owner?.login}/${repo.name}`"
      :title="`Open repository ${repo.owner?.login}/${repo.name}`"
    />
  </div>
</template>

<script setup lang="ts">
import { EyeIcon, LockIcon, StarIcon } from 'lucide-vue-next';
import { computed } from 'vue';

interface RepositoryListItem {
  name: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  private?: boolean;
  owner?: {
    login?: string;
  };
}

const props = defineProps<{
  repo: RepositoryListItem;
}>();

const localePath = useLocalePath();

const detailPath = computed(() => {
  return localePath({
    path: '/dashboard',
    query: {
      tab: 'repos',
      repo: `${props.repo.owner?.login}/${props.repo.name}`,
    },
  });
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
