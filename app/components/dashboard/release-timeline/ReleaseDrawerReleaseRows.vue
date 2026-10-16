<script setup lang="ts">
import { computed } from 'vue';

import type { ReleaseListItem } from '#shared/types/releases';

const props = defineProps<{
  items: ReleaseListItem[];
  latestId: number | null | undefined;
  entryId: number;
}>();
const emit = defineEmits<{ select: [release: ReleaseListItem] }>();
const { t, locale } = useI18n();
const now = useRelativeTimeNow();
const rows = computed(() =>
  props.items.map((release) => {
    const time = release.published_at || release.created_at;
    return {
      release,
      name: release.name?.trim() && release.name.trim() !== release.tag_name ? release.name : null,
      status:
        release.id === props.latestId
          ? t('releasesPage.latest')
          : release.draft
            ? t('releaseDetail.draft')
            : release.prerelease
              ? t('releaseDetail.prerelease')
              : null,
      time,
      timeLabel: time
        ? formatDurationFromNow(time, locale.value, now.value)
        : t('releaseDetail.unpublished'),
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
      type="button"
      @click="emit('select', row.release)"
    >
      <span class="release-drawer-list__tag-row">
        <span class="release-drawer-list__tag">{{ row.release.tag_name }}</span>
        <span
          v-if="row.status"
          class="tag is-light release-drawer-list__status"
          :class="{
            'is-success': row.release.id === latestId,
            'is-warning': row.release.draft,
            'is-info': row.release.prerelease && !row.release.draft,
          }"
          >{{ row.status }}</span
        >
        <span v-if="row.release.id === entryId" class="tag is-light release-drawer-list__entry">{{
          t('releaseTimeline.entryRelease')
        }}</span>
      </span>
      <span v-if="row.name" class="release-drawer-list__name">{{ row.name }}</span>
      <time :datetime="row.time" class="release-drawer-list__time">{{ row.timeLabel }}</time>
    </button>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-list__row {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.9rem 0;
  border: 0;
  border-bottom: 1px solid var(--gitpulse-border);
  background: transparent;
  color: var(--gitpulse-text-strong);
  text-align: left;
  cursor: pointer;
}
.release-drawer-list__row:hover {
  background: var(--gitpulse-surface-hover);
}
.release-drawer-list__row:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}
.release-drawer-list__tag-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
}
.release-drawer-list__tag {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.release-drawer-list__name {
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.release-drawer-list__time {
  font-size: 0.78rem;
  color: var(--gitpulse-text-muted);
}
</style>
