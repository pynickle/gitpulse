<template>
  <RefreshCwIcon
    class="loading-spinner"
    :size="size"
    :stroke-width="strokeWidth"
    :style="{
      width: size + 'px',
      height: size + 'px',
    }"
  />
</template>

<script setup lang="ts">
import { RefreshCwIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    size?: number;
    strokeWidth?: number;
  }>(),
  {
    size: 16,
    strokeWidth: 2,
  }
);
</script>

<style scoped lang="scss">
.loading-spinner {
  animation: spin 1s linear infinite;
  transform-origin: center;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
