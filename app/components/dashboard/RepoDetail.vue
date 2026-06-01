<script setup lang="ts">
import {
  ArchiveIcon,
  BookmarkIcon,
  EyeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
  GitForkIcon,
  GithubIcon,
  InfoIcon,
  Loader2Icon,
  StarIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';

import { formatDurationFromNow } from '#imports';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = defineProps<{
  repository: any;
  owner: string;
  repo: string;
}>();

const emit = defineEmits<{
  back: [];
  home: [];
}>();

const { locale } = useI18n();
const apiFetch = useGitPulseApiFetch();

const copy = computed(() => {
  if (locale.value.startsWith('zh')) {
    return {
      about: '关于',
      archived: '已归档',
      branch: '默认分支',
      created: '创建',
      fork: '衍生',
      forks: '分叉',
      homepage: '主页',
      issues: '开放问题',
      language: '语言',
      license: '许可证',
      noDescription: '这个仓库暂无描述',
      notWatching: '不关注',
      openGitHub: '在 GitHub 查看',
      private: '私有',
      public: '公开',
      pushed: '最近推送',
      readme: 'README',
      repository: '仓库',
      source: '链接',
      star: 'Star',
      starCount: 'Stars',
      starred: '已 Star',
      stats: '统计',
      unstar: 'Unstar',
      updated: '更新',
      watchAll: '关注所有',
      watchIgnore: '忽略',
      watchNone: '仅被@时',
      watching: '关注',
      watchers: '关注者',
    };
  }

  return {
    about: 'About',
    archived: 'Archived',
    branch: 'Default branch',
    created: 'Created',
    fork: 'Fork',
    forks: 'Forks',
    homepage: 'Homepage',
    issues: 'Open issues',
    language: 'Language',
    license: 'License',
    noDescription: 'No description provided',
    notWatching: 'Ignore',
    openGitHub: 'View on GitHub',
    private: 'Private',
    public: 'Public',
    pushed: 'Pushed',
    readme: 'README',
    repository: 'Repository',
    source: 'Links',
    star: 'Star',
    starCount: 'Stars',
    starred: 'Starred',
    stats: 'Stats',
    unstar: 'Unstar',
    updated: 'Updated',
    watchAll: 'All',
    watchIgnore: 'Ignore',
    watchNone: 'Default',
    watching: 'Watching',
    watchers: 'Watchers',
  };
});

const localeCode = computed(() => locale.value);

const isStarred = ref(false);
const loadingStar = ref(false);
const starCount = ref(props.repository.stargazers_count ?? 0);

type WatchState = 'all' | 'default' | 'ignore' | null;
const watchState = ref<WatchState>(null);
const loadingWatch = ref(false);
const showWatchDropdown = ref(false);
const watchCount = ref(props.repository.watchers_count ?? 0);

const readmeContent = ref<string | null>(null);
const loadingReadme = ref(false);

const licenseInfo = ref<{ name: string | null; spdxId: string | null; url: string | null } | null>(
  null
);
const loadingLicense = ref(false);

const languageColor = computed(() => getLanguageColor(props.repository.language));

const visibility = computed(() =>
  props.repository.private ? copy.value.private : copy.value.public
);

const repoBadges = computed(() => {
  const badges: { icon: any; label: string; tone: string }[] = [
    {
      icon: props.repository.private ? GithubIcon : GithubIcon,
      label: visibility.value,
      tone: props.repository.private ? 'muted' : 'neutral',
    },
  ];

  if (props.repository.fork) {
    badges.push({ icon: GitForkIcon, label: copy.value.fork, tone: 'neutral' });
  }

  if (props.repository.archived) {
    badges.push({ icon: ArchiveIcon, label: copy.value.archived, tone: 'muted' });
  }

  return badges;
});

const watchStateLabel = computed(() => {
  if (watchState.value === 'all') return copy.value.watching;
  if (watchState.value === 'ignore') return copy.value.notWatching;
  return copy.value.watchNone;
});

const watchStateIcon = computed(() => EyeIcon);

const aboutItems = computed(() => {
  const items: { label: string; value: string; href?: string; icon: any }[] = [];

  if (props.repository.homepage) {
    const url = props.repository.homepage.startsWith('http')
      ? props.repository.homepage
      : `https://${props.repository.homepage}`;
    items.push({
      label: copy.value.homepage,
      value: props.repository.homepage,
      href: url,
      icon: GlobeIcon,
    });
  }

  if (licenseInfo.value?.name) {
    items.push({
      label: copy.value.license,
      value: licenseInfo.value.name,
      href: licenseInfo.value.url || undefined,
      icon: FileTextIcon,
    });
  }

  items.push({
    label: copy.value.branch,
    value: props.repository.default_branch || '-',
    icon: GitForkIcon,
  });

  items.push({
    label: copy.value.created,
    value: formatDate(props.repository.created_at),
    icon: BookmarkIcon,
  });

  items.push({
    label: copy.value.updated,
    value: formatDate(props.repository.updated_at),
    icon: BookmarkIcon,
  });

  return items;
});

const stats = computed(() => [
  { label: copy.value.starCount, value: starCount.value, icon: StarIcon, color: '#f59e0b' },
  { label: copy.value.watchers, value: watchCount.value, icon: EyeIcon, color: '#3b82f6' },
  {
    label: copy.value.forks,
    value: props.repository.forks_count ?? 0,
    icon: GitForkIcon,
    color: '#10b981',
  },
  {
    label: copy.value.issues,
    value: props.repository.open_issues_count ?? 0,
    icon: InfoIcon,
    color: '#8b5cf6',
  },
]);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return formatDurationFromNow(value, localeCode.value);
};

