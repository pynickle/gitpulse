<template>
  <div class="logo-image-wrapper" :style="style">
    <NuxtImg :src="src" :alt="alt" class="logo-image" loading="eager" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
}>();

const style = computed(() => ({
  width: props.width ? `${props.width}px` : undefined,
  height: props.height ? `${props.height}px` : undefined,
}));
</script>

<style scoped lang="scss">
$motion-normal: 0.3s;

.logo-image-wrapper {
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform $motion-normal ease;

  &:hover {
    transform: scale(1.05);
  }
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
