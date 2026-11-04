<template>
  <NuxtLinkLocale class="navbar-brand-link" to="/">
    <ColorScheme tag="span">
      <RoundImg :src="logoSrc" alt="GitPulse Logo" width="28" height="28" />

      <template #placeholder>
        <RoundImg src="/icon.png" alt="GitPulse Logo" width="28" height="28" />
      </template>
    </ColorScheme>
    <component :is="titleTag" class="title is-4 mb-0">{{ t('app.title') }}</component>
  </NuxtLinkLocale>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import RoundImg from '~/components/ui/RoundImg.vue';

const { titleTag = 'h1' } = defineProps<{ titleTag?: 'h1' | 'span' }>();

const colorMode = useColorMode();
const { t } = useI18n();

const logoSrc = computed(() => (colorMode.value === 'dark' ? '/icon-dark.png' : '/icon.png'));
</script>

<style scoped lang="scss">
.navbar-brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-inline-end: auto;
  color: inherit;
}
</style>
