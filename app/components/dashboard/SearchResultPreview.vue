<template>
  <div class="search-result-preview">
    <div v-if="loading || error || !items" class="srp-status">
      <span
        class="srp-pill"
        :class="{
          'is-loading': loading,
          'is-error': !!error,
        }"
      >
        <span v-if="loading" class="srp-pill__dot srp-pill__dot--pulse" />
        <span v-else-if="error" class="srp-pill__icon">!</span>
        <span v-if="loading">{{ loadingLabel }}</span>
        <span v-else-if="error">{{ error }}</span>
        <span v-else>{{ waitingLabel }}</span>
      </span>
    </div>

    <div v-if="!loading && !error && items && items.length > 0" class="srp-results">
      <article
        v-for="(item, i) in items"
        :key="item.id ?? i"
        class="srp-card"
        :class="{
          'srp-card--open': item.state === 'open',
          'srp-card--closed': item.state !== 'open',
        }"
      >
        <div class="srp-card__state">
          <component :is="getStateIcon(item)" :size="16" />
        </div>
        <div class="srp-card__body">
          <p class="srp-card__title">{{ getTitle(item) }}</p>
          <div class="srp-card__meta">
            <span v-if="getMeta(item)" class="srp-card__repo">{{ getMeta(item) }}</span>
            <span v-if="getNumberLabel(item)" class="srp-card__sep">&middot;</span>
            <span v-if="getNumberLabel(item)" class="srp-card__number">{{
              getNumberLabel(item)
            }}</span>
            <span v-if="getTimestamp(item)" class="srp-card__sep">&middot;</span>
            <span v-if="getTimestamp(item)" class="srp-card__time">{{
              formatTime(getTimestamp(item))
            }}</span>
          </div>
          <div v-if="item.labels && item.labels.length > 0" class="srp-card__tags">
            <span
              v-for="label in item.labels.slice(0, 3)"
              :key="label.id ?? label.name"
              class="srp-tag"
              :style="labelStyle(label)"
              >{{ label.name }}</span
            >
            <span v-if="item.labels.length > 3" class="srp-tag srp-tag--overflow"
              >+{{ item.labels.length - 3 }}</span
            >
          </div>
        </div>
      </article>
    </div>

    <div v-if="!loading && !error && items && items.length === 0" class="srp-empty">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BookMarkedIcon,
  CircleDotIcon,
  CircleMinusIcon,
  Code2Icon,
  GitCommitIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  TagIcon,
  TagsIcon,
  UserIcon,
} from '@lucide/vue';

import { formatDurationFromNow, getRepoName } from '#imports';
import getTextColorFromBackground from '~/utils/getTextColorFromBackground';

const { locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

interface SearchResultItem {
  id?: number;
  title?: string;
  name?: string;
  full_name?: string;
  login?: string;
  number?: number;
  state?: string;
  merged_at?: string | null;
  pull_request?: { merged_at?: string | null } | unknown;
  labels?: Array<{ id?: number; name: string; color?: string; description?: string }>;
  repository_url?: string;
  updated_at?: string;
  pushed_at?: string;
  html_url?: string;
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

const props = defineProps<{
  items: SearchResultItem[] | null | undefined;
  loading: boolean;
  error: string | null;
  loadingLabel: string;
  waitingLabel: string;
  emptyLabel: string;
}>();

const formatTime = (dateStr: string) => {
  return formatDurationFromNow(dateStr, locale.value, relativeTimeNow.value);
};

const getTitle = (item: SearchResultItem) => {
  const commitTitle = item.commit?.message?.split('\n')[0]?.trim();
  return item.title ?? item.full_name ?? item.name ?? item.login ?? commitTitle ?? 'GitHub result';
};

const getMeta = (item: SearchResultItem) => {
  if (item.repository?.full_name) return item.repository.full_name;
  if (item.repository_url) return getRepoName(item.repository_url);
  if (item.full_name) return item.full_name;
  if (item.login) return `@${item.login}`;
  return '';
};

const getNumberLabel = (item: SearchResultItem) => {
  return typeof item.number === 'number' ? `#${item.number}` : '';
};

const getTimestamp = (item: SearchResultItem) => {
  return item.updated_at ?? item.pushed_at ?? item.commit?.committer?.date ?? '';
};

const labelStyle = (label: { color?: string; name: string }) => {
  const bg = label.color || '6e7781';
  return {
    backgroundColor: `#${bg}`,
    color: `#${getTextColorFromBackground(bg)}`,
  };
};

const getPullRequestMergedAt = (item: SearchResultItem) => {
  if (item.merged_at) return item.merged_at;
  if (typeof item.pull_request !== 'object' || item.pull_request === null) return null;

  const mergedAt = (item.pull_request as { merged_at?: string | null }).merged_at;
  return typeof mergedAt === 'string' && mergedAt.length > 0 ? mergedAt : null;
};

const getStateIcon = (item: SearchResultItem) => {
  if (item.pull_request) {
    if (item.state === 'open') return GitPullRequestIcon;
    if (getPullRequestMergedAt(item)) return GitMergeIcon;
    return GitPullRequestClosedIcon;
  }
  if (item.state === 'open' || item.state === 'closed') {
    return item.state === 'open' ? CircleDotIcon : CircleMinusIcon;
  }
  if (item.commit) return GitCommitIcon;
  if (item.login) return UserIcon;
  if (item.full_name) return BookMarkedIcon;
  if (item.repository) return Code2Icon;
  if (item.name && item.description) return TagsIcon;
  return TagIcon;
};
</script>

<style scoped lang="scss">
.search-result-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
  flex: 1;
}

.srp-status {
  min-width: 0;
}

.srp-pill {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  padding: 0.2rem 0;
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--gitpulse-text-muted);
  overflow-wrap: anywhere;

  &.is-error {
    color: var(--gitpulse-danger);
  }
}

.srp-pill__dot,
.srp-pill__icon {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.srp-pill__dot--pulse {
  background: var(--gitpulse-accent);
  animation: srp-pulse 1s ease-in-out infinite;
}

.srp-pill__icon {
  background: var(--gitpulse-danger);
  color: #ffffff;
  font-size: 0.5rem;
  line-height: 0.55rem;
  text-align: center;
  font-weight: 800;
}

@keyframes srp-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.srp-results {
  display: grid;
  gap: 0.35rem;
  overflow-y: auto;
  padding-right: 0.25rem;
  flex: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--gitpulse-accent) 25%, transparent);
    border-radius: 4px;
  }
}

.srp-card {
  display: flex;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--gitpulse-accent) 20%, transparent);
  }
}

.srp-card__state {
  flex: 0 0 auto;
  padding-top: 0.15rem;
  line-height: 1;
  color: var(--gitpulse-text-muted);
}

.srp-card--open .srp-card__state {
  color: var(--gitpulse-success);
}

.srp-card--closed .srp-card__state {
  color: var(--gitpulse-text-muted);
}

.srp-card__body {
  min-width: 0;
  flex: 1;
}

.srp-card__title {
  margin: 0 0 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.srp-card__meta {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--bulma-text, var(--gitpulse-text));
  white-space: nowrap;
  overflow: hidden;
}

.srp-card__repo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 10rem;
}

.srp-card__sep {
  color: var(--gitpulse-text-subtle);
}

.srp-card__number {
  font-weight: 700;
  color: var(--gitpulse-accent);
  flex: 0 0 auto;
}

.srp-card__time {
  flex: 0 0 auto;
}

.srp-card__tags {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.25rem;
  overflow: hidden;
  mask-image: linear-gradient(to right, black 88%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 88%, transparent 100%);
}

.srp-tag {
  flex: 0 0 auto;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.45;
  white-space: nowrap;
}

.srp-tag--overflow {
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
}

.srp-empty {
  padding: 1.5rem 0.75rem;
  text-align: center;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  border: 1px dashed var(--gitpulse-border);
  border-radius: 6px;
}
</style>
