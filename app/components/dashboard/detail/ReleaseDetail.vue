<script setup lang="ts">
import {
  CalendarIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  GitBranchIcon,
  PackageIcon,
  TagIcon,
} from '@lucide/vue';
import { computed, watch } from 'vue';

import type { ReleaseAsset, ReleaseDetailPayload } from '#shared/types/releases';
import DetailSidebarColumn from '~/components/dashboard/detail/DetailSidebarColumn.vue';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import ReleaseAssetsList from '~/components/dashboard/releases/ReleaseAssetsList.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import { useDetailOverlayChrome } from '~/composables/useDetailOverlayChrome';
import { formatPageMetaDescription } from '~/utils/formatPageMetaDescription';

const { release } = defineProps<{
  release: ReleaseDetailPayload;
  detailSidebarHidden?: boolean;
}>();

const { locale, t } = useI18n();
const { openRepository } = useDashboardRepositoryNavigation();
const relativeTimeNow = useRelativeTimeNow();
const detailOverlayChrome = useDetailOverlayChrome();

const repoInfo = computed(() => parseGitHubRepoPath(release.repository_url));
const repoOwner = computed(() => repoInfo.value?.owner ?? '');
const repoName = computed(() => repoInfo.value?.repo ?? '');

const releaseTitle = computed(() => {
  return release.name?.trim() || release.tag_name || t('releaseDetail.untitled');
});

const releasedAt = computed(() => release.published_at || release.created_at || '');

const releasedAtLabel = computed(() => {
  return releasedAt.value
    ? formatDurationFromNow(releasedAt.value, locale.value, relativeTimeNow.value)
    : t('releaseDetail.unpublished');
});

const body = computed(() => release.body?.trim() || '');

const assets = computed<ReleaseAsset[]>(() => release.assets ?? []);

watch(
  () => assets.value.length,
  (assetCount) => {
    if (!detailOverlayChrome) return;
    detailOverlayChrome.setReleaseSummary({ assetCount });
  },
  { immediate: true }
);

// The header above already names the tag, so asset names can shed the prefix
// they all repeat and leave the part that actually tells them apart.
const assetNamePrefix = computed(() => getReleaseAssetNamePrefix(repoName.value, release.tag_name));

const archiveLinks = computed(() =>
  [
    {
      label: t('releaseDetail.sourceZip'),
      href: release.zipball_url,
      icon: FileArchiveIcon,
    },
    {
      label: t('releaseDetail.sourceTar'),
      href: release.tarball_url,
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
  <ScrollArea class="release-detail detail-scroll" media="(max-width: 1024px)">
    <div class="columns" :class="{ 'columns--detail-sidebar-hidden': detailSidebarHidden }">
      <ScrollArea class="column detail-main-column" media="(min-width: 1025px)">
        <header class="release-header">
          <div class="detail-header-eyebrow release-header__eyebrow">
            <a
              class="header-repo__link release-header__repo"
              href="#"
              @click.prevent="handleRepoClick"
            >
              <GitHubIcon :size="14" class="header-repo__icon" aria-hidden="true" />
              <span>{{ repoOwner }}/{{ repoName }}</span>
            </a>

            <span class="release-header__meta-separator" aria-hidden="true">·</span>

            <span class="release-header__tag-row">
              <TagIcon :size="14" class="release-header__tag-icon" aria-hidden="true" />
              <span class="release-header__tag-name">{{ release.tag_name }}</span>
            </span>
          </div>

          <div class="detail-header-title">
            <h1 class="title is-3 mb-0 header-title__text release-header__title">
              {{ releaseTitle }}
            </h1>
          </div>

          <div class="release-header__meta">
            <span v-if="release.draft" class="tag is-warning is-light">
              {{ t('releaseDetail.draft') }}
            </span>
            <span v-if="release.prerelease" class="tag is-info is-light">
              {{ t('releaseDetail.prerelease') }}
            </span>
            <span v-if="release.target_commitish" class="tag release-header__branch">
              <GitBranchIcon :size="13" aria-hidden="true" />
              <span>{{ release.target_commitish }}</span>
            </span>

            <span class="release-header__meta-item">
              <CalendarIcon :size="14" aria-hidden="true" />
              <span>{{ releasedAtLabel }}</span>
            </span>

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
          :can-react="release.canReact"
          initial-items-include-viewer-state
        />
      </ScrollArea>

      <DetailSidebarColumn :hidden="detailSidebarHidden">
        <div class="release-sidebar">
          <section
            class="sidebar-card"
            :class="{ 'release-sidebar__assets-card': assets.length > 0 }"
          >
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <PackageIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ t('releaseDetail.assets') }}</span>
              </div>
              <span v-if="assets.length" class="sidebar-card__count">
                {{ t('releaseDetail.assetCount', { count: assets.length }) }}
              </span>
            </div>
            <ScrollArea
              class="sidebar-card__content"
              :class="{ 'sidebar-card__content--scrollable sidebar-scroll': assets.length > 0 }"
              :disabled="assets.length === 0"
              media="(min-width: 1025px)"
            >
              <ReleaseAssetsList :assets="assets" :name-prefix="assetNamePrefix" />
            </ScrollArea>
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

          <a
            v-if="release.html_url"
            :href="release.html_url"
            target="_blank"
            rel="noopener noreferrer"
            class="sidebar-github-link"
          >
            <GitHubIcon :size="14" aria-hidden="true" />
            <span>{{ t('detailActions.viewOnGithub') }}</span>
            <ExternalLinkIcon :size="12" aria-hidden="true" />
          </a>
        </div>
      </DetailSidebarColumn>
    </div>
  </ScrollArea>
</template>

<style scoped lang="scss">
@use '~/assets/scss/detail-header' as *;
@use '~/assets/scss/detail-sidebar-columns' as *;
@use '~/assets/scss/pointer' as *;
@use '~/assets/scss/sidebar-github-link' as *;

@include detail-header-shared;

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
}

.release-header__eyebrow {
  margin-bottom: 0.45rem;
}

.release-header__tag-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex: 0 1 auto;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--gitpulse-text-muted);
}

.release-header__tag-icon {
  flex-shrink: 0;
}

.release-header__tag-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: 0.4rem 0.6rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8125rem;
}

.release-header__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 1 auto;
  min-width: 0;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.release-header__meta-separator {
  flex: none;
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
  margin: 0.85rem 0 1.25rem;
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

  @include hover-only {
    &:hover {
      border-color: var(--gitpulse-border-strong);
      color: var(--gitpulse-accent);
      background: var(--gitpulse-surface-hover);
    }
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

@include sidebar-github-link;

@include detail-sidebar-stacking('.detail-scroll');

@media (max-width: 1024px) {
  .release-sidebar {
    height: auto;
    overflow: visible;
  }
}
</style>
