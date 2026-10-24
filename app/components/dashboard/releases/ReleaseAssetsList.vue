<script setup lang="ts">
import { DownloadIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { ReleaseAsset } from '#shared/types/releases';

const props = defineProps<{
  assets: readonly ReleaseAsset[];
  /**
   * Prefixes every asset name repeats, such as `OpenLogi-v0.8.17`. Stripped from
   * the displayed stem so the discriminating tail stops hiding behind it. The
   * release header already shows the version, so nothing leaves the screen.
   */
  namePrefix?: readonly string[];
}>();

const { locale, t } = useI18n();

const sections = computed(() => {
  const { primary, sidecars } = groupReleaseAssets(props.assets);
  return [
    { kind: 'primary' as const, assets: primary, separated: false },
    // Nothing to separate from when a release ships only signatures.
    { kind: 'sidecar' as const, assets: sidecars, separated: primary.length > 0 },
  ].filter((section) => section.assets.length > 0);
});

const namePrefixes = computed(() => (props.namePrefix ?? []).map((prefix) => prefix.toLowerCase()));

const assetSizeLabel = (size: number) =>
  formatReleaseAssetSize(size) ?? t('releaseDetail.sizeUnknown');

const assetVisual = (asset: ReleaseAsset) => getReleaseAssetVisual(asset);

/**
 * The name without the type suffix, minus any release prefix the whole list
 * shares. The suffix is rendered next to it and never truncated, so a long
 * stem can ellipsise without taking the one distinguishing token with it.
 */
const assetStem = (asset: ReleaseAsset) => {
  const { suffix } = assetVisual(asset);
  const stem = suffix ? asset.name.slice(0, -(suffix.length + 1)) : asset.name;
  const lower = stem.toLowerCase();

  for (const prefix of namePrefixes.value) {
    for (const separator of ['-', '.', '_']) {
      const marker = `${prefix}${separator}`;
      if (lower.startsWith(marker)) return stem.slice(marker.length);
    }
  }

  return stem;
};

const downloadCountLabel = (count: number) => formatCompactNumber(Math.max(0, count), locale.value);
</script>

<template>
  <div v-if="sections.length" class="release-assets-list">
    <div
      v-for="section in sections"
      :key="section.kind"
      class="release-assets-list__section"
      :class="[
        `release-assets-list__section--${section.kind}`,
        { 'release-assets-list__section--separated': section.separated },
      ]"
      :role="section.kind === 'sidecar' ? 'group' : undefined"
      :aria-label="section.kind === 'sidecar' ? t('releaseDetail.assetSidecars') : undefined"
    >
      <a
        v-for="asset in section.assets"
        :key="asset.id"
        :href="asset.browser_download_url"
        target="_blank"
        rel="noopener noreferrer"
        class="release-assets-list__item"
        :class="`release-assets-list__item--${section.kind}`"
      >
        <component
          :is="assetVisual(asset).icon"
          :size="18"
          class="release-assets-list__icon"
          :class="`release-assets-list__icon--${assetVisual(asset).tone}`"
          aria-hidden="true"
        />
        <span class="release-assets-list__content">
          <span class="release-assets-list__name">
            <span class="release-assets-list__stem">{{ assetStem(asset) }}</span>
            <span v-if="assetVisual(asset).suffix" class="release-assets-list__suffix">
              .{{ assetVisual(asset).suffix }}
            </span>
          </span>
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
  </div>
  <p v-else class="release-assets-list__empty">{{ t('releaseDetail.noAssets') }}</p>
</template>

<style scoped lang="scss">
.release-assets-list {
  display: grid;
  gap: 0.5rem;
}

.release-assets-list__section {
  display: grid;
  gap: 0.5rem;

  &--sidecar {
    gap: 0.2rem;
  }

  // A group boundary, not decoration: what follows is a different kind of file —
  // signatures for the builds above — so it gets real space and a line that is
  // actually visible instead of a hint of one.
  &--separated {
    margin-top: 0.15rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--gitpulse-border-strong);
  }
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
    background-color 0.15s ease,
    color 0.15s ease;

  &--sidecar {
    padding: 0.4rem 0.5rem;
    border-color: transparent;
    background: transparent;

    .release-assets-list__name {
      font-weight: 500;
    }
  }
}

.release-assets-list__item:hover,
.release-assets-list__item:focus-visible {
  border-color: var(--gitpulse-link);
  color: var(--gitpulse-link);
}

// The flat rows need to answer the pointer too, but without pretending to be one
// of the cards above: hovering lifts a band rather than drawing a frame.
.release-assets-list__item--sidecar:hover,
.release-assets-list__item--sidecar:focus-visible {
  border-color: var(--gitpulse-border);
  background: var(--gitpulse-surface-hover);
}

.release-assets-list__icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);

  &--installer {
    color: var(--gitpulse-file-installer);
  }

  &--archive {
    color: var(--gitpulse-file-archive);
  }

  &--document {
    color: var(--gitpulse-file-document);
  }

  &--code {
    color: var(--gitpulse-file-code);
  }

  &--media {
    color: var(--gitpulse-file-media);
  }

  &--check {
    color: var(--gitpulse-file-check);
  }
}

.release-assets-list__content {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.15rem;
}

.release-assets-list__name {
  display: flex;
  overflow: hidden;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
}

.release-assets-list__stem {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-assets-list__suffix {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
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
