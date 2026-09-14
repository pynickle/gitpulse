<script setup lang="ts">
import { FilterIcon, MenuIcon, RefreshCwIcon, UserIcon } from '@lucide/vue';
import { onBeforeUnmount, useTemplateRef, watch } from 'vue';

import DashboardAccountMenu from '~/components/dashboard/DashboardAccountMenu.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

const props = defineProps<{
  title: string;
  showFilterButton: boolean;
  filterActive?: boolean;
  refreshing?: boolean;
  refreshDisabled?: boolean;
  userAvatar?: string;
  userName?: string;
  dashboardMenuOpen: boolean;
  accountMenuOpen: boolean;
}>();

const emit = defineEmits<{
  'menu-click': [];
  'filter-click': [];
  'refresh-click': [];
  'avatar-click': [];
  'account-close': [];
  'account-escape': [];
  profile: [];
  starred: [];
  settings: [];
  logout: [];
}>();

const { t } = useI18n();
const accountRootRef = useTemplateRef<HTMLElement>('accountRoot');

const isAccountMenuPointerTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  if (accountRootRef.value?.contains(target)) return true;
  return Boolean(target.closest('.filter-dropdown-panel'));
};

const handleAccountPointerDown = (event: PointerEvent) => {
  if (isAccountMenuPointerTarget(event.target)) return;
  emit('account-close');
};

watch(
  () => props.accountMenuOpen,
  (open) => {
    if (!import.meta.client) return;
    if (open) {
      document.addEventListener('pointerdown', handleAccountPointerDown);
      return;
    }
    document.removeEventListener('pointerdown', handleAccountPointerDown);
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleAccountPointerDown);
});
</script>

<template>
  <header class="dashboard-home-top-bar">
    <button
      class="dashboard-home-top-bar__icon-btn dashboard-home-top-bar__menu-btn"
      type="button"
      :aria-label="dashboardMenuOpen ? t('dashboard.menu.close') : t('dashboard.menu.open')"
      :aria-expanded="dashboardMenuOpen"
      :aria-controls="'dashboard-menu'"
      @click="emit('menu-click')"
    >
      <MenuIcon :size="20" aria-hidden="true" />
    </button>

    <h1 class="dashboard-home-top-bar__title" :title="title">
      {{ title }}
    </h1>

    <button
      v-if="showFilterButton"
      class="dashboard-home-top-bar__icon-btn"
      :class="{ 'is-active': filterActive }"
      type="button"
      :aria-label="t('dashboard.filters.openDrawer')"
      :title="t('dashboard.filters.openDrawer')"
      @click="emit('filter-click')"
    >
      <FilterIcon :size="18" aria-hidden="true" />
    </button>

    <button
      class="dashboard-home-top-bar__icon-btn"
      type="button"
      :aria-label="t('dashboard.actions.refresh')"
      :title="t('dashboard.actions.refresh')"
      :disabled="refreshDisabled || refreshing"
      @click="emit('refresh-click')"
    >
      <RefreshCwIcon
        :size="18"
        :class="{ 'dashboard-home-top-bar__refresh-spin': refreshing }"
        aria-hidden="true"
      />
    </button>

    <div ref="accountRoot" class="dashboard-home-top-bar__account">
      <button
        class="dashboard-home-top-bar__avatar"
        type="button"
        :aria-label="
          accountMenuOpen ? t('dashboard.accountMenu.close') : t('dashboard.accountMenu.open')
        "
        :aria-expanded="accountMenuOpen"
        :aria-haspopup="'menu'"
        @click="emit('avatar-click')"
      >
        <GitHubAvatar
          :src="userAvatar"
          :alt="userName || t('profile.openProfile')"
          size="32"
          class="dashboard-home-top-bar__avatar-img"
        >
          <template #fallback>
            <UserIcon :size="16" />
          </template>
        </GitHubAvatar>
      </button>
      <DashboardAccountMenu
        v-if="accountMenuOpen"
        @close="emit('account-close')"
        @escape="emit('account-escape')"
        @profile="emit('profile')"
        @starred="emit('starred')"
        @settings="emit('settings')"
        @logout="emit('logout')"
      />
    </div>
  </header>
</template>

<style scoped lang="scss">
.dashboard-home-top-bar {
  position: sticky;
  top: 0;
  z-index: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2.75rem;
  padding: 0.25rem 0.5rem;
  padding-top: max(0.25rem, env(safe-area-inset-top));
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.dashboard-home-top-bar__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 0.35rem;
  overflow: hidden;
  color: var(--gitpulse-text-strong);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-home-top-bar__icon-btn,
.dashboard-home-top-bar__avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-md);
  background: transparent;
  color: var(--gitpulse-text-strong);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }

  &.is-active {
    color: var(--gitpulse-link);
    background: var(--gitpulse-info-soft);
  }
}

.dashboard-home-top-bar__menu-btn {
  position: relative;
  z-index: 25;
}

.dashboard-home-top-bar__account {
  position: relative;
  z-index: 26;
  flex: none;
}

.dashboard-home-top-bar__avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.dashboard-home-top-bar__refresh-spin {
  animation: dashboard-home-top-bar-spin 0.9s linear infinite;
}

@keyframes dashboard-home-top-bar-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-home-top-bar__refresh-spin {
    animation: none;
  }
}
</style>
