<template>
  <nav class="navbar" aria-label="main navigation">
    <div class="landing-navbar__bar">
      <NuxtLinkLocale class="landing-navbar__brand" to="/">
        <ColorScheme tag="span">
          <RoundImg :src="logoSrc" alt="GitPulse Logo" width="28" height="28" />

          <template #placeholder>
            <RoundImg src="/icon.png" alt="GitPulse Logo" width="28" height="28" />
          </template>
        </ColorScheme>
        <span class="title is-4 mb-0">{{ t('app.title') }}</span>
      </NuxtLinkLocale>
      <LinkIcon to="https://github.com/pynickle/gitpulse">
        <GitHubIcon class="is-centered" />
      </LinkIcon>
      <LanguageSwitcher />
      <ColorModeToggle />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const colorMode = useColorMode();
const { t } = useI18n();

const logoSrc = computed(() => (colorMode.value === 'dark' ? '/icon-dark.png' : '/icon.png'));
</script>

<style scoped lang="scss">
.landing-navbar__bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0 1rem;
}

.landing-navbar__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-inline-end: auto;
  color: inherit;

  &:hover {
    opacity: 0.65;
  }
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
