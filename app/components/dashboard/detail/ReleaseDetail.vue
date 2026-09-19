<script setup lang="ts">
import {
  CalendarIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  GitBranchIcon,
  PackageIcon,
  TagIcon,
} from '@lucide/vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { ReleaseAsset, ReleaseDetailPayload } from '#shared/types/releases';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import ReleaseAssetsList from '~/components/dashboard/releases/ReleaseAssetsList.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import formatPageMetaDescription from '~/utils/formatPageMetaDescription';

const props = defineProps<{
  release: ReleaseDetailPayload;
  detailSidebarHidden?: boolean;
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
    <div class="columns" :class="{ 'columns--detail-sidebar-hidden': detailSidebarHidden }">
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

      <aside class="column detail-sidebar-column" :inert="detailSidebarHidden || undefined">
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
              class="sidebar-card__content sidebar-card__content--scrollable sidebar-scroll"
              :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
              @scroll="onSidebarScroll"
            >
              <ReleaseAssetsList :assets="assets" />
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
@use '~/assets/scss/detail-sidebar-columns' as *;

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

@include detail-sidebar-columns('.detail-scroll');

.detail-scroll :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  min-width: 0;
}

.detail-scroll :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
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

.release-body__empty {
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

@include detail-sidebar-stacking('.detail-scroll');

@media (max-width: 1024px) {
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
