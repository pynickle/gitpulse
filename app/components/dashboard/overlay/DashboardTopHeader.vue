<template>
  <div :class="['dashboard-top-header', { 'is-not-sticky': nonSticky }]">
    <div class="card-header-title dashboard-top-header__toolbar">
      <div class="buttons dashboard-top-header__nav">
        <button class="button is-light is-small" @click="$emit('back')">
          <ArrowLeftIcon :size="18" class="mr-1" />
          {{ backLabel }}
        </button>
        <button v-if="showHomeButton" class="button is-light is-small" @click="$emit('home')">
          <HomeIcon :size="18" class="mr-1" />
          {{ homeLabel }}
        </button>
      </div>
      <div class="dashboard-top-header__actions">
        <LinkIcon to="https://github.com/pynickle/gitpulse">
          <GitHubIcon class="is-centered" />
        </LinkIcon>
        <LanguageSwitcher />
        <ColorModeToggle />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, HomeIcon } from 'lucide-vue-next';
import { GitHubIcon } from 'vue3-simple-icons';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';

defineProps<{
  backLabel: string;
  homeLabel: string;
  showHomeButton: boolean;
  nonSticky?: boolean;
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
}>();
</script>

<style scoped lang="scss">
.dashboard-top-header {
  background-color: var(--gitpulse-surface-muted);
  border-bottom: 1px solid var(--gitpulse-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.dashboard-top-header.is-not-sticky {
  position: static;
  z-index: auto;
}

.dashboard-top-header__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
  padding: 0.4rem 0.75rem;
  gap: 0.75rem;
}

.dashboard-top-header__nav {
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
}

.dashboard-top-header__nav .button {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0;
}

.dashboard-top-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}

.dashboard-top-header__actions :deep(.dropdown),
.dashboard-top-header__actions :deep(.dropdown-trigger) {
  display: inline-flex;
  align-items: center;
}

.dashboard-top-header__actions :deep(.dropdown-trigger .button) {
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
}
</style>
