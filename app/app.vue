<script setup lang="ts">
import { computed } from 'vue';

import ErrorPreviewWidget from '~/components/ErrorPreviewWidget.vue';

const colorMode = useColorMode();
const isDev = import.meta.dev;

const primerColorMode = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'));

// Fix homepage title duplication: use function to prevent "GitPulse - GitPulse"
useSeoMeta({
  titleTemplate: (titleChunk) => {
    return titleChunk && titleChunk !== 'GitPulse' ? `${titleChunk} - GitPulse` : 'GitPulse';
  },
});

const i18nHead = useLocaleHead({ seo: true });

useHead(() => {
  const localeHead = localeAlternateHead(i18nHead.value);

  return {
    htmlAttrs: {
      ...i18nHead.value.htmlAttrs,
      'data-color-mode': primerColorMode.value,
      'data-light-theme': 'light',
      'data-dark-theme': 'dark',
    },
    link: [...localeHead.link],
    meta: [...localeHead.meta],
  };
});
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ErrorPreviewWidget v-if="isDev" />
  </div>
</template>
