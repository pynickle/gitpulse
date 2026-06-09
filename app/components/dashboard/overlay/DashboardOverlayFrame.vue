<template>
  <div class="detail-overlay is-flex is-align-items-center is-justify-content-center">
    <div class="detail-container is-flex is-flex-direction-column">
      <div class="card is-flex is-flex-direction-column is-radiusless">
        <div v-if="!hideHeader" :class="['card-header', { 'is-not-sticky': nonStickyHeader }]">
          <div class="card-header-title detail-toolbar">
            <div class="buttons detail-toolbar__nav">
              <button class="button is-light is-small" @click="$emit('back')">
                <ArrowLeftIcon :size="18" class="mr-1" />
                {{ backLabel }}
              </button>
              <button v-if="showHomeButton" class="button is-light is-small" @click="$emit('home')">
                <HomeIcon :size="18" class="mr-1" />
                {{ homeLabel }}
              </button>
            </div>
            <div class="detail-toolbar__actions">
              <LinkIcon to="https://github.com/pynickle/gitpulse">
                <GitHubIcon class="is-centered" />
              </LinkIcon>
              <LanguageSwitcher />
              <ColorModeToggle />
            </div>
          </div>
        </div>

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
import { ArrowLeftIcon, HomeIcon, Loader2Icon } from 'lucide-vue-next';
import { GitHubIcon } from 'vue3-simple-icons';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';

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

.card-header {
  background-color: var(--gitpulse-surface-muted);
  border-bottom: 1px solid var(--gitpulse-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.card-header.is-not-sticky {
  position: static;
  z-index: auto;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
  padding: 0.4rem 0.75rem;
  gap: 0.75rem;
}

.detail-toolbar__nav {
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
}

.detail-toolbar__nav .button {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0;
}

.detail-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}

.detail-toolbar__actions :deep(.dropdown),
.detail-toolbar__actions :deep(.dropdown-trigger) {
  display: inline-flex;
  align-items: center;
}

.detail-toolbar__actions :deep(.dropdown-trigger .button) {
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
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
