<template>
  <div class="search-result-preview">
    <div class="srp-toolbar">
      <div class="srp-toolbar__status">
        <span
          class="srp-pill"
          :class="{
            'is-loading': loading,
            'is-empty': !loading && (!items || items.length === 0) && !error,
            'is-error': !!error,
          }"
        >
          <span v-if="loading" class="srp-pill__dot srp-pill__dot--pulse" />
          <span v-else-if="error" class="srp-pill__icon">!</span>
          <span v-else-if="items && items.length > 0" class="srp-pill__check" />
          <span v-if="loading">{{ loadingLabel }}</span>
          <span v-else-if="error">{{ error }}</span>
          <span v-else-if="totalCount != null">
            {{ countLabel }} &middot;
            <a :href="githubUrl" target="_blank" rel="noreferrer" class="srp-toolbar__gh-link">{{
              openInGithubLabel
            }}</a>
          </span>
          <span v-else>{{ waitingLabel }}</span>
        </span>
      </div>
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
          <p class="srp-card__title">{{ item.title }}</p>
          <div class="srp-card__meta">
            <span class="srp-card__repo">{{ getRepoShort(item.repository_url) }}</span>
            <span class="srp-card__sep">&middot;</span>
            <span class="srp-card__number">#{{ item.number }}</span>
            <span class="srp-card__sep">&middot;</span>
            <span class="srp-card__time">{{ formatTime(item.updated_at) }}</span>
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
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
} from 'lucide-vue-next';

import { formatDurationFromNow, getRepoName } from '#imports';
import getTextColorFromBackground from '~/utils/getTextColorFromBackground';

const { locale } = useI18n();

interface SearchResultItem {
  id?: number;
  title: string;
  number: number;
  state: string;
  merged_at?: string | null;
  pull_request?: unknown;
  labels?: Array<{ id?: number; name: string; color?: string; description?: string }>;
  repository_url: string;
  updated_at: string;
}

const props = defineProps<{
  items: SearchResultItem[] | null | undefined;
  totalCount: number | null | undefined;
  loading: boolean;
  error: string | null;
  githubUrl: string;
  loadingLabel: string;
  countLabel: string;
  openInGithubLabel: string;
  waitingLabel: string;
  emptyLabel: string;
}>();

const formatTime = (dateStr: string) => {
  return formatDurationFromNow(dateStr, locale.value);
};

const getRepoShort = (url: string) => {
  const name = getRepoName(url);
  const parts = name.split('/');
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : name;
};

const labelStyle = (label: { color?: string; name: string }) => {
  const bg = label.color || '6e7781';
  return {
    backgroundColor: `#${bg}`,
    color: `#${getTextColorFromBackground(bg)}`,
  };
};

const getStateIcon = (item: SearchResultItem) => {
  if (item.pull_request) {
    if (item.state === 'open') return GitPullRequestIcon;
    if (item.merged_at) return GitMergeIcon;
    return GitPullRequestClosedIcon;
  }
  if (item.state === 'open') return CircleDotIcon;
  return CircleMinusIcon;
};
</script>

<style scoped lang="scss">
.search-result-preview {
  display: grid;
  gap: 0.5rem;
}

.srp-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.srp-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0;
  font-size: 0.78rem;
  font-weight: 650;
  color: #92400e;

  &.is-error {
    color: #b42318;
  }
}

.srp-pill__dot,
.srp-pill__icon,
.srp-pill__check {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.srp-pill__dot--pulse {
  background: #4f46e5;
  animation: srp-pulse 1s ease-in-out infinite;
}

.srp-pill__icon {
  background: #b42318;
  color: white;
  font-size: 0.5rem;
  line-height: 0.55rem;
  text-align: center;
  font-weight: 800;
}

.srp-pill__check {
  background: #16a34a;
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

.srp-toolbar__gh-link {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.srp-results {
  display: grid;
  gap: 0.35rem;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 0.25rem;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(79, 70, 229, 0.25);
    border-radius: 4px;
  }
}

.srp-card {
  display: flex;
  gap: 0.55rem;
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
  color: var(--bulma-text-strong, #111827);
}

.srp-card__meta {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--bulma-text, #4a4a4a);
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
  color: var(--bulma-text-light, #9ca3af);
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
  color: var(--bulma-text-light, #94a3b8);
  font-size: 0.82rem;
  border: 1px dashed var(--gitpulse-border);
  border-radius: 6px;
}
</style>