const toggleStar = async () => {
  if (loadingStar.value) return;
  loadingStar.value = true;

  const previousState = isStarred.value;
  const previousCount = starCount.value;

  try {
    if (isStarred.value) {
      isStarred.value = false;
      starCount.value = Math.max(0, starCount.value - 1);
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/star`, { method: 'DELETE' });
    } else {
      isStarred.value = true;
      starCount.value = starCount.value + 1;
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/star`, { method: 'PUT' });
    }
  } catch {
    isStarred.value = previousState;
    starCount.value = previousCount;
  } finally {
    loadingStar.value = false;
  }
};

const setWatchState = async (state: WatchState) => {
  if (loadingWatch.value) return;
  loadingWatch.value = true;
  showWatchDropdown.value = false;

  const previousState = watchState.value;

  try {
    if (state === null) {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, { method: 'DELETE' });
      watchState.value = null;
      watchCount.value = Math.max(0, watchCount.value - 1);
    } else {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, {
        method: 'PUT',
        body: { subscribed: state === 'all', ignored: state === 'ignore' },
      });
      const wasWatching = previousState === 'all';
      watchState.value = state;
      if (state === 'all' && !wasWatching) {
        watchCount.value = watchCount.value + 1;
      } else if (state !== 'all' && wasWatching) {
        watchCount.value = Math.max(0, watchCount.value - 1);
      }
    }
  } catch {
    watchState.value = previousState;
  } finally {
    loadingWatch.value = false;
  }
};

const toggleWatchDropdown = () => {
  showWatchDropdown.value = !showWatchDropdown.value;
};

const closeWatchDropdown = () => {
  showWatchDropdown.value = false;
};

const fetchStarState = async () => {
  try {
    const data = await apiFetch<{ starred: boolean }>(
      `/api/repos/${props.owner}/${props.repo}/star`
    );
    isStarred.value = data.starred;
  } catch {
    // Silently fail - default to unstarred
  }
};

const fetchWatchState = async () => {
  try {
    const data = await apiFetch<{ subscribed: boolean; ignored: boolean }>(
      `/api/repos/${props.owner}/${props.repo}/subscription`
    );
    if (data.subscribed) {
      watchState.value = 'all';
    } else if (data.ignored) {
      watchState.value = 'ignore';
    } else {
      watchState.value = 'default';
    }
  } catch {
    watchState.value = 'default';
  }
};

const fetchReadme = async () => {
  loadingReadme.value = true;
  try {
    const data = await apiFetch<{ content: string | null }>(
      `/api/repos/${props.owner}/${props.repo}/readme`
    );
    readmeContent.value = data.content;
  } catch {
    readmeContent.value = null;
  } finally {
    loadingReadme.value = false;
  }
};

const fetchLicense = async () => {
  loadingLicense.value = true;
  try {
    const data = await apiFetch<{ name: string | null; spdxId: string | null; url: string | null }>(
      `/api/repos/${props.owner}/${props.repo}/license`
    );
    licenseInfo.value = data;
  } catch {
    licenseInfo.value = null;
  } finally {
    loadingLicense.value = false;
  }
};

onMounted(() => {
  fetchStarState();
  fetchWatchState();
  fetchReadme();
  fetchLicense();
});

// Close dropdown on outside click
if (import.meta.client) {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.watch-dropdown-wrapper')) {
      closeWatchDropdown();
    }
  };
  onMounted(() => document.addEventListener('click', handleClickOutside));
  onUnmounted(() => document.removeEventListener('click', handleClickOutside));
}
</script>

