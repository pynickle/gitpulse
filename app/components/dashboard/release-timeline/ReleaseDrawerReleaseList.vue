<script setup lang="ts">
import { Loader2Icon, TagIcon } from '@lucide/vue';
import { computed, onMounted, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseListItem } from '#shared/types/releases';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import ReleaseDrawerReleaseFilters, {
  type ReleaseTypeFilter,
} from '~/components/dashboard/release-timeline/ReleaseDrawerReleaseFilters.vue';
import ReleaseDrawerReleaseRows from '~/components/dashboard/release-timeline/ReleaseDrawerReleaseRows.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';

const props = defineProps<{ entry: TimelineRelease }>();
const emit = defineEmits<{ select: [release: ReleaseListItem] }>();
const { t } = useI18n();
const scroller = shallowRef<HTMLElement | null>(null);
const { items, pagination, loading, error, fetchPage } = useRepoReleases();
const filter = shallowRef<ReleaseTypeFilter>('all');
const visibleItems = computed(() =>
  items.value.filter((release) => {
    switch (filter.value) {
      case 'stable':
        return !release.draft && !release.prerelease;
      case 'prerelease':
        return !release.draft && Boolean(release.prerelease);
      case 'draft':
        return Boolean(release.draft);
      default:
        return true;
    }
  })
);
const latestId = computed(() =>
  pagination.value.page === 1
    ? items.value.find((release) => !release.draft && !release.prerelease && release.published_at)
        ?.id
    : null
);
/** Empty state: no releases at all vs. none matching the active type filter. */
const emptyMessage = computed(() =>
  t(items.value.length ? 'releasesPage.emptyFiltered' : 'releasesPage.empty')
);
const loadPage = (page: number) =>
  fetchPage(props.entry.repository.owner, props.entry.repository.name, page);
const changePage = (page: number) => {
  if (loading.value) return;
  if (scroller.value) scroller.value.scrollTop = 0;
  void loadPage(page);
};
onMounted(() => {
  void loadPage(1);
});
</script>

<template>
  <ScrollArea @scroll-element="scroller = $event" class="release-drawer-list" axis="both">
    <header class="release-drawer-list__header">
      <h2 class="release-drawer-list__heading">
        <TagIcon :size="17" aria-hidden="true" />
        <span>{{ t('releasesPage.heading') }}</span>
      </h2>
      <ReleaseDrawerReleaseFilters v-model="filter" />
    </header>

    <div
      v-if="loading"
      class="release-drawer-list__message release-drawer-list__loading"
      role="status"
      :aria-label="t('releasesPage.loadingTitle')"
      aria-busy="true"
    >
      <Loader2Icon :size="22" class="release-drawer-list__spinner" aria-hidden="true" />
    </div>
    <div
      v-else-if="error"
      class="release-drawer-list__message release-drawer-list__error"
      role="alert"
    >
      <p>{{ t('releasesPage.error') }}</p>
      <p class="release-drawer-list__error-detail">{{ error }}</p>
      <button
        class="button is-small is-danger is-outlined release-drawer-list__retry"
        type="button"
        @click="loadPage(pagination.page)"
      >
        {{ t('releasesPage.retry') }}
      </button>
    </div>
    <p
      v-else-if="!visibleItems.length"
      class="release-drawer-list__message release-drawer-list__empty"
    >
      {{ emptyMessage }}
    </p>
    <ReleaseDrawerReleaseRows
      v-else
      :items="visibleItems"
      :latest-id="latestId"
      :entry-id="entry.id"
      @select="emit('select', $event)"
    />

    <div class="release-drawer-list__pagination" :inert="loading">
      <!-- Same rendering as the fullscreen Releases page: default compact pagination. -->
      <DashboardPagination :pagination="pagination" @change="changePage" />
    </div>
  </ScrollArea>
</template>

<style scoped lang="scss">
.release-drawer-list {
  min-height: 0;
  flex: 1;

  padding: 0 1.15rem;
  overscroll-behavior: contain;
}

/* Sticky toolbar: heading + type filters stay reachable while the list scrolls. */
.release-drawer-list__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin: 0 -1.15rem;
  padding: 1rem 1.15rem 0.8rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.release-drawer-list__heading {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--gitpulse-text-strong);
}

/* Flat states: the header and pagination already frame this area with
   dividers, so loading / empty / error stay plain centred text. */
.release-drawer-list__message {
  display: flex;
  min-height: 7.5rem;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.86rem;
  line-height: 1.55;
  text-align: center;
}

.release-drawer-list__message p {
  margin: 0;
  max-width: 26rem;
  overflow-wrap: anywhere;
}

.release-drawer-list__error {
  flex-direction: column;
  gap: 0.55rem;
  color: var(--gitpulse-danger);
}

.release-drawer-list__error-detail {
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.release-drawer-list__spinner {
  color: var(--gitpulse-accent);
  animation: release-drawer-list-spin 1s linear infinite;
}

@keyframes release-drawer-list-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Pinned to the bottom edge of the drawer's scrollport, like the fullscreen list. */
.release-drawer-list__pagination {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin: 0.35rem -1.15rem 0;
  padding: 0.7rem 1.15rem 0.85rem;
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}
</style>
