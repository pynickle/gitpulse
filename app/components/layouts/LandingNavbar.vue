<template>
  <!-- Bulma Navbar -->
  <nav class="navbar" role="navigation" aria-label="main navigation">
    <div class="navbar-menu">
      <div class="navbar-end">
        <div class="navbar-item navbar-controls">
          <LanguageSwitcher />
          <ColorModeToggle />
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
</script>

<style scoped lang="scss">
.navbar-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
