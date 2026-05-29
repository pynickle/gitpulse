<script setup lang="ts">
import { computed } from 'vue';

const colorMode = useColorMode();

const primerColorMode = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'));

useHead(() => ({
  htmlAttrs: {
    'data-color-mode': primerColorMode.value,
    'data-light-theme': 'light',
    'data-dark-theme': 'dark',
  },
}));
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
