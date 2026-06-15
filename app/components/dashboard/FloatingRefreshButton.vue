<template>
  <button
    type="button"
    :class="[
      'gitpulse-floating-fab',
      'floating-refresh-button',
      {
        'floating-refresh-button--new': hasNewContent,
        'floating-refresh-button--busy': refreshing || checking,
      },
    ]"
    :aria-label="label"
    :disabled="disabled || refreshing"
    @click="$emit('refresh')"
  >
    <SparklesIcon v-if="hasNewContent" :size="17" aria-hidden="true" />
    <RefreshCwIcon
      v-else
      :size="17"
      :class="{ 'floating-refresh-button__spin': refreshing || checking }"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { RefreshCwIcon, SparklesIcon } from 'lucide-vue-next';

defineProps<{
  hasNewContent?: boolean;
  refreshing?: boolean;
  checking?: boolean;
  disabled?: boolean;
  label: string;
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();
</script>

<style scoped lang="scss">
.floating-refresh-button {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 10020;
}

.floating-refresh-button--new {
  border-color: color-mix(in srgb, var(--gitpulse-warning-solid) 68%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-warning-soft) 82%, var(--gitpulse-surface));
  color: var(--gitpulse-warning-solid);
  animation: floating-refresh-pulse 1.8s ease-in-out infinite;
}

.floating-refresh-button--busy {
  background: color-mix(in srgb, var(--gitpulse-accent-soft) 72%, var(--gitpulse-surface));
  color: var(--gitpulse-accent);
  pointer-events: none;
}

.floating-refresh-button__spin {
  animation: floating-refresh-spin 0.9s linear infinite;
}

@keyframes floating-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes floating-refresh-pulse {
  0%,
  100% {
    box-shadow: var(--gitpulse-shadow-raised);
  }

  50% {
    box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--gitpulse-warning-solid) 16%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-refresh-button--new,
  .floating-refresh-button__spin {
    animation: none;
  }
}
</style>
