<template>
  <Transition name="floating-back-to-top">
    <button
      v-if="visible"
      type="button"
      class="gitpulse-floating-fab floating-back-to-top"
      :aria-label="label"
      @click="$emit('activate')"
    >
      <ArrowUpIcon :size="17" aria-hidden="true" />
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ArrowUpIcon } from '@lucide/vue';

defineProps<{
  label: string;
  visible: boolean;
}>();

defineEmits<{
  (e: 'activate'): void;
}>();
</script>

<style scoped lang="scss">
.floating-back-to-top {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 10020;
}

.floating-back-to-top-enter-active,
.floating-back-to-top-leave-active {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-back-to-top-leave-active {
  transition-duration: 0.2s;
}

.floating-back-to-top-enter-from,
.floating-back-to-top-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .floating-back-to-top-enter-active,
  .floating-back-to-top-leave-active {
    transition: none;
  }
}
</style>
