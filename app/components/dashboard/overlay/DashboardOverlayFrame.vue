<template>
  <div class="detail-overlay is-flex is-align-items-center is-justify-content-center">
    <div class="detail-container is-flex is-flex-direction-column">
      <div class="card is-flex is-flex-direction-column is-radiusless">
        <DashboardTopHeader
          v-if="!hideHeader"
          :back-label="backLabel"
          :home-label="homeLabel"
          :show-home-button="showHomeButton"
          :non-sticky="nonStickyHeader"
          :detail-summary="detailSummary"
          @back="$emit('back')"
          @home="$emit('home')"
        />

        <div
          v-if="loading"
          class="detail-loading is-overlay is-flex is-flex-direction-column is-justify-content-center is-align-items-center"
          style="z-index: 10"
        >
          <div class="box has-text-centered py-5 px-6 shadow-md" style="min-width: 200px">
            <Loader2Icon class="spin-animation has-text-link mb-3" :size="40" :stroke-width="2.5" />

            <p class="is-size-6 has-text-weight-semibold has-text-grey-dark">
              {{ loadingTitle }}
            </p>
            <p class="is-size-7 has-text-grey-light mt-1">{{ loadingSubtitle }}</p>
          </div>
        </div>

        <div v-else :class="['card-content', 'is-flex-grow-1', contentClass]">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2Icon } from '@lucide/vue';

import DashboardTopHeader from '~/components/dashboard/overlay/DashboardTopHeader.vue';

interface DetailSummary {
  title?: string;
  number?: number | string;
  state?: string;
  stateTone?: 'open' | 'closed' | 'merged' | 'answered' | 'unanswered';
  subjectType?: 'issue' | 'pull-request' | 'discussion';
  visible?: boolean;
}

defineProps<{
  loading: boolean;
  loadingTitle: string;
  loadingSubtitle: string;
  backLabel: string;
  homeLabel: string;
  showHomeButton: boolean;
  nonStickyHeader?: boolean;
  contentClass?: string;
  hideHeader?: boolean;
  detailSummary?: DetailSummary | null;
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
}>();
</script>

<style scoped lang="scss">
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--gitpulse-overlay-bg);
  z-index: 9999;
}

.detail-container {
  width: 100%;
  height: 100%;
  max-height: 100vh;
  overflow: hidden;
}

.card {
  height: 100%;
}

.card-content {
  min-height: 0;
  padding: 2rem 4rem;
  overflow-y: auto;
  background: var(--gitpulse-surface);
}

.detail-loading {
  background: var(--gitpulse-surface-muted);
}

.spin-animation {
  animation: spin 1s linear infinite;
}

.shadow-md {
  box-shadow: var(--gitpulse-shadow-raised);
}
</style>
