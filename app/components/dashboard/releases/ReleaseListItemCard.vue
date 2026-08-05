<script setup lang="ts">
import {
  CalendarIcon,
  ChevronRightIcon,
  DownloadIcon,
  FlaskConicalIcon,
  PackageIcon,
  PencilLineIcon,
  RocketIcon,
} from '@lucide/vue';
import { computed, type Component } from 'vue';

import type { ReleaseListItem } from '#shared/types/releases';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

const props = withDefaults(
  defineProps<{
    release: ReleaseListItem;
    /** Full locale path to the release detail view. */
    to: string;
    /** Page-1 stable "Latest" badge (GitHub-aligned). */
    isLatest?: boolean;
    /** Featured hero card vs compact history row. */
    variant?: 'hero' | 'row';
  }>(),
  {
    isLatest: false,
    variant: 'row',
  }
);

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

const tagName = computed(() => props.release.tag_name || t('releaseDetail.untitled'));

/**
 * Show the human title only when it adds information beyond the tag
 * (avoids "Grok App v0.2.6" + "v0.2.6" redundancy).
 */
const secondaryName = computed(() => {
  const name = props.release.name?.trim() || '';
  if (!name) return '';
  if (name === props.release.tag_name) return '';
  return name;
});

const releasedAtLabel = computed(() => {
  const releasedAt = props.release.published_at || props.release.created_at || '';
  return releasedAt
    ? formatDurationFromNow(releasedAt, locale.value, relativeTimeNow.value)
    : t('releaseDetail.unpublished');
});

const compactFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      notation: 'compact',
      maximumFractionDigits: 1,
    })
);

const formatCount = (count: number) => {
  if (!Number.isFinite(count) || count <= 0) return '0';
  return compactFormatter.value.format(count);
};

const assetsCountLabel = computed(() => formatCount(props.release.assets_count));
const downloadCountLabel = computed(() => formatCount(props.release.download_count));

type StatusKind = 'latest' | 'prerelease' | 'draft';

interface StatusDescriptor {
  kind: StatusKind;
  label: string;
  icon: Component;
}

/** At most one primary status chip; Latest wins over draft/prerelease labels. */
const status = computed<StatusDescriptor | null>(() => {
  if (props.isLatest) {
    return {
      kind: 'latest',
      label: t('releasesPage.latest'),
      icon: RocketIcon,
    };
  }
  if (props.release.draft) {
    return {
      kind: 'draft',
      label: t('releaseDetail.draft'),
      icon: PencilLineIcon,
    };
  }
  if (props.release.prerelease) {
    return {
      kind: 'prerelease',
      label: t('releaseDetail.prerelease'),
      icon: FlaskConicalIcon,
    };
  }
  return null;
});

const itemClass = computed(() => [
  'release-list-item',
  `release-list-item--${props.variant}`,
  {
    'is-latest': props.isLatest,
    'is-prerelease': Boolean(props.release.prerelease) && !props.release.draft && !props.isLatest,
    'is-draft': Boolean(props.release.draft) && !props.isLatest,
  },
]);
</script>

<template>
  <NuxtLink :to="to" :class="itemClass">
    <div class="release-list-item__main">
      <div class="release-list-item__title-row">
        <span class="release-list-item__tag" :title="tagName">{{ tagName }}</span>

        <span v-if="status" class="release-status" :class="`release-status--${status.kind}`">
          <component :is="status.icon" :size="11" class="release-status__icon" aria-hidden="true" />
          <span class="release-status__label">{{ status.label }}</span>
        </span>
      </div>

      <p v-if="secondaryName" class="release-list-item__name">{{ secondaryName }}</p>

      <div class="release-list-item__meta">
        <span v-if="release.author?.login" class="release-list-item__meta-entry">
          <GitHubAvatar
            :src="release.author.avatar_url"
            :alt="release.author.login"
            :size="variant === 'hero' ? 18 : 16"
            class="release-list-item__avatar"
          />
          <span>{{ release.author.login }}</span>
        </span>

        <span class="release-list-item__meta-entry">
          <CalendarIcon :size="13" aria-hidden="true" />
          <span>{{ releasedAtLabel }}</span>
        </span>
      </div>
    </div>

    <div class="release-list-item__metrics" :aria-label="t('releasesPage.metricsLabel')">
      <div
        class="release-list-item__metric"
        :title="t('releaseDetail.assetCount', { count: release.assets_count })"
      >
        <span class="release-list-item__metric-label">
          <PackageIcon :size="12" aria-hidden="true" />
          {{ t('releaseDetail.assets') }}
        </span>
        <span class="release-list-item__metric-value">{{ assetsCountLabel }}</span>
      </div>
      <div
        class="release-list-item__metric"
        :title="t('releaseDetail.downloadCount', { count: release.download_count })"
      >
        <span class="release-list-item__metric-label">
          <DownloadIcon :size="12" aria-hidden="true" />
          {{ t('releasesPage.downloads') }}
        </span>
        <span class="release-list-item__metric-value">{{ downloadCountLabel }}</span>
      </div>
    </div>

    <ChevronRightIcon
      v-if="variant === 'hero'"
      :size="18"
      class="release-list-item__chevron"
      aria-hidden="true"
    />
  </NuxtLink>