<template>
  <div class="repo-detail-layout">
    <div class="columns">
      <div class="column is-three-quarters">
        <section class="repo-detail-header">
          <div class="repo-detail-header__title-row">
            <GithubIcon :size="28" class="repo-detail-header__icon" />
            <h1 class="title is-3 repo-detail-header__title">{{ repository.name }}</h1>
            <div class="repo-detail-header__actions">
              <button
                class="repo-action-btn"
                :class="{ 'repo-action-btn--active': isStarred }"
                :disabled="loadingStar"
                @click="toggleStar"
              >
                <Loader2Icon v-if="loadingStar" :size="14" class="spin-animation" />
                <StarIcon v-else :size="14" :fill="isStarred ? 'currentColor' : 'none'" />
                <span>{{ isStarred ? copy.starred : copy.star }}</span>
              </button>

              <div class="watch-dropdown-wrapper">
                <button
                  class="repo-action-btn"
                  :class="{ 'repo-action-btn--active': watchState === 'all' }"
                  :disabled="loadingWatch"
                  @click.stop="toggleWatchDropdown"
                >
                  <Loader2Icon v-if="loadingWatch" :size="14" class="spin-animation" />
                  <EyeIcon v-else :size="14" />
                  <span>{{ watchStateLabel }}</span>
                </button>
                <div v-if="showWatchDropdown" class="watch-dropdown">
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'all' }"
                    @click="setWatchState('all')"
                  >
                    <EyeIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchAll }}</span>
                      <span class="watch-dropdown__item-desc">Receive all notifications</span>
                    </div>
                  </button>
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'default' }"
                    @click="setWatchState('default')"
                  >
                    <EyeIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchNone }}</span>
                      <span class="watch-dropdown__item-desc">Only @mentions</span>
                    </div>
                  </button>
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'ignore' }"
                    @click="setWatchState('ignore')"
                  >
                    <XIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchIgnore }}</span>
                      <span class="watch-dropdown__item-desc">Receive no notifications</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="repo-detail-header__meta">
            <span class="tag mr-2 repo-detail-header__type">{{ copy.repository }}</span>
            <span class="subtitle mb-0 is-6 has-text-weight-medium">{{ owner }}/{{ repo }}</span>
            <span
              v-if="repository.language"
              class="tag is-link is-light ml-3 repo-detail-header__language"
            >
              <span
                class="repo-detail-header__language-dot"
                :style="{ backgroundColor: languageColor }"
              />
              <span>{{ repository.language }}</span>
            </span>
            <span
              v-for="badge in repoBadges"
              :key="badge.label"
              class="tag ml-2 repo-detail-header__badge"
            >
              <component :is="badge.icon" :size="13" />
              <span>{{ badge.label }}</span>
            </span>
          </div>

          <div v-if="repository.description" class="repo-detail-description mb-4">
            <p class="repo-detail-description__body">
              {{ repository.description }}
            </p>
          </div>

          <div class="repo-about mb-4">
            <div class="repo-about__grid">
              <div v-for="item in aboutItems" :key="item.label" class="repo-about__item">
                <component :is="item.icon" :size="14" class="repo-about__item-icon" />
                <span class="repo-about__item-label">{{ item.label }}:</span>
                <a
                  v-if="item.href"
                  :href="item.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="repo-about__item-value repo-about__item-value--link"
                >
                  {{ item.value }}
                  <ExternalLinkIcon :size="10" />
                </a>
                <span v-else class="repo-about__item-value">{{ item.value }}</span>
              </div>
            </div>
          </div>

          <hr class="mr-4" />

          <div class="repo-readme">
            <h2 class="title is-5 repo-readme__title">
              <BookmarkIcon :size="18" />
              <span>{{ copy.readme }}</span>
            </h2>
            <div v-if="loadingReadme" class="repo-readme__loading">
              <Loader2Icon :size="20" class="spin-animation" />
            </div>
            <div v-else-if="readmeContent" class="repo-readme__content content">
              <MarkdownRenderer :value="readmeContent" :repo-owner="owner" :repo-name="repo" />
            </div>
            <div v-else class="repo-readme__empty">
              {{ copy.noDescription }}
            </div>
          </div>
        </section>
      </div>

      <div class="column is-one-quarter detail-sidebar-column">
        <div class="sidebar-scroll">
          <div class="sidebar-card mb-4">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <StarIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ copy.stats }}</span>
              </div>
            </div>
            <div class="sidebar-card__content">
              <div class="info-stats">
                <div v-for="stat in stats" :key="stat.label" class="info-stat">
                  <component
                    :is="stat.icon"
                    :size="20"
                    class="info-stat__icon"
                    :style="{ color: stat.color }"
                  />
                  <span class="info-stat__value">{{ stat.value }}</span>
                  <span class="info-stat__label">{{ stat.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <ExternalLinkIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ copy.source }}</span>
              </div>
            </div>
            <div class="sidebar-card__content">
              <a
                :href="repository.html_url"
                target="_blank"
                rel="noopener noreferrer"
                class="sidebar-link"
              >
                <ExternalLinkIcon :size="14" />
                <span>{{ copy.openGitHub }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.repo-detail-layout {
  height: 100%;
  min-height: 0;
}

.repo-detail-layout :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.repo-detail-layout :deep(.column.is-three-quarters) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.repo-detail-layout :deep(.column.is-one-quarter) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.repo-detail-layout :deep(.detail-sidebar-column) {
  padding-right: 1rem;
}

.repo-detail-header {
  max-width: 68rem;
  padding: 0.75rem 1rem 5rem 0;
}

.repo-detail-header__title-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.repo-detail-header__icon {
  flex: 0 0 auto;
  color: var(--gitpulse-success);
}

.repo-detail-header__title {
  margin-bottom: 0;
  overflow-wrap: anywhere;
  letter-spacing: 0;
}

.repo-detail-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.repo-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--active {
    background: var(--gitpulse-surface-active);
    border-color: var(--gitpulse-accent);
    color: var(--gitpulse-accent);

    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-active);
    }
  }
}

