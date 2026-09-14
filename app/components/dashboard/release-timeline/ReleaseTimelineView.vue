<script setup lang="ts">
import { Loader2Icon, RocketIcon } from '@lucide/vue';
import { computed, shallowRef, useTemplateRef } from 'vue';

import FloatingBackToTopButton from '~/components/dashboard/FloatingBackToTopButton.vue';
import ReleaseDrawer from '~/components/dashboard/release-timeline/ReleaseDrawer.vue';
import ReleaseTimelineFailureBanner from '~/components/dashboard/release-timeline/ReleaseTimelineFailureBanner.vue';
import ReleaseTimelineGrid from '~/components/dashboard/release-timeline/ReleaseTimelineGrid.vue';
import ReleaseTimelineHeader from '~/components/dashboard/release-timeline/ReleaseTimelineHeader.vue';

const { showTitle = true, showReload = true } = defineProps<{
  showTitle?: boolean;
  showReload?: boolean;
}>();

const emit = defineEmits<{
  manage: [];
}>();

const { t } = useI18n();
const {
  loaded,
  groups,
  loading,
  error,
  hasFollows,
  hasLookupFailures,
  unavailableRepos,
  transientRepos,
  fetchTimeline,
} = useReleaseTimeline();
const {
  openItem,
  detail,
  loading: drawerLoading,
  error: drawerError,
  isOpen,
  open: openDrawer,
  close: closeDrawer,
  retry: retryDrawer,
} = useReleaseDrawer();

const gridRef = useTemplateRef<{ scrollToTop: () => void }>('grid');
const scrollTop = shallowRef(0);
const viewportHeight = shallowRef(0);
const searchQuery = shallowRef('');
const visibleGroups = computed(() =>
  filterReleaseTimelineGroupsByTitle(groups.value, searchQuery.value)
);

const showFollowsEmpty = computed(() => loaded.value && !hasFollows.value);
const showLoading = computed(
  () => !showFollowsEmpty.value && loading.value && groups.value.length === 0 && !error.value
);
const showFailureBanner = computed(() => !showFollowsEmpty.value && hasLookupFailures.value);
const showError = computed(
  () =>
    !showFollowsEmpty.value &&
    groups.value.length === 0 &&
    Boolean(error.value) &&
    !showFailureBanner.value
);
const showReleasesEmpty = computed(
  () =>
    loaded.value &&
    hasFollows.value &&
    !loading.value &&
    !error.value &&
    !showFailureBanner.value &&
    groups.value.length === 0
);
const showSearchEmpty = computed(() => groups.value.length > 0 && visibleGroups.value.length === 0);
const showGrid = computed(() => visibleGroups.value.length > 0);
const showBackToTop = computed(
  () =>
    showGrid.value &&
    !isOpen.value &&
    shouldShowReleaseTimelineBackToTop(scrollTop.value, viewportHeight.value)
);

const handleViewportScroll = (viewport: { scrollTop: number; viewportHeight: number }) => {
  scrollTop.value = viewport.scrollTop;
  viewportHeight.value = viewport.viewportHeight;
};

const scrollTimelineToTop = () => {
  gridRef.value?.scrollToTop();
};

defineExpose({
  reload: fetchTimeline,
});
</script>

<template>
  <div class="release-timeline">
    <ReleaseTimelineHeader
      v-model="searchQuery"
      :loading="loading"
      :show-title="showTitle"
      :show-reload="showReload"
      @reload="fetchTimeline"
      @manage="emit('manage')"
    />

    <ReleaseTimelineFailureBanner
      v-if="showFailureBanner"
      :unavailable-repos="unavailableRepos"
      :transient-repos="transientRepos"
      @retry="fetchTimeline"
      @manage="emit('manage')"
    />

    <div class="release-timeline__body">
      <div v-if="showFollowsEmpty" class="release-timeline__empty">
        <div class="release-timeline__empty-icon" aria-hidden="true">
          <RocketIcon :size="32" />
        </div>
        <p class="release-timeline__empty-title">{{ t('releaseTimeline.emptyTitle') }}</p>
        <p class="release-timeline__empty-description">
          {{ t('releaseTimeline.emptyDescription') }}
        </p>
        <button class="button is-primary is-small" type="button" @click="emit('manage')">
          {{ t('releaseTimeline.emptyAction') }}
        </button>
      </div>

      <div
        v-else-if="showLoading"
        class="release-timeline__status"
        role="status"
        :aria-label="t('releaseTimeline.loading')"
        aria-busy="true"
      >
        <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
      </div>

      <div v-else-if="showError" class="release-timeline__status release-timeline__status--error">
        <p class="release-timeline__empty-title">{{ t('releaseTimeline.error') }}</p>
        <button class="button is-small is-danger is-outlined" type="button" @click="fetchTimeline">
          {{ t('releaseTimeline.retry') }}
        </button>
      </div>

      <div v-else-if="showReleasesEmpty" class="release-timeline__empty">
        <p class="release-timeline__empty-title">{{ t('releaseTimeline.emptyReleasesTitle') }}</p>
        <p class="release-timeline__empty-description">
          {{ t('releaseTimeline.emptyReleasesDescription') }}
        </p>
      </div>

      <div v-else-if="showSearchEmpty" class="release-timeline__empty">
        <p class="release-timeline__empty-title">{{ t('releaseTimeline.emptySearchTitle') }}</p>
        <p class="release-timeline__empty-description">
          {{ t('releaseTimeline.emptySearchDescription') }}
        </p>
      </div>

      <ReleaseTimelineGrid
        v-else-if="showGrid"
        ref="grid"
        :groups="visibleGroups"
        @open="openDrawer"
        @viewport-scroll="handleViewportScroll"
      />
    </div>

    <ReleaseDrawer
      :open="isOpen"
      :item="openItem"
      :detail="detail"
      :loading="drawerLoading"
      :error="drawerError"
      @close="closeDrawer"
      @retry="retryDrawer"
    />

    <FloatingBackToTopButton
      :visible="showBackToTop"
      :label="t('releaseTimeline.backToTop')"
      @activate="scrollTimelineToTop"
    />
  </div>
</template>

<style scoped lang="scss">
.release-timeline {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  flex: 1;
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md, 12px);
}

.release-timeline__body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.release-timeline__empty,
.release-timeline__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 12rem;
  padding: clamp(1.5rem, 6vh, 4rem) clamp(1rem, 5vw, 3rem);
  text-align: center;
}

.release-timeline__empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  background-color: var(--gitpulse-info-soft, var(--gitpulse-surface-muted));
  color: var(--gitpulse-accent, var(--gitpulse-link));
}

.release-timeline__empty-title {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
}

.release-timeline__empty-description {
  margin: 0 0 1.25rem;
  max-width: 26rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}

.release-timeline__status--error .release-timeline__empty-title {
  margin-bottom: 0.85rem;
}

.spin-animation {
  animation: release-timeline-spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes release-timeline-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
