<script setup lang="ts">
import {
  CalendarIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  GitBranchIcon,
  PackageIcon,
  TagIcon,
} from '@lucide/vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { ReleaseAsset, ReleaseDetailPayload } from '#shared/types/releases';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import formatPageMetaDescription from '~/utils/formatPageMetaDescription';

const props = defineProps<{
  release: ReleaseDetailPayload;
}>();

const { locale, t } = useI18n();
const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();
const { openRepository } = useDashboardRepositoryNavigation();
const relativeTimeNow = useRelativeTimeNow();

const repoInfo = computed(() => parseGitHubRepoPath(props.release.repository_url));
const repoOwner = computed(() => repoInfo.value?.owner ?? '');
const repoName = computed(() => repoInfo.value?.repo ?? '');

const releaseTitle = computed(() => {
  return props.release.name?.trim() || props.release.tag_name || t('releaseDetail.untitled');
});

const releasedAt = computed(() => props.release.published_at || props.release.created_at || '');

const releasedAtLabel = computed(() => {
  return releasedAt.value
    ? formatDurationFromNow(releasedAt.value, locale.value, relativeTimeNow.value)
    : t('releaseDetail.unpublished');
});

const body = computed(() => props.release.body?.trim() || '');

const assets = computed<ReleaseAsset[]>(() => props.release.assets ?? []);

const hasAssets = computed(() => assets.value.length > 0);

const archiveLinks = computed(() =>
  [
    {
      label: t('releaseDetail.sourceZip'),
      href: props.release.zipball_url,
      icon: FileArchiveIcon,
    },
    {
      label: t('releaseDetail.sourceTar'),
      href: props.release.tarball_url,
      icon: FileArchiveIcon,
    },
  ].filter((item): item is { label: string; href: string; icon: typeof FileArchiveIcon } =>
    Boolean(item.href)
  )
);

const formatAssetSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return t('releaseDetail.sizeUnknown');

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const compactFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      notation: 'compact',
      maximumFractionDigits: 1,
    })
);

const formatDownloadCount = (count: number) => {
  if (!Number.isFinite(count) || count <= 0) return '0';
  return compactFormatter.value.format(count);
};

const handleRepoClick = async () => {
  if (!repoOwner.value || !repoName.value) return;

  await openRepository(repoOwner.value, repoName.value);
};

usePageMeta(
  computed(() => releaseTitle.value),
  {
    description: computed(() => formatPageMetaDescription(body.value)),
  }
);
</script>

<template>
  <div class="release-detail detail-scroll">
    <div class="columns">
      <div class="column detail-main-column">
        <header class="release-header">
          <div class="release-header__top">
            <div class="release-header__tag-row">
              <TagIcon :size="16" class="release-header__tag-icon" />
              <span class="release-header__tag-name">{{ release.tag_name }}</span>
            </div>
            <div class="release-header__badges">
              <span v-if="release.draft" class="tag is-warning is-light">
                {{ t('releaseDetail.draft') }}
              </span>
              <span v-if="release.prerelease" class="tag is-info is-light">
                {{ t('releaseDetail.prerelease') }}
              </span>
              <span v-if="release.target_commitish" class="tag release-header__branch">
                <GitBranchIcon :size="13" />
                <span>{{ release.target_commitish }}</span>
              </span>
            </div>
          </div>

          <h1 class="title is-3 release-header__title">{{ releaseTitle }}</h1>

          <div class="release-header__meta">
            <button class="release-header__repo button is-ghost is-small" @click="handleRepoClick">
              <GitHubIcon :size="15" />
              <span>{{ repoOwner }}/{{ repoName }}</span>
            </button>

            <span class="release-header__meta-separator">·</span>

            <span class="release-header__meta-item">
              <CalendarIcon :size="15" />
              <span>{{ releasedAtLabel }}</span>
            </span>

            <span v-if="release.author?.login" class="release-header__meta-separator">·</span>

            <span v-if="release.author?.login" class="release-header__meta-item">
              <GitHubAvatar
                :src="release.author.avatar_url"
                :alt="release.author.login"
                :size="18"
                :disable-link="true"
              />
              <span>{{ release.author.login }}</span>
            </span>
          </div>
        </header>

        <hr class="release-divider" />

        <article class="release-body">
          <MarkdownRenderer
            v-if="body"
            :value="body"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
          <p v-else class="release-body__empty">{{ t('releaseDetail.noDescription') }}</p>
        </article>

        <ReactionBar
          v-if="repoOwner && repoName && release.id"
          class="release-body__reactions"
          target-kind="release"
          :owner="repoOwner"
          :repo="repoName"
          :target-id="release.id"
          :initial-items="release.reactions"
          initial-items-include-viewer-state
        />
      </div>

      <aside class="column detail-sidebar-column">
        <div class="release-sidebar">
          <section class="sidebar-card release-sidebar__assets-card">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <PackageIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ t('releaseDetail.assets') }}</span>
              </div>
              <span class="sidebar-card__count">
                {{ t('releaseDetail.assetCount', { count: assets.length }) }}
              </span>
            </div>
            <div
              class="sidebar-card__content sidebar-card__content--scrollable"
              :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
              @scroll="onSidebarScroll"
            >
              <div v-if="hasAssets" class="release-assets">
                <a
                  v-for="asset in assets"
                  :key="asset.id"
                  :href="asset.browser_download_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="release-asset"
                >
                  <DownloadIcon :size="14" class="release-asset__icon" />
                  <span class="release-asset__content">
                    <span class="release-asset__name">{{ asset.name }}</span>
                    <span class="release-asset__meta">
                      <span class="release-asset__size">{{ formatAssetSize(asset.size) }}</span>
                      <span class="release-asset__downloads">
                        <DownloadIcon :size="10" />
                        <span>{{ formatDownloadCount(asset.download_count) }}</span>
                      </span>
                    </span>
                  </span>
                </a>
              </div>
              <p v-else class="release-sidebar__empty">{{ t('releaseDetail.noAssets') }}</p>
            </div>
          </section>

          <section class="sidebar-card">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <FileArchiveIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ t('releaseDetail.sourceCode') }}</span>
              </div>
            </div>
            <div class="sidebar-card__content">
              <div class="release-archives">
                <a
                  v-for="archive in archiveLinks"
                  :key="archive.label"
                  :href="archive.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="release-archive"
                >
                  <component :is="archive.icon" :size="14" class="release-archive__icon" />
                  <span class="release-archive__name">{{ archive.label }}</span>
                  <ExternalLinkIcon :size="12" class="release-archive__external" />
                </a>
              </div>
            </div>
          </section>

          <section class="sidebar-card">
            <div class="sidebar-card__content">
              <a
                v-if="release.html_url"
                :href="release.html_url"
                target="_blank"
                rel="noopener noreferrer"
                class="release-link"
              >
                <GitHubIcon :size="14" />
                <span>{{ t('releaseDetail.openOnGitHub') }}</span>
                <ExternalLinkIcon :size="12" />
              </a>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-scroll {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-scroll :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.detail-scroll :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  flex: none;
  width: 72%;
}

