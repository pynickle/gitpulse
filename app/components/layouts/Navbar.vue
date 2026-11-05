<template>
  <nav class="navbar" role="navigation" aria-label="main navigation">
    <div class="navbar-bar">
      <NavbarBrand :title-tag="variant === 'public' ? 'span' : 'h1'" />
      <div
        class="navbar-bar__actions"
        :class="{ 'navbar-bar__actions--always': variant === 'public' }"
      >
        <ChromeActions />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import ChromeActions from '~/components/layouts/ChromeActions.vue';
import NavbarBrand from '~/components/layouts/NavbarBrand.vue';

const { variant = 'app' } = defineProps<{ variant?: 'app' | 'public' }>();
</script>

<style scoped lang="scss">
.navbar-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: var(--gitpulse-topbar-height);
  padding: 0 1rem;
}

.navbar-bar__actions {
  display: flex;
  align-items: center;
}

.navbar-bar :deep(a) {
  display: inline-flex;
  transition: opacity 0.16s ease;

  &:hover {
    opacity: 0.65;
  }
}

// App chrome keeps the controls until the narrow chrome takes over at 860px,
// the single narrow cutoff the shell uses (ADR 0004).
@media (max-width: 860px) {
  .navbar-bar__actions {
    display: none;
  }

  .navbar-bar__actions--always {
    display: flex;
  }
}
</style>
