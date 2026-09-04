<script setup lang="ts">
import { CalendarIcon, DownloadIcon, ExternalLinkIcon, PackageIcon, TagIcon } from '@lucide/vue';
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseAsset, ReleaseDetailPayload } from '#shared/types/releases';
import ReleaseTimelineReactionBar from '~/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = defineProps<{
  item: TimelineRelease;
  detail: ReleaseDetailPayload;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

const repoOwner = computed(() => props.item.repository.owner);
const repoName = computed(() => props.item.repository.name);
const releaseTitle = computed(
  () => props.detail.name?.trim() || props.detail.tag_name || props.item.title
);
const tagName = computed(() => props.detail.tag_name || props.item.tagName);
const isPrerelease = computed(() => Boolean(props.detail.prerelease || props.item.isPrerelease));
const releasedAt = computed(
  () => props.detail.published_at || props.item.publishedAt || props.detail.created_at || ''
);
const releasedAtLabel = computed(() =>
  releasedAt.value
    ? formatDurationFromNow(releasedAt.value, locale.value, relativeTimeNow.value)
    : t('releaseDetail.unpublished')
);
const body = computed(() => props.detail.body?.trim() || '');
const assets = computed<ReleaseAsset[]>(() => props.detail.assets ?? []);
const githubUrl = computed(() => props.detail.html_url || props.item.htmlUrl || '');
const author = computed(() => props.detail.author ?? null);

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
</script>

<template>
  <div class="release-drawer-body">
    <header class="release-drawer-body__header">
      <div class="release-drawer-body__tag-row">
        <span class="release-drawer-body__tag">
          <TagIcon :size="14" aria-hidden="true" />
          <span>{{ tagName }}</span>
        </span>
        <span v-if="isPrerelease" class="tag is-info is-light">
          {{ t('releaseDetail.prerelease') }}
        </span>
      </div>

      <p class="release-drawer-body__title">{{ releaseTitle }}</p>

      <div class="release-drawer-body__meta">
        <span v-if="author?.login" class="release-drawer-body__meta-item">
          <GitHubAvatar :src="author.avatar_url" :alt="author.login" :size="18" />
          <span>{{ author.login }}</span>
        </span>
        <span v-if="author?.login && releasedAt" class="release-drawer-body__separator">·</span>
        <span v-if="releasedAt" class="release-drawer-body__meta-item">
          <CalendarIcon :size="14" aria-hidden="true" />
          <span>{{ releasedAtLabel }}</span>
        </span>
      </div>
    </header>

    <article class="release-drawer-body__changelog">
      <MarkdownRenderer v-if="body" :value="body" :repo-owner="repoOwner" :repo-name="repoName" />
      <p v-else class="release-drawer-body__empty">{{ t('releaseDetail.noDescription') }}</p>
    </article>

    <ReleaseTimelineReactionBar :item="item" />

    <section class="release-drawer-body__section" :aria-label="t('releaseDetail.assets')">
      <div class="release-drawer-body__section-header">
        <span class="release-drawer-body__section-title">
          <PackageIcon :size="14" aria-hidden="true" />
          <span>{{ t('releaseDetail.assets') }}</span>
        </span>
        <span class="release-drawer-body__section-count">
          {{ t('releaseDetail.assetCount', { count: assets.length }) }}
        </span>
      </div>

      <div v-if="assets.length" class="release-drawer-body__assets">
        <a
          v-for="asset in assets"
          :key="asset.id"
          class="release-drawer-body__asset"
          :href="asset.browser_download_url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <DownloadIcon :size="14" aria-hidden="true" />
          <span class="release-drawer-body__asset-copy">
            <span class="release-drawer-body__asset-name">{{ asset.name }}</span>
            <span class="release-drawer-body__asset-meta">
              <span>{{ formatAssetSize(asset.size) }}</span>
              <span>
                {{ t('releaseDetail.downloadCount', { count: asset.download_count }) }}
              </span>
            </span>
          </span>
        </a>
      </div>
      <p v-else class="release-drawer-body__empty">{{ t('releaseDetail.noAssets') }}</p>
    </section>

    <a
      v-if="githubUrl"
      class="release-drawer-body__github"
      :href="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <GitHubIcon :size="14" aria-hidden="true" />
      <span>{{ t('releaseDetail.openOnGitHub') }}</span>
      <ExternalLinkIcon :size="12" aria-hidden="true" />
    </a>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.15rem;
}

.release-drawer-body__header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
}

.release-drawer-body__tag-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.release-drawer-body__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  font-weight: 650;
}

.release-drawer-body__title {
  margin: 0;
  color: var(--gitpulse-text-strong);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.release-drawer-body__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.5rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
}

.release-drawer-body__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.release-drawer-body__separator {
  opacity: 0.5;
}

.release-drawer-body__changelog {
  min-width: 0;
  overflow-wrap: anywhere;
}

.release-drawer-body__empty {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.88rem;
}

.release-drawer-body__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
}

.release-drawer-body__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.release-drawer-body__section-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-strong);
  font-size: 0.85rem;
  font-weight: 650;
}

.release-drawer-body__section-count {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.release-drawer-body__assets {
  display: grid;
  gap: 0.45rem;
}

.release-drawer-body__asset {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted, var(--gitpulse-surface));
  color: var(--gitpulse-text-strong);
}

.release-drawer-body__asset:hover,
.release-drawer-body__asset:focus-visible {
  border-color: var(--gitpulse-link);
  color: var(--gitpulse-link);
}

.release-drawer-body__asset-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.15rem;
}

.release-drawer-body__asset-name {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-drawer-body__asset-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.7rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.7rem;
}

.release-drawer-body__github {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted, var(--gitpulse-surface));
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.release-drawer-body__github:hover,
.release-drawer-body__github:focus-visible {
  border-color: var(--gitpulse-border-strong, var(--gitpulse-link));
  color: var(--gitpulse-accent, var(--gitpulse-link));
}
</style>
