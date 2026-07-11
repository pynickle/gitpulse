<script setup lang="ts">
import {
  ArchiveIcon,
  BookmarkIcon,
  CircleDotIcon,
  CircleMinusIcon,
  EyeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  GlobeIcon,
  GitForkIcon,
  InfoIcon,
  LayoutGridIcon,
  Loader2Icon,
  StarIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, type Component } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { GitHubIcon } from 'vue3-simple-icons';

import { formatDurationFromNow } from '#imports';
import type { RepositoryDetailPayload } from '#shared/types/repos';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import RepoIssuePrList from '~/components/dashboard/detail/RepoIssuePrList.vue';
import BranchSelector from '~/components/dashboard/repo-files/BranchSelector.vue';
import RepoFileTree from '~/components/dashboard/repo-files/RepoFileTree.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { useRepoIssuePrList } from '~/composables/useRepoIssuePrList';
import type { DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import { createDashboardFileTarget } from '~/utils/dashboardUrlNavigationUtils';
import {
  normalizeRepoIssuePrState,
  type RepoIssuePrKind,
  type RepoIssuePrState,
} from '~/utils/repoIssuePrSearchQuery';

type RepoDetailPanel = 'files' | RepoIssuePrKind;

interface RepoPanelTab {
  value: RepoDetailPanel;
  label: string;
  icon: Component;
}

interface RepoStateFilterOption {
  value: RepoIssuePrState;
  label: string;
  icon: Component;
  color: string;
}

const props = defineProps<{
  repository: RepositoryDetailPayload;
  owner: string;
  repo: string;
}>();

const emit = defineEmits<{
  (e: 'open-issue', item: DashboardIssuePrEntity): void;
  (e: 'open-pull-request', item: DashboardIssuePrEntity): void;
}>();

type RepoDetailIcon = Component;

const { locale, t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useGitPulseApiFetch();
const { navigateToFile } = useNavigationHistory();
const { openRepository } = useDashboardRepositoryNavigation();
const { opensGitHubLinks, getGitHubTargetUrl } = useGitHubLinkRouting();
const {
  branches,
  currentBranch,
  defaultBranch,
  directoryContents,
  loading: loadingFiles,
  error: filesError,
  navigateToBranch,
} = useRepoFiles();

interface LicenseInfo {
  name: string | null;
  spdxId: string | null;
  url: string | null;
  path: string | null;
}

interface AboutItem {
  label: string;
  value: string;
  href?: string;
  to?: string;
  icon: RepoDetailIcon;
  onClick?: () => void;
}

const copy = computed(() => {
  if (locale.value.startsWith('zh')) {
    return {
      about: '关于',
      archived: '已归档',
      branch: '默认分支',
      created: '创建',
      fork: '衍生',
      forkedFrom: '衍生自',
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
    forkedFrom: 'Forked from',
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

const activePanel = shallowRef<RepoDetailPanel>('files');
const listState = shallowRef<RepoIssuePrState>('open');

const listKind = computed<RepoIssuePrKind>(() =>
  activePanel.value === 'pulls' ? 'pulls' : 'issues'
);
const isListPanel = computed(() => activePanel.value === 'issues' || activePanel.value === 'pulls');

const panelTabs = computed<RepoPanelTab[]>(() => [
  {
    value: 'files',
    label: t('repoDetail.files'),
    icon: FileTextIcon,
  },
  {
    value: 'issues',
    label: t('repoDetail.issues'),
    icon: CircleDotIcon,
  },
  {
    value: 'pulls',
    label: t('repoDetail.pulls'),
    icon: GitPullRequestIcon,
  },
]);

const stateFilterOptions = computed<RepoStateFilterOption[]>(() => {
  const openOption: RepoStateFilterOption = {
    value: 'open',
    label: t('dashboard.filters.options.open'),
    icon: CircleDotIcon,
    color: 'var(--gitpulse-success)',
  };
  const closedOption: RepoStateFilterOption = {
    value: 'closed',
    label: t('dashboard.filters.options.closed'),
    icon: CircleMinusIcon,
    color: 'var(--gitpulse-danger)',
  };
  const allOption: RepoStateFilterOption = {
    value: 'all',
    label: t('dashboard.filters.options.all'),
    icon: LayoutGridIcon,
    color: 'var(--gitpulse-text-muted)',
  };

  if (listKind.value === 'pulls') {
    return [
      openOption,
      closedOption,
      {
        value: 'merged',
        label: t('dashboard.filters.options.merged'),
        icon: GitMergeIcon,
        color: 'var(--gitpulse-purple)',
      },
      allOption,
    ];
  }

  return [openOption, closedOption, allOption];
});

// Only query while Issues/PRs is open — keep Files panel free of list traffic.
const listOwner = computed(() => (isListPanel.value ? props.owner : ''));
const listRepo = computed(() => (isListPanel.value ? props.repo : ''));

const {
  items: listItems,
  loading: listLoading,
  error: listError,
  pagination: listPagination,
  showPagination: listShowPagination,
  goToPage: listGoToPage,
  refresh: listRefresh,
} = useRepoIssuePrList(listOwner, listRepo, listKind, listState);

const listEmptyMessage = computed(() => {
  const state = listState.value;
  if (listKind.value === 'pulls') {
    if (state === 'closed') return t('repoDetail.pullsEmptyClosed');
    if (state === 'merged') return t('repoDetail.pullsEmptyMerged');
    if (state === 'all') return t('repoDetail.pullsEmptyAll');
    return t('repoDetail.pullsEmpty');
  }

  if (state === 'closed') return t('repoDetail.issuesEmptyClosed');
  if (state === 'all') return t('repoDetail.issuesEmptyAll');
  return t('repoDetail.issuesEmpty');
});

const selectPanel = (value: RepoDetailPanel) => {
  activePanel.value = value;
  if (value === 'issues' || value === 'pulls') {
    listState.value = 'open';
  }
};

const selectListState = (value: RepoIssuePrState) => {
  listState.value = normalizeRepoIssuePrState(listKind.value, value);
};

const handleIssuePrSelect = (item: DashboardIssuePrEntity) => {
  if (listKind.value === 'pulls') {
    emit('open-pull-request', item);
    return;
  }

  emit('open-issue', item);
};

watch(
  () => [props.owner, props.repo] as const,
  () => {
    activePanel.value = 'files';
    listState.value = 'open';
  }
);

const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const isStarred = ref(false);
const loadingStar = ref(false);
const starCount = ref(props.repository.stargazers_count ?? 0);

type WatchState = 'all' | 'default' | 'ignore';
const watchState = ref<WatchState | null>(null);
const loadingWatch = ref(false);
const showWatchDropdown = ref(false);
const watchCount = ref(props.repository.watchers_count ?? 0);

const readmeContent = ref<string | null>(null);
const readmePath = ref<string | null>(null);
const loadingReadme = ref(false);
const readmeRequestId = ref(0);

const licenseInfo = ref<LicenseInfo | null>(null);
const loadingLicense = ref(false);
const licenseRequestId = ref(0);

// Session caches for README / license while this repo detail instance is mounted.
const readmeSessionCache = new Map<string, { content: string | null; path: string | null }>();
const licenseSessionCache = new Map<string, LicenseInfo | null>();

const languageColor = computed(() => getLanguageColor(props.repository.language));
const repoDefaultBranch = computed(
  () => defaultBranch.value || props.repository.default_branch || ''
);
const repoCurrentBranch = computed(() => currentBranch.value || repoDefaultBranch.value);
const canonicalBranch = computed(() => repoCurrentBranch.value || undefined);

// SEO: dynamic title based on repository
usePageMeta(
  computed(() => props.repository?.name),
  {
    description: computed(() => props.repository?.description ?? ''),
  }
);
const currentBranchQueryValue = computed(() => {
  return repoCurrentBranch.value && repoCurrentBranch.value !== repoDefaultBranch.value
    ? repoCurrentBranch.value
    : undefined;
});

const visibility = computed(() =>
  props.repository.private ? copy.value.private : copy.value.public
);

/** Immediate parent repository when the current repo is a fork. */
const forkedFrom = computed(() => {
  if (!props.repository.fork) return null;

  const parent = props.repository.parent;
  if (!parent) return null;

  const fullName = typeof parent.full_name === 'string' ? parent.full_name.trim() : '';
  let owner = typeof parent.owner?.login === 'string' ? parent.owner.login.trim() : '';
  let name = typeof parent.name === 'string' ? parent.name.trim() : '';

  if ((!owner || !name) && fullName.includes('/')) {
    const [parsedOwner = '', parsedName = ''] = fullName.split('/');
    owner = owner || parsedOwner.trim();
    name = name || parsedName.trim();
  }

  if (!owner || !name) return null;

  return {
    owner,
    name,
    fullName: fullName || `${owner}/${name}`,
  };
});

const openParentRepository = async () => {
  const parent = forkedFrom.value;
  if (!parent) return;
  await openRepository(parent.owner, parent.name);
};

const repoBadges = computed(() => {
  const badges: { icon: RepoDetailIcon; label: string; tone: string }[] = [
    {
      icon: GitHubIcon,
      label: visibility.value,
      tone: props.repository.private ? 'muted' : 'neutral',
    },
  ];

  // When parent is known, "Forked from …" already conveys fork status — skip the badge.
  if (props.repository.fork && !forkedFrom.value) {
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

const isSubscribedWatchState = (state: WatchState | null) => state === 'all' || state === 'ignore';

const buildRepoFileQuery = (path: string): LocationQueryRaw => ({
  repo: `${props.owner}/${props.repo}`,
  path,
  branch: currentBranchQueryValue.value,
});

const buildRepoFileTo = (path: string) => {
  return localePath({
    path: '/dashboard',
    query: buildRepoFileQuery(path),
  });
};

const trackFileNavigation = (path: string) => {
  navigateToFile(props.owner, props.repo, path, canonicalBranch.value);
};

const buildRepoFileNavigation = (path: string) => {
  const target = createDashboardFileTarget(props.owner, props.repo, path, {
    branch: canonicalBranch.value,
  });

  if (opensGitHubLinks.value) {
    return {
      href: getGitHubTargetUrl(target),
    };
  }

  return {
    to: buildRepoFileTo(path),
    onClick: () => trackFileNavigation(path),
  };
};

const aboutItems = computed(() => {
  const items: AboutItem[] = [];

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

  if (licenseInfo.value?.name && licenseInfo.value.path) {
    const licensePath = licenseInfo.value.path;
    items.push({
      label: copy.value.license,
      value: licenseInfo.value.name,
      icon: FileTextIcon,
      ...buildRepoFileNavigation(licensePath),
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
  return formatDurationFromNow(value, localeCode.value, relativeTimeNow.value);
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
  const previousSubscribed = isSubscribedWatchState(previousState);

  try {
    if (state === 'default') {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, {
        method: 'PUT',
        body: { subscribed: state === 'all', ignored: state === 'ignore' },
      });
    }

    watchState.value = state;

    const nextSubscribed = isSubscribedWatchState(state);
    if (previousSubscribed !== nextSubscribed) {
      watchCount.value = previousSubscribed
        ? Math.max(0, watchCount.value - 1)
        : watchCount.value + 1;
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

const buildRefQuery = () => {
  const branch = currentBranchQueryValue.value;
  return branch ? `?ref=${encodeURIComponent(branch)}` : '';
};

const buildBranchScopedCacheKey = () => {
  const branch = repoCurrentBranch.value || props.repository.default_branch || '';
  return `${props.owner}/${props.repo}@${branch}`;
};

const fetchReadme = async () => {
  const cacheKey = buildBranchScopedCacheKey();
  const cached = readmeSessionCache.get(cacheKey);
  if (cached) {
    readmeRequestId.value += 1;
    readmeContent.value = cached.content;
    readmePath.value = cached.path;
    loadingReadme.value = false;
    return;
  }

  const requestId = readmeRequestId.value + 1;
  readmeRequestId.value = requestId;
  loadingReadme.value = true;
  try {
    const data = await apiFetch<{ content: string | null; path?: string | null }>(
      `/api/repos/${props.owner}/${props.repo}/readme${buildRefQuery()}`
    );
    if (requestId !== readmeRequestId.value) return;

    const entry = { content: data.content, path: data.path ?? null };
    readmeSessionCache.set(cacheKey, entry);
    readmeContent.value = entry.content;
    readmePath.value = entry.path;
  } catch {
    if (requestId === readmeRequestId.value) {
      readmeSessionCache.set(cacheKey, { content: null, path: null });
      readmeContent.value = null;
      readmePath.value = null;
    }
  } finally {
    if (requestId === readmeRequestId.value) {
      loadingReadme.value = false;
    }
  }
};

const fetchLicense = async () => {
  const cacheKey = buildBranchScopedCacheKey();
  if (licenseSessionCache.has(cacheKey)) {
    licenseRequestId.value += 1;
    licenseInfo.value = licenseSessionCache.get(cacheKey) ?? null;
    loadingLicense.value = false;
    return;
  }

  const requestId = licenseRequestId.value + 1;
  licenseRequestId.value = requestId;
  licenseInfo.value = null;
  loadingLicense.value = true;
  try {
    const data = await apiFetch<LicenseInfo>(
      `/api/repos/${props.owner}/${props.repo}/license${buildRefQuery()}`
    );
    if (requestId !== licenseRequestId.value) return;

    licenseSessionCache.set(cacheKey, data);
    licenseInfo.value = data;
  } catch {
    if (requestId === licenseRequestId.value) {
      licenseSessionCache.set(cacheKey, null);
      licenseInfo.value = null;
    }
  } finally {
    if (requestId === licenseRequestId.value) {
      loadingLicense.value = false;
    }
  }
};

onMounted(() => {
  fetchStarState();
  fetchWatchState();
});

watch(
  () => [props.owner, props.repo, repoCurrentBranch.value] as const,
  ([owner, repo], previous) => {
    if (!repoCurrentBranch.value) return;

    // New repository instance: drop session caches from the previous repo.
    if (previous && (previous[0] !== owner || previous[1] !== repo)) {
      readmeSessionCache.clear();
      licenseSessionCache.clear();
    }

    void fetchReadme();
    void fetchLicense();
  },
  { immediate: true }
);

// Close dropdown on outside click
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target;
  if (!(target instanceof Element) || !target.closest('.watch-dropdown-wrapper')) {
    closeWatchDropdown();
  }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <div class="repo-detail-layout">
    <div class="columns">
      <div class="column detail-main-column">
        <section class="repo-detail-header">
          <div class="repo-detail-header__title-row">
            <GitHubIcon :size="28" class="repo-detail-header__icon" />
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
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchAllDescription') }}
                      </span>
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
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchDefaultDescription') }}
                      </span>
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
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchIgnoreDescription') }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <BranchSelector
                :branches="branches"
                :current-branch="repoCurrentBranch"
                :default-branch="repoDefaultBranch"
                :loading="loadingFiles"
                @select="navigateToBranch"
              />
            </div>
          </div>

          <div class="repo-detail-header__identity">
            <div class="repo-detail-header__meta">
              <span class="subtitle mb-0 is-6 has-text-weight-medium">{{ owner }}/{{ repo }}</span>
              <span
                v-if="repository.language"
                class="tag is-link is-light repo-detail-header__language"
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
                class="tag repo-detail-header__badge"
              >
                <component :is="badge.icon" :size="13" />
                <span>{{ badge.label }}</span>
              </span>
            </div>

            <p v-if="forkedFrom" class="repo-detail-forked-from">
              <GitForkIcon :size="12" class="repo-detail-forked-from__icon" aria-hidden="true" />
              <span class="repo-detail-forked-from__label">{{ copy.forkedFrom }}</span>
              <a
                class="repo-detail-forked-from__link"
                href="#"
                @click.prevent="openParentRepository"
              >
                {{ forkedFrom.fullName }}
              </a>
            </p>
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
                <NuxtLinkLocale
                  v-if="item.to"
                  :to="item.to"
                  class="repo-about__item-value repo-about__item-value--link"
                  @click="item.onClick?.()"
                >
                  {{ item.value }}
                </NuxtLinkLocale>
                <a
                  v-else-if="item.href"
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

          <div class="repo-detail-section">
            <div
              class="repo-detail-section__chrome"
              :class="{ 'repo-detail-section__chrome--sticky': isListPanel }"
            >
              <div
                class="repo-detail-tabs"
                role="tablist"
                :aria-label="t('repoDetail.panelSwitch')"
              >
                <button
                  v-for="tab in panelTabs"
                  :key="tab.value"
                  type="button"
                  role="tab"
                  class="repo-detail-tabs__tab"
                  :class="{ 'is-active': activePanel === tab.value }"
                  :aria-selected="activePanel === tab.value"
                  :tabindex="activePanel === tab.value ? 0 : -1"
                  @click="selectPanel(tab.value)"
                >
                  <component :is="tab.icon" :size="14" class="repo-detail-tabs__icon" />
                  <span>{{ tab.label }}</span>
                </button>
              </div>

              <div v-if="isListPanel" class="repo-detail-list-toolbar">
                <div
                  class="repo-detail-state-filters"
                  role="tablist"
                  :aria-label="t('repoDetail.stateFilter')"
                >
                  <button
                    v-for="option in stateFilterOptions"
                    :key="option.value"
                    type="button"
                    role="tab"
                    class="repo-detail-state-filters__option"
                    :class="{ 'is-active': listState === option.value }"
                    :aria-selected="listState === option.value"
                    :tabindex="listState === option.value ? 0 : -1"
                    :disabled="listLoading"
                    :style="
                      listState === option.value ? { '--state-color': option.color } : undefined
                    "
                    @click="selectListState(option.value)"
                  >
                    <component
                      :is="option.icon"
                      :size="13"
                      class="repo-detail-state-filters__icon"
                    />
                    <span>{{ option.label }}</span>
                  </button>
                </div>

                <!-- Always reserve pagination height so loading ↔ ready does not jump. -->
                <div
                  class="repo-detail-list-toolbar__pagination"
                  :class="{
                    'is-hidden': !listShowPagination && !listLoading,
                    'is-loading': listLoading,
                  }"
                  :aria-hidden="!listShowPagination && !listLoading"
                >
                  <DashboardPagination
                    v-if="listShowPagination || listLoading"
                    :pagination="listPagination"
                    @change="listGoToPage"
                  />
                </div>
              </div>
            </div>

            <template v-if="activePanel === 'files'">
              <RepoFileTree
                :owner="owner"
                :repo="repo"
                :items="directoryContents"
                :loading="loadingFiles"
                :error="filesError"
                :current-branch="repoCurrentBranch"
                :default-branch="repoDefaultBranch"
              />

              <div class="repo-readme">
                <h2 class="title is-5 repo-readme__title">
                  <BookmarkIcon :size="18" />
                  <span>{{ copy.readme }}</span>
                </h2>
                <div v-if="loadingReadme" class="repo-readme__loading">
                  <Loader2Icon :size="20" class="spin-animation" />
                </div>
                <div v-else-if="readmeContent" class="repo-readme__content content">
                  <MarkdownRenderer
                    :value="readmeContent"
                    :repo-owner="owner"
                    :repo-name="repo"
                    :base-path="readmePath ?? undefined"
                    :branch="repoCurrentBranch || undefined"
                  />
                </div>
                <div v-else class="repo-readme__empty">
                  {{ copy.noDescription }}
                </div>
              </div>
            </template>

            <RepoIssuePrList
              v-else
              :kind="listKind"
              :items="listItems"
              :loading="listLoading"
              :error="listError"
              :empty-message="listEmptyMessage"
              @select="handleIssuePrSelect"
              @retry="listRefresh"
            />
          </div>
        </section>
      </div>

      <div class="column detail-sidebar-column">
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
  /* Page-level scroll lives on the parent detail pane so sticky chrome can pin
     under the overlay header, not under an inner column scroller. */
  min-height: 100%;
}

.repo-detail-layout :deep(.columns) {
  align-items: flex-start;
  margin-bottom: 0;
}

.repo-detail-layout :deep(.detail-main-column) {
  flex: none;
  width: 72%;
  min-width: 0;
  overflow: visible;
}

.repo-detail-layout :deep(.detail-sidebar-column) {
  position: sticky;
  top: 0.75rem;
  flex: none;
  width: 28%;
  max-height: calc(100vh - 4.5rem);
  overflow: hidden;
  padding-right: 1rem;
}

.repo-detail-header {
  max-width: 68rem;
  padding: 0.75rem 1rem 2.5rem 0;
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

/* Full-name + badges (+ optional forked-from) share one vertical margin so
   fork and non-fork headers keep the same rhythm into the description. */
.repo-detail-header__identity {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 1rem;
}

.repo-detail-header__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.repo-detail-header__language,
.repo-detail-header__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-weight: 600;
}

.repo-detail-header__language-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}

.repo-detail-forked-from {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--gitpulse-text-muted);
}

.repo-detail-forked-from__icon {
  flex: 0 0 auto;
  opacity: 0.85;
}

.repo-detail-forked-from__label {
  color: var(--gitpulse-text-muted);
}

.repo-detail-forked-from__link {
  color: var(--gitpulse-text-strong, var(--bulma-text-strong));
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.16s ease;

  &:hover {
    color: var(--gitpulse-accent-hover);
    text-decoration: underline;
  }
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

.repo-detail-section {
  min-width: 0;
}

.repo-detail-section__chrome {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.75rem;
}

/*
  Sticky under the overlay page header (scrollport is the detail pane).
  Frosted shelf so list cards pass underneath without blending into the bar.
  Horizontal inset matches list cards (no asymmetric right bleed).
*/
.repo-detail-section__chrome--sticky {
  position: sticky;
  top: 0;
  z-index: 5;
  /* Extend slightly upward into the reduced pane padding for a flush header seam. */
  margin: -0.35rem 0 0.5rem;
  padding: 0.5rem 0.35rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-border) 92%, transparent);
  border-radius: 10px;
  background: color-mix(
    in srgb,
    var(--gitpulse-surface) 94%,
    var(--gitpulse-surface-muted, var(--gitpulse-surface))
  );
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--gitpulse-border) 55%, transparent),
    0 4px 12px -8px color-mix(in srgb, var(--gitpulse-text-strong, #111) 18%, transparent);

  &::after {
    content: '';
    position: absolute;
    left: 0.5rem;
    right: 0.5rem;
    top: 100%;
    height: 0.55rem;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--gitpulse-surface) 40%, transparent),
      transparent
    );
  }
}

html.dark .repo-detail-section__chrome--sticky {
  border-color: color-mix(in srgb, var(--gitpulse-border) 100%, transparent);
  background: color-mix(in srgb, var(--gitpulse-surface) 90%, #000);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--gitpulse-border) 70%, transparent),
    0 6px 16px -10px rgba(0, 0, 0, 0.5);
}

.repo-detail-tabs {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  min-width: 0;
  padding: 0 0.15rem;
  border-bottom: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
}

.repo-detail-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: -1px;
  padding: 0.5rem 0.75rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover:not(.is-active) {
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: -2px;
    border-radius: 4px;
  }

  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-bottom-color: var(--gitpulse-accent, var(--gitpulse-link));
  }
}

.repo-detail-tabs__icon {
  flex-shrink: 0;
}

.repo-detail-list-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.5rem 0.75rem;
  /* Fixed single-row height so pagination mount/unmount never shifts chrome. */
  min-height: 2rem;
  min-width: 0;
  padding: 0.35rem 0.15rem 0;
}

.repo-detail-state-filters {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.2rem;
  min-width: 0;
  flex: 1 1 auto;
  /* Keep first option off the chrome edge (active/hover fill needs breathing room). */
  padding: 0.1rem 0.1rem 0.1rem 0.2rem;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.repo-detail-state-filters__option {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.55rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    background 0.12s ease;

  &:hover:not(.is-active):not(:disabled) {
    color: var(--gitpulse-text);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &.is-active {
    color: var(--state-color, var(--gitpulse-text-strong));
    background: color-mix(in srgb, var(--state-color, var(--gitpulse-text-muted)) 14%, transparent);
  }
}

.repo-detail-state-filters__icon {
  flex-shrink: 0;
}

.repo-detail-list-toolbar__pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  flex: 0 0 auto;
  /* Keep the same footprint whether pagination is real, loading, or hidden. */
  min-height: 1.5rem;
  min-width: 7.5rem;

  &.is-hidden {
    visibility: hidden;
    pointer-events: none;
  }

  &.is-loading {
    pointer-events: none;
    opacity: 0.45;
  }
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
  max-height: inherit;
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
  }

  .repo-detail-layout :deep(.detail-main-column),
  .repo-detail-layout :deep(.detail-sidebar-column) {
    width: 100%;
    max-height: none;
    overflow: visible;
    position: static;
    padding-right: 0;
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
