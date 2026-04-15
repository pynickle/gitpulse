<template>
  <div class="detail-overlay is-flex is-align-items-center is-justify-content-center">
    <div class="detail-container is-flex is-flex-direction-column">
      <div class="card is-flex is-flex-direction-column is-radiusless">
        <div :class="['card-header', { 'is-not-sticky': nonStickyHeader }]">
          <div
            class="card-header-title is-flex is-justify-content-space-between is-align-items-center"
          >
            <div class="buttons">
              <button class="button is-light is-small" @click="$emit('back')">
                <ArrowLeftIcon :size="18" class="mr-1" />
                {{ backLabel }}
              </button>
              <button v-if="showHomeButton" class="button is-light is-small" @click="$emit('home')">
                <HomeIcon :size="18" class="mr-1" />
                {{ homeLabel }}
              </button>
            </div>
            <LanguageSwitcher />
          </div>
        </div>

        <div
          v-if="loading"
          class="is-overlay is-flex is-flex-direction-column is-justify-content-center is-align-items-center has-background-white-ter"
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

        <div
          v-else
          :class="['card-content', 'is-flex-grow-1', 'has-background-white', contentClass]"
        >
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, HomeIcon, Loader2Icon } from 'lucide-vue-next';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';

defineProps<{
  loading: boolean;
  loadingTitle: string;
  loadingSubtitle: string;
  backLabel: string;
  homeLabel: string;
  showHomeButton: boolean;
  nonStickyHeader?: boolean;
  contentClass?: string;
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
  background-color: rgba(0, 0, 0, 0.8);
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

.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #eaecef;
  position: sticky;
  top: 0;
  z-index: 10;
}

.card-header.is-not-sticky {
  position: static;
  z-index: auto;
}

.card-content {
  min-height: 0;
  padding: 2rem 8rem;
  overflow-y: auto;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.shadow-md {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
