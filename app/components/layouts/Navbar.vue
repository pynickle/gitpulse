<template>
  <nav class="navbar" role="navigation" aria-label="main navigation">
    <div class="navbar-brand">
      <NuxtLinkLocale class="navbar-item" to="/">
        <ColorScheme tag="span">
          <RoundImg :src="logoSrc" alt="GitPulse Logo" width="28" height="28" />

          <template #placeholder>
            <RoundImg src="/icon.png" alt="GitPulse Logo" width="28" height="28" />
          </template>
        </ColorScheme>
        <h1 class="title is-4">{{ t('app.title') }}</h1>
      </NuxtLinkLocale>
    </div>

    <div class="navbar-menu">
      <div class="navbar-end">
        <div class="navbar-item">
          <LinkIcon to="https://github.com/pynickle/gitpulse">
            <GitHubIcon class="is-centered" />
          </LinkIcon>
        </div>
        <div class="navbar-item navbar-controls">
          <LanguageSwitcher />
          <ColorModeToggle />
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const colorMode = useColorMode();
const { t } = useI18n();

const logoSrc = computed(() => (colorMode.value === 'dark' ? '/icon-dark.png' : '/icon.png'));
</script>

<style scoped lang="scss">
.navbar-end .navbar-item {
  &:hover,
  &:focus {
    background-color: transparent;
    color: inherit;
  }
}

.navbar-end .navbar-item:first-child a {
  transition: opacity 0.16s ease;

  &:hover {
    opacity: 0.65;
  }
}

.navbar-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