.detail-scroll :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  flex: none;
  width: 28%;
  padding-right: 1rem;
}

.release-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.release-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.release-header__tag-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gitpulse-text-muted);
}

.release-header__tag-icon {
  flex-shrink: 0;
}

.release-header__tag-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-header__badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

.release-header__title {
  margin-bottom: 0;
  color: var(--gitpulse-text-strong);
  overflow-wrap: anywhere;
}

.release-header__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.release-header__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: auto;
  padding: 0;
  color: var(--gitpulse-link);
}

.release-header__repo span {
  overflow-wrap: anywhere;
}

.release-header__meta-separator {
  color: var(--gitpulse-text-muted);
  opacity: 0.5;
}

.release-header__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.release-header__branch {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
}

.release-divider {
  margin: 1.25rem 0;
}

.release-body {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.release-body__reactions {
  margin-top: 0.75rem;
}

.release-body__empty,
.release-sidebar__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.release-sidebar {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 1rem;
}

.release-sidebar__assets-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-card {
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: var(--gitpulse-accent);
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  letter-spacing: -0.01em;
}

.sidebar-card__count {
  font-size: 11px;
  color: var(--gitpulse-text-muted);
  padding: 2px 6px;
  background: var(--gitpulse-surface-muted);
  border-radius: 4px;
}

.sidebar-card__content {
  padding: 12px 14px;
}

.sidebar-card__content--scrollable {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;

  &:hover,
  &.sidebar-scroll--active {
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
    transition: background-color 0.3s ease;
  }

  &:hover::-webkit-scrollbar-thumb,
  &.sidebar-scroll--active::-webkit-scrollbar-thumb {
    background-color: var(--gitpulse-scrollbar-thumb);
  }
}

.release-sidebar__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--gitpulse-text-strong);
}

.release-sidebar__count {
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.release-assets {
  display: grid;
  gap: 0.5rem;
}

.release-asset {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  color: var(--gitpulse-text-strong);
  background: var(--gitpulse-surface);
  transition:
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-link);
    color: var(--gitpulse-link);
  }
}

.release-asset__icon {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.release-asset__content {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
  flex: 1;
}

.release-asset__name {
  overflow: hidden;
  font-weight: 600;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-asset__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.release-asset__size {
  color: var(--gitpulse-text-muted);
}

.release-asset__downloads {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--gitpulse-accent);
  font-weight: 500;
}

.release-archives {
  display: grid;
  gap: 0.5rem;
}

.release-archive {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  color: var(--gitpulse-text-strong);
  background: var(--gitpulse-surface);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
    color: var(--gitpulse-accent);
    background: var(--gitpulse-surface-hover);
  }
}

.release-archive__icon {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.release-archive__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-archive__external {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  opacity: 0.7;
}

.release-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
    color: var(--gitpulse-accent);
    background: var(--gitpulse-surface-hover);
  }
}

@media (max-width: 1024px) {
  .detail-scroll {
    overflow-y: auto;
  }

  .detail-scroll :deep(.columns) {
    display: block;
    height: auto;
  }

  .detail-scroll :deep(.detail-main-column),
  .detail-scroll :deep(.detail-sidebar-column) {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .detail-scroll :deep(.detail-sidebar-column) {
    padding-right: 0.75rem;
  }

  .release-sidebar {
    height: auto;
    overflow: visible;
  }

  .release-header__top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .release-header__badges {
    width: 100%;
  }
}
</style>
