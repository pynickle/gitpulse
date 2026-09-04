<script setup lang="ts">
import { Loader2Icon, RefreshCwIcon, RocketIcon, SlidersHorizontalIcon } from '@lucide/vue';
import { computed, shallowRef, useTemplateRef } from 'vue';

import FloatingBackToTopButton from '~/components/dashboard/FloatingBackToTopButton.vue';
import ReleaseDrawer from '~/components/dashboard/release-timeline/ReleaseDrawer.vue';
import ReleaseTimelineFailureBanner from '~/components/dashboard/release-timeline/ReleaseTimelineFailureBanner.vue';
import ReleaseTimelineGrid from '~/components/dashboard/release-timeline/ReleaseTimelineGrid.vue';

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
const showGrid = computed(() => groups.value.length > 0);
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
</script>

<template>
  <div class="release-timeline">
    <div class="release-timeline__header">
      <h2 class="release-timeline__title">{{ t('releaseTimeline.title') }}</h2>
      <div class="release-timeline__actions">
        <button
          class="button is-ghost is-small release-timeline__reload"
          type="button"
          :aria-label="t('releaseTimeline.reload')"
          :title="t('releaseTimeline.reload')"
          @click="fetchTimeline"
        >
          <RefreshCwIcon
            :size="18"
            class="release-timeline__reload-icon"
            :class="{ 'spin-animation': loading }"
            aria-hidden="true"
          />
        </button>
        <button
          class="button is-ghost is-small release-timeline__manage"
          type="button"
          :aria-label="t('releaseTimeline.manage')"
          :title="t('releaseTimeline.manage')"
          @click="emit('manage')"
        >
          <SlidersHorizontalIcon v-once :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>

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

      <ReleaseTimelineGrid
        v-else-if="showGrid"
        ref="grid"
        :groups="groups"
        :scroll-locked="isOpen"
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

.release-timeline__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--gitpulse-border);
  min-width: 0;
}

.release-timeline__title {
  margin-bottom: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.release-timeline__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.release-timeline__manage,
.release-timeline__reload {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.release-timeline__manage:hover,
.release-timeline__manage:focus-visible,
.release-timeline__reload:hover,
.release-timeline__reload:focus-visible {
  color: var(--gitpulse-link);
  background: var(--gitpulse-info-soft);
}

.release-timeline__reload:hover .release-timeline__reload-icon:not(.spin-animation),
.release-timeline__reload:focus-visible .release-timeline__reload-icon:not(.spin-animation) {
  transform: rotate(15deg);
}

.release-timeline__reload-icon {
  transition: transform 0.2s ease;
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
