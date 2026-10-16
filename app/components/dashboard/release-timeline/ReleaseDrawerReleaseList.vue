<script setup lang="ts">
import { Loader2Icon } from '@lucide/vue';
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseListItem } from '#shared/types/releases';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import ReleaseDrawerReleaseFilters, {
  type ReleaseTypeFilter,
} from '~/components/dashboard/release-timeline/ReleaseDrawerReleaseFilters.vue';
import ReleaseDrawerReleaseRows from '~/components/dashboard/release-timeline/ReleaseDrawerReleaseRows.vue';

const props = defineProps<{ entry: TimelineRelease }>();
const emit = defineEmits<{ select: [release: ReleaseListItem] }>();
const { t } = useI18n();
const scroller = useTemplateRef<HTMLElement>('scroller');
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
  <section ref="scroller" class="release-drawer-list">
    <h2 class="release-drawer-list__heading">{{ t('releasesPage.heading') }}</h2>
    <ReleaseDrawerReleaseFilters v-model="filter" />
    <div
      v-if="loading"
      class="release-drawer-list__message"
      role="status"
      :aria-label="t('releasesPage.loadingTitle')"
      aria-busy="true"
    >
      <Loader2Icon :size="22" aria-hidden="true" />
    </div>
    <div
      v-else-if="error"
      class="release-drawer-list__message release-drawer-list__error"
      role="alert"
    >
      <p>{{ t('releasesPage.error') }}</p>
      <p>{{ error }}</p>
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
      {{ t(items.length ? 'releasesPage.emptyFiltered' : 'releasesPage.empty') }}
    </p>
    <ReleaseDrawerReleaseRows
      v-else
      :items="visibleItems"
      :latest-id="latestId"
      :entry-id="entry.id"
      @select="emit('select', $event)"
    />
    <div :inert="loading">
      <DashboardPagination
        :pagination="pagination"
        current-page-only
        comfortable-hit-targets
        @change="changePage"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.release-drawer-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 1rem 1.15rem 1.35rem;
  overscroll-behavior: contain;
}
.release-drawer-list__heading {
  margin: 0 0 0.85rem;
  font-size: 1.1rem;
  font-weight: 650;
  color: var(--gitpulse-text-strong);
}
.release-drawer-list__message {
  display: flex;
  min-height: 10rem;
  align-items: center;
  justify-content: center;
  color: var(--gitpulse-text-muted);
}
.release-drawer-list__error {
  flex-direction: column;
  gap: 0.75rem;
  color: var(--gitpulse-danger);
}
</style>
