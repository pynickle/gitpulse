<template>
  <nav class="navbar" aria-label="main navigation">
    <div class="landing-navbar__bar">
      <LinkIcon to="https://github.com/pynickle/gitpulse">
        <GitHubIcon class="is-centered" />
      </LinkIcon>
      <LanguageSwitcher />
      <ColorModeToggle />
    </div>
  </nav>
</template>

<script setup lang="ts">
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';
</script>

<style scoped lang="scss">
.landing-navbar__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0 1rem;
}

.landing-navbar__bar :deep(a) {
  display: inline-flex;
  transition: opacity 0.16s ease;

  &:hover {
    opacity: 0.65;
  }
}

@media (max-width: 480px) {
  .landing-navbar__bar {
    gap: 0.5rem;
    padding-inline: 0.75rem;
  }
}
</style>
