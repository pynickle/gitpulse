<template>
  <nav class="navbar" role="navigation" aria-label="main navigation">
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
