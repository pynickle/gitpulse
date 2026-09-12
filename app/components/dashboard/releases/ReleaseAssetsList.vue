<script setup lang="ts">
import { DownloadIcon } from '@lucide/vue';

import type { ReleaseAsset } from '#shared/types/releases';

const props = defineProps<{
  assets: readonly ReleaseAsset[];
}>();

const { locale, t } = useI18n();

const assetSizeLabel = (size: number) =>
  formatReleaseAssetSize(size) ?? t('releaseDetail.sizeUnknown');

const downloadCountLabel = (count: number) => formatCompactNumber(Math.max(0, count), locale.value);
</script>

<template>
  <div v-if="assets.length" class="release-assets-list">
    <a
      v-for="asset in assets"
      :key="asset.id"
      :href="asset.browser_download_url"
      target="_blank"
      rel="noopener noreferrer"
      class="release-assets-list__item"
    >
      <DownloadIcon :size="14" class="release-assets-list__icon" aria-hidden="true" />
      <span class="release-assets-list__content">
        <span class="release-assets-list__name">{{ asset.name }}</span>
        <span class="release-assets-list__meta">
          <span class="release-assets-list__size">{{ assetSizeLabel(asset.size) }}</span>
          <span class="release-assets-list__downloads">
            <DownloadIcon :size="10" aria-hidden="true" />
            <span>{{ downloadCountLabel(asset.download_count) }}</span>
          </span>
        </span>
      </span>
    </a>
  </div>
  <p v-else class="release-assets-list__empty">{{ t('releaseDetail.noAssets') }}</p>
</template>

<style scoped lang="scss">
.release-assets-list {
  display: grid;
  gap: 0.5rem;
}

.release-assets-list__item {
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
}

.release-assets-list__item:hover,
.release-assets-list__item:focus-visible {
  border-color: var(--gitpulse-link);
  color: var(--gitpulse-link);
}

.release-assets-list__icon {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.release-assets-list__content {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.15rem;
}

.release-assets-list__name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-assets-list__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.release-assets-list__size {
  color: var(--gitpulse-text-muted);
}

.release-assets-list__downloads {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--gitpulse-accent);
  font-weight: 500;
}

.release-assets-list__empty {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}
</style>
