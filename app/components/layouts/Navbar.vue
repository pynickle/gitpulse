<template>
  <!-- Bulma Navbar -->
  <nav class="navbar" role="navigation" aria-label="main navigation">
    <div class="navbar-brand">
      <NuxtLinkLocale class="navbar-item" to="/">
        <RoundImg src="/icon.png" alt="GitPulse Logo" width="28" height="28" />
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
import { GitHubIcon } from 'vue3-simple-icons';

import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { t } = useI18n();
</script>

<style scoped lang="scss">
.navbar-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