</template>

<style scoped lang="scss">
.release-list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: inherit;
  border: 1px solid var(--gitpulse-border);
  border-radius: 0.75rem;
  background: var(--gitpulse-surface);
  text-decoration: none;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    border-color: color-mix(in srgb, var(--gitpulse-border) 70%, var(--gitpulse-text-muted));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-info);
    outline-offset: 2px;
  }

  &.is-latest {
    border-color: color-mix(in srgb, var(--gitpulse-success) 40%, var(--gitpulse-border));
    background: color-mix(in srgb, var(--gitpulse-success) 6%, var(--gitpulse-surface));

    &:hover {
      background: color-mix(in srgb, var(--gitpulse-success) 10%, var(--gitpulse-surface));
    }
  }

  &.is-prerelease {
    border-left: 2px solid color-mix(in srgb, var(--gitpulse-info) 70%, var(--gitpulse-border));
  }

  &.is-draft {
    border-style: dashed;
    opacity: 0.9;
  }
}

.release-list-item--hero {
  padding: 1.1rem 1.15rem;
  gap: 1.25rem;

  .release-list-item__tag {
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .release-list-item__name {
    font-size: 0.9rem;
    margin-top: 0.2rem;
  }

  .release-list-item__metric-value {
    font-size: 1.05rem;
  }
}

.release-list-item--row {
  padding: 0.7rem 0.9rem;
  gap: 0.85rem;

  .release-list-item__tag {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .release-list-item__name {
    font-size: 0.8rem;
    margin-top: 0.1rem;
  }
}

.release-list-item__main {
  min-width: 0;
  flex: 1;
}

.release-list-item__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
}

.release-list-item__tag {
  font-family: var(--gitpulse-code-font-family);
  color: var(--gitpulse-text-strong);
  overflow-wrap: anywhere;
  line-height: 1.25;
}

/* Compact status chip — replaces Bulma .tag pills. */
.release-status {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
  padding: 0.12rem 0.45rem 0.12rem 0.35rem;
  border: 1px solid transparent;
  border-radius: 0.35rem;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.release-status__icon {
  flex-shrink: 0;
}

.release-status--latest {
  color: var(--gitpulse-success);
  background: var(--gitpulse-success-soft);
  border-color: color-mix(in srgb, var(--gitpulse-success) 22%, transparent);
}

.release-status--prerelease {
  color: var(--gitpulse-info);
  background: var(--gitpulse-info-soft);
  border-color: color-mix(in srgb, var(--gitpulse-info) 22%, transparent);
}

.release-status--draft {
  color: var(--gitpulse-warning);
  background: var(--gitpulse-warning-soft);
  border-color: color-mix(in srgb, var(--gitpulse-warning) 22%, transparent);
}

.release-list-item__name {
  margin: 0;
  color: var(--gitpulse-text-muted);
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.release-list-item__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.85rem;
  margin-top: 0.4rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
}

.release-list-item__meta-entry {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  min-width: 0;
}

.release-list-item__avatar {
  border-radius: 50%;
  flex-shrink: 0;
}

.release-list-item__metrics {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  flex-shrink: 0;
}

.release-list-item__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.15rem;
  min-width: 3.5rem;
}

.release-list-item__metric-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.release-list-item__metric-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  line-height: 1.1;
  font-size: 0.95rem;
}

.release-list-item__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

@media (max-width: 640px) {
  .release-list-item {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .release-list-item__metrics {
    width: 100%;
    justify-content: flex-start;
    padding-top: 0.15rem;
  }

  .release-list-item__metric {
    align-items: flex-start;
    min-width: 4.25rem;
  }

  .release-list-item__chevron {
    display: none;
  }
}
</style>
