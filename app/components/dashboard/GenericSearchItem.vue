<template>
  <component
    :is="itemUrl ? 'a' : 'div'"
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed generic-search-card"
    :href="itemUrl || undefined"
    :target="itemUrl ? '_blank' : undefined"
    :rel="itemUrl ? 'noreferrer' : undefined"
  >
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row">
        <div class="dashboard-list-card__icon ml-2 mt-1">
          <component :size="22" :is="icon" />
        </div>
        <div class="dashboard-list-card__content">
          <div class="dashboard-list-card__text-stack">
            <p class="title is-6 mb-1 dashboard-list-card__title">
              {{ title }}
            </p>
            <p class="subtitle is-7 has-text-grey mb-2 dashboard-list-card__meta">
              <span class="dashboard-list-card__repo">{{ meta }}</span>
              <span v-if="numberLabel" class="tag is-small dashboard-list-card__number">
                {{ numberLabel }}
              </span>
              <span v-if="timeLabel" class="dashboard-list-card__separator">&middot;</span>
              <span v-if="timeLabel">{{ timeLabel }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import {
  BookMarkedIcon,
  CircleDotIcon,
  Code2Icon,
  GitCommitIcon,
  GitPullRequestIcon,
  TagIcon,
  TagsIcon,
  UserIcon,
} from '@lucide/vue';
import { computed } from 'vue';

import type { GitHubSearchEndpoint } from '#shared/types/custom-search';

interface GenericSearchItem {
  title?: string;
  name?: string;
  full_name?: string;
  login?: string;
  description?: string | null;
  number?: number;
  repository_url?: string;
  html_url?: string;
  updated_at?: string;
  pushed_at?: string;
  pull_request?: unknown;
  repository?: {
    full_name?: string;
    name?: string;
  };
  commit?: {
    message?: string;
    committer?: {
      date?: string;
    };
  };
  [key: string]: unknown;
}

const { item, endpoint } = defineProps<{
  item: GenericSearchItem;
  endpoint: GitHubSearchEndpoint;
}>();

const { locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

const title = computed(() => {
  const firstLine = item.commit?.message?.split('\n')[0]?.trim();
  return (
    item.title ??
    item.full_name ??
    item.name ??
    item.login ??
    firstLine ??
    item.description ??
    'GitHub result'
  );
});

const itemUrl = computed(() => {
  return typeof item.html_url === 'string' ? item.html_url : '';
});

const numberLabel = computed(() => {
  return typeof item.number === 'number' ? `#${item.number}` : '';
});

const meta = computed(() => {
  if (item.repository?.full_name) return item.repository.full_name;
  if (item.repository_url) return getRepoName(item.repository_url);
  if (item.full_name) return item.full_name;
  if (item.login) return `@${item.login}`;
  return `/search/${endpoint}`;
});

const timeLabel = computed(() => {
  const timestamp = item.updated_at ?? item.pushed_at ?? item.commit?.committer?.date;
  return timestamp ? formatDurationFromNow(timestamp, locale.value, relativeTimeNow.value) : '';
});

const icon = computed(() => {
  if (endpoint === 'issues') {
    return item.pull_request ? GitPullRequestIcon : CircleDotIcon;
  }
  if (endpoint === 'repositories') return BookMarkedIcon;
  if (endpoint === 'code') return Code2Icon;
  if (endpoint === 'commits') return GitCommitIcon;
  if (endpoint === 'users') return UserIcon;
  if (endpoint === 'topics') return TagsIcon;
  return TagIcon;
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss">
.generic-search-card {
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: var(--gitpulse-accent);
  }
}

.dashboard-list-card__icon {
  color: var(--gitpulse-accent);
}
</style>
