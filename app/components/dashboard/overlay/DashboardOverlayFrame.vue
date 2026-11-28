<template>
  <div class="detail-overlay">
    <div class="detail-container">
      <div class="detail-frame">
        <DashboardTopHeader
          v-if="!hideHeader"
          :back-label="backLabel"
          :home-label="homeLabel"
          :show-home-button="showHomeButton"
          :detail-summary="detailSummary"
          :show-detail-sidebar-toggle="showDetailSidebarToggle"
          :detail-sidebar-hidden="detailSidebarHidden"
          @toggle-detail-sidebar="$emit('toggle-detail-sidebar')"
          @back="$emit('back')"
          @home="$emit('home')"
        />

        <div v-if="loading" class="detail-loading">
          <div class="detail-loading__box shadow-md">
            <LoaderCircleIcon
              class="spin-animation detail-loading__spinner"
              :size="40"
              :stroke-width="2.5"
            />

            <p class="detail-loading__title">
              {{ loadingTitle }}
            </p>
            <p class="detail-loading__subtitle">{{ loadingSubtitle }}</p>
          </div>
        </div>

        <ScrollArea
          v-else
          :class="[
            'detail-frame__content',
            {
              'detail-frame__content--clipped': contentClipped,
              'detail-frame__content--unpadded': contentUnpadded,
            },
            contentClass,
          ]"
          :disabled="contentClipped || contentClass?.includes('is-flush')"
        >
          <slot />
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue';

import DashboardTopHeader from '~/components/dashboard/overlay/DashboardTopHeader.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';

interface DetailSummary {
  title?: string;
  number?: number | string;
  state?: string;
  stateReason?: string | null;
  stateTone?: 'open' | 'closed' | 'merged' | 'draft' | 'answered' | 'unanswered';
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
  contentClass?: string;
  contentClipped?: boolean;
  contentUnpadded?: boolean;
  hideHeader?: boolean;
  detailSummary?: DetailSummary | null;
  showDetailSidebarToggle?: boolean;
  detailSidebarHidden?: boolean;
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
  (e: 'toggle-detail-sidebar'): void;
}>();
</script>

<style scoped lang="scss">
.detail-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* The visible frame, not the layout viewport: on a phone with browser chrome
     the two differ, and the dashboard home frame already uses this unit. */
  height: var(--gitpulse-frame-height);
  background-color: var(--gitpulse-overlay-bg);
  z-index: 9999;
}

.detail-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.detail-frame {
  display: flex;
  flex-direction: column;
  position: relative;
  max-width: 100%;
  height: 100%;
  border-radius: 0;
  background-color: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  box-shadow: var(--gitpulse-shadow-card);
}

.detail-frame__content {
  flex-grow: 1;
  min-height: 0;
  padding: 2rem 4rem;
  background: var(--gitpulse-surface);

  &.p-0,
  &.detail-frame__content--unpadded {
    padding: 0;
  }

  &.detail-frame__content--clipped {
    overflow: hidden;
  }

  /* Same breakpoint as the mobile filter modal; the fixed 4rem side padding
     would otherwise eat ~128px of width on phones. */
  @media (max-width: 860px) {
    padding: 1.25rem 1.25rem 1.5rem;

    &.p-0,
    &.detail-frame__content--unpadded {
      padding: 0;
    }

    &.is-flush {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
    }
  }
}

.detail-loading {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-surface-muted);
}

.detail-loading__box {
  min-width: 200px;
  padding: 1.5rem 3rem;
  text-align: center;
  border-radius: var(--gitpulse-radius-xl);
  background-color: var(--gitpulse-surface);
  color: var(--gitpulse-text);
}

.detail-loading__spinner {
  color: var(--gitpulse-link);
  margin-bottom: 0.75rem;
}

.detail-loading__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
}

.detail-loading__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--gitpulse-text-muted);
}

.shadow-md {
  box-shadow: var(--gitpulse-shadow-raised);
}
</style>
