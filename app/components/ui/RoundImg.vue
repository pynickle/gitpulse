<template>
  <div class="logo-image-wrapper" :style="style">
    <NuxtImg
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      class="logo-image"
      loading="eager"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const { width, height } = defineProps<{
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
}>();

const style = computed(() => ({
  width: width ? `${width}px` : undefined,
  height: height ? `${height}px` : undefined,
}));
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

$motion-normal: 0.3s;

.logo-image-wrapper {
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: var(--gitpulse-shadow-card);
  transition: transform $motion-normal ease;

  @include hover-only {
    &:hover {
      transform: scale(1.05);
    }
  }
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