.watch-dropdown-wrapper {
  position: relative;
}

.watch-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  min-width: 200px;
  margin-top: 4px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
}

.watch-dropdown__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &--active {
    background: var(--gitpulse-surface-active);
    color: var(--gitpulse-accent);
  }

  &:first-child {
    border-radius: 8px 8px 0 0;
  }

  &:last-child {
    border-radius: 0 0 8px 8px;
  }
}

.watch-dropdown__item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.watch-dropdown__item-label {
  font-weight: 600;
}

.watch-dropdown__item-desc {
  color: var(--gitpulse-text-muted);
  font-size: 11px;
}

.repo-detail-header__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.repo-detail-header__type {
  background-color: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-strong);
}

.repo-detail-header__language,
.repo-detail-header__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.repo-detail-header__language-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}

.repo-detail-description {
  max-width: 54rem;
}

.repo-detail-description__body {
  margin-bottom: 0;
  color: var(--bulma-text-strong);
  font-size: 1rem;
  line-height: 1.6;
}

.repo-about {
  margin-bottom: 1rem;
}

.repo-about__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
}

.repo-about__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.repo-about__item-icon {
  color: var(--gitpulse-text-muted);
  flex-shrink: 0;
}

.repo-about__item-label {
  color: var(--gitpulse-text-muted);
  font-weight: 500;
}

.repo-about__item-value {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.repo-about__item-value--link {
  color: var(--gitpulse-link);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.repo-readme {
  margin-top: 1.5rem;
}

.repo-readme__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.125rem;
}

.repo-readme__loading {
  display: flex;
  justify-content: center;
  padding: 3rem;
  color: var(--gitpulse-text-muted);
}

.repo-readme__content {
  // Let MarkdownRenderer handle its own styles
}

.repo-readme__empty {
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: center;
}

.sidebar-scroll {
  height: 100%;
  overflow-y: auto;
  padding-right: 0.75rem;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;

  &:hover {
    scrollbar-color: var(--gitpulse-scrollbar-thumb) transparent;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 3px;
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: var(--gitpulse-scrollbar-thumb);
  }
}

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

.sidebar-card__header-left {
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
}

.sidebar-card__content {
  padding: 12px 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.info-item__label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  font-size: 12px;
}

.info-item__value {
  min-width: 0;
  overflow: hidden;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-item__value--link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--gitpulse-link);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.info-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-stat {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: 5.5rem;
  padding: 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
}

.info-stat__icon {
  margin-bottom: 0.5rem;
  transition: transform 0.2s ease;

  .info-stat:hover & {
    transform: scale(1.1);
  }
}

.info-stat__value {
  margin-bottom: 0.25rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.35rem;
  font-weight: 800;
}

.info-stat__label {
  color: var(--gitpulse-text-muted);
  font-size: 12px;
  text-align: center;
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

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media screen and (max-width: 1024px) {
  .repo-detail-layout :deep(.columns) {
    display: block;
    height: auto;
  }

  .repo-detail-layout :deep(.column.is-three-quarters),
  .repo-detail-layout :deep(.column.is-one-quarter) {
    height: auto;
    overflow: visible;
  }

  .repo-detail-header {
    padding-right: 0;
    padding-bottom: 2rem;
  }

  .repo-detail-header__title-row {
    flex-wrap: wrap;
  }

  .repo-detail-header__actions {
    width: 100%;
    margin-top: 0.5rem;
    margin-left: 0;
  }
}
</style>
