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

const props = defineProps<{
  items: ReleaseListItem[];
  latestId: number | null | undefined;
  entryId: number;
}>();
const emit = defineEmits<{ select: [release: ReleaseListItem] }>();
const { t, locale } = useI18n();
const now = useRelativeTimeNow();

type StatusKind = 'latest' | 'prerelease' | 'draft';

interface StatusDescriptor {
  kind: StatusKind;
  label: string;
  icon: Component;
}

interface RowView {
  release: ReleaseListItem;
  status: StatusDescriptor | null;
  isEntry: boolean;
  name: string | null;
  author: ReleaseListItem['author'];
  time?: string;
  timeLabel: string;
  assetsLabel: string;
  downloadsLabel: string;
  assetsValue: string;
  downloadsValue: string;
}

const rows = computed<RowView[]>(() =>
  props.items.map((release) => {
    const time = release.published_at || release.created_at;
    const name = release.name?.trim() || '';
    return {
      release,
      status:
        release.id === props.latestId
          ? { kind: 'latest', label: t('releasesPage.latest'), icon: RocketIcon }
          : release.draft
            ? { kind: 'draft', label: t('releaseDetail.draft'), icon: PencilLineIcon }
            : release.prerelease
              ? { kind: 'prerelease', label: t('releaseDetail.prerelease'), icon: FlaskConicalIcon }
              : null,
      isEntry: release.id === props.entryId,
      name: name && name !== release.tag_name ? name : null,
      author: release.author ?? null,
      time,
      timeLabel: time
        ? formatDurationFromNow(time, locale.value, now.value)
        : t('releaseDetail.unpublished'),
      assetsLabel: t('releaseDetail.assetCount', { count: release.assets_count || 0 }),
      downloadsLabel: t('releaseDetail.downloadCount', { count: release.download_count || 0 }),
      assetsValue: formatCompactNumber(Math.max(0, release.assets_count || 0), locale.value),
      downloadsValue: formatCompactNumber(Math.max(0, release.download_count || 0), locale.value),
    };
  })
);
</script>

<template>
  <div class="release-drawer-list__rows">
    <button
      v-for="row in rows"
      :key="row.release.id"
      class="release-drawer-list__row"
      :class="{
        'is-latest': row.status?.kind === 'latest',
        'is-prerelease': row.status?.kind === 'prerelease',
        'is-draft': row.status?.kind === 'draft',
        'is-entry': row.isEntry,
      }"
      type="button"
      @click="emit('select', row.release)"
    >
      <span class="release-drawer-list__main">
        <span class="release-drawer-list__title-row">
          <span class="release-drawer-list__tag" :title="row.release.tag_name">
            {{ row.release.tag_name }}
          </span>
          <span
            v-if="row.status"
            class="release-drawer-list__status"
            :class="`release-drawer-list__status--${row.status.kind}`"
          >
            <component :is="row.status.icon" :size="11" aria-hidden="true" />
            <span>{{ row.status.label }}</span>
          </span>
        </span>

        <span v-if="row.name" class="release-drawer-list__name">{{ row.name }}</span>

        <span class="release-drawer-list__meta">
          <span v-if="row.author?.login" class="release-drawer-list__meta-entry">
            <GitHubAvatar
              :src="row.author.avatar_url"
              :alt="row.author.login"
              :size="15"
              class="release-drawer-list__avatar"
            />
            <span>{{ row.author.login }}</span>
          </span>
          <span class="release-drawer-list__meta-entry">
            <CalendarIcon :size="13" aria-hidden="true" />
            <time :datetime="row.time">{{ row.timeLabel }}</time>
          </span>
          <span class="release-drawer-list__metrics" :aria-label="t('releasesPage.metricsLabel')">
            <span class="release-drawer-list__metric" :title="row.assetsLabel">
              <PackageIcon :size="13" aria-hidden="true" />
              <span>{{ row.assetsValue }}</span>
            </span>
            <span class="release-drawer-list__metric" :title="row.downloadsLabel">
              <DownloadIcon :size="13" aria-hidden="true" />
              <span>{{ row.downloadsValue }}</span>
            </span>
          </span>
        </span>

        <!-- Wordless entry marker on the row; kept for assistive tech and tests. -->
        <span v-if="row.isEntry" class="release-drawer-list__entry">
          {{ t('releaseTimeline.entryRelease') }}
        </span>
      </span>

      <ChevronRightIcon :size="16" class="release-drawer-list__chevron" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-list__rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.85rem;
  padding-bottom: 0.35rem;
}

.release-drawer-list__row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 0.75rem;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    border-color: color-mix(in srgb, var(--gitpulse-border) 70%, var(--gitpulse-text-muted));

    .release-drawer-list__chevron {
      color: var(--gitpulse-text-strong);
    }
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
    opacity: 0.92;
  }

  /* Entry release: wordless accent rail + tint instead of a label chip. */
  &.is-entry {
    box-shadow: inset 3px 0 0 var(--gitpulse-link);
    background: color-mix(in srgb, var(--gitpulse-link) 5%, var(--gitpulse-surface));

    &:hover {
      background: color-mix(in srgb, var(--gitpulse-link) 8%, var(--gitpulse-surface-hover));
    }
  }
}

.release-drawer-list__main {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
}

.release-drawer-list__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.45rem;
  min-width: 0;
}

.release-drawer-list__tag {
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.25;
  color: var(--gitpulse-text-strong);
  overflow-wrap: anywhere;
}

/* Compact status chip — mirrors the fullscreen release list treatment. */
.release-drawer-list__status {
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

.release-drawer-list__status--latest {
  color: var(--gitpulse-success);
  background: var(--gitpulse-success-soft);
  border-color: color-mix(in srgb, var(--gitpulse-success) 22%, transparent);
}

.release-drawer-list__status--prerelease {
  color: var(--gitpulse-info);
  background: var(--gitpulse-info-soft);
  border-color: color-mix(in srgb, var(--gitpulse-info) 22%, transparent);
}

.release-drawer-list__status--draft {
  color: var(--gitpulse-warning);
  background: var(--gitpulse-warning-soft);
  border-color: color-mix(in srgb, var(--gitpulse-warning) 22%, transparent);
}

/* Entry marker: a wordless accent on the row, not a second badge.
   The label stays in the DOM, visually hidden, so assistive tech still
   announce it while the card keeps a calm, text-free surface. */
.release-drawer-list__entry {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.release-drawer-list__name {
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--gitpulse-text-muted);
  overflow-wrap: anywhere;
}

.release-drawer-list__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.75rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.release-drawer-list__meta-entry {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  white-space: nowrap;
}

.release-drawer-list__avatar {
  border-radius: 50%;
  flex-shrink: 0;
}

.release-drawer-list__metrics {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}

.release-drawer-list__metric {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
}

.release-drawer-list__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition: color 0.12s ease;
}
</style>
