<script setup lang="ts">
import { LogOutIcon, SettingsIcon, StarIcon, UserIcon } from '@lucide/vue';
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';

const emit = defineEmits<{
  close: [];
  escape: [];
  profile: [];
  starred: [];
  settings: [];
  logout: [];
}>();

const { t } = useI18n();
const menuRef = useTemplateRef<HTMLElement>('menuRef');

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('escape');
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  menuRef.value?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    ref="menuRef"
    class="dashboard-account-menu"
    role="menu"
    :aria-label="t('dashboard.accountMenu.title')"
    tabindex="-1"
  >
    <button
      class="dashboard-account-menu__item"
      type="button"
      role="menuitem"
      @click="emit('profile')"
    >
      <UserIcon :size="16" aria-hidden="true" />
      {{ t('profile.pageTitleGeneric') }}
    </button>
    <button
      class="dashboard-account-menu__item"
      type="button"
      role="menuitem"
      @click="emit('starred')"
    >
      <StarIcon :size="16" aria-hidden="true" />
      {{ t('starred.openStarred') }}
    </button>
    <button
      class="dashboard-account-menu__item"
      type="button"
      role="menuitem"
      @click="emit('settings')"
    >
      <SettingsIcon :size="16" aria-hidden="true" />
      {{ t('dashboard.settings.pageTitle') }}
    </button>
    <a
      class="dashboard-account-menu__item"
      role="menuitem"
      href="https://github.com/pynickle/gitpulse"
      target="_blank"
      rel="noopener noreferrer"
    >
      <GitHubIcon class="dashboard-account-menu__github-icon" aria-hidden="true" />
      {{ t('dashboard.accountMenu.github') }}
    </a>
    <div class="dashboard-account-menu__controls">
      <LanguageSwitcher />
      <ColorModeToggle />
    </div>
    <button
      class="dashboard-account-menu__item"
      type="button"
      role="menuitem"
      @click="emit('logout')"
    >
      <LogOutIcon :size="16" aria-hidden="true" />
      {{ t('dashboard.sidebar.logout') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.dashboard-account-menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 24;
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 12.5rem;
  max-width: min(18rem, calc(100vw - 1.5rem));
  padding: 0.35rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised, 0 8px 24px rgba(15, 23, 42, 0.12));
  outline: none;
}

.dashboard-account-menu__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.7rem;
  border: 0;
  border-radius: var(--gitpulse-radius-sm);
  background: transparent;
  color: var(--gitpulse-text-strong);
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }
}

.dashboard-account-menu__github-icon {
  width: 16px;
  height: 16px;
}

.dashboard-account-menu__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem 0.55rem;
}
</style>
