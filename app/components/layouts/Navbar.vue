<template>
  <nav class="navbar" role="navigation" aria-label="main navigation">
    <div class="navbar-bar">
      <NavbarBrand :title-tag="variant === 'landing' ? 'span' : 'h1'" />
      <div
        class="navbar-bar__actions"
        :class="{ 'navbar-bar__actions--always': variant === 'landing' }"
      >
        <LinkIcon to="https://github.com/pynickle/gitpulse">
          <GitHubIcon class="is-centered" />
        </LinkIcon>
        <LanguageSwitcher />
        <ColorModeToggle />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import NavbarBrand from '~/components/layouts/NavbarBrand.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';

const { variant = 'app' } = defineProps<{ variant?: 'app' | 'landing' }>();
</script>

<style scoped lang="scss">
.navbar-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0 1rem;
}

.navbar-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.navbar-bar :deep(a) {
  display: inline-flex;
  transition: opacity 0.16s ease;

  &:hover {
    opacity: 0.65;
  }
}

// App chrome hides its controls on narrow viewports; the landing variant keeps them.
@media (max-width: 1023px) {
  .navbar-bar__actions {
    display: none;
  }

  .navbar-bar__actions--always {
    display: flex;
  }
}

@media (max-width: 480px) {
  .navbar-bar {
    gap: 0.5rem;
    padding-inline: 0.75rem;
  }
}
</style>
