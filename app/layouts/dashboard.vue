<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';
import SkipToContentLink from '~/components/ui/SkipToContentLink.vue';

const route = useRoute();
const { presentation } = useDashboardHomeChrome();

const isFileBrowserActive = computed(() => {
  return Boolean(route.query.repo && Object.hasOwn(route.query, 'path'));
});

const isDashboardHome = computed(() => {
  return !isFileBrowserActive.value && route.path.replace(/\/$/, '').endsWith('/dashboard');
});

const showNavbar = computed(() => {
  // Sub-pages and the detail overlays own their chrome: they render the overlay
  // header. Mounting the layout navbar too would duplicate the language and
  // color-mode controls under a layer that paints over them.
  if (!isDashboardHome.value) return false;
  return presentation.value.showNavbar;
});
</script>

<template>
  <div class="dashboard-frame" :class="{ 'dashboard-frame--home': isDashboardHome }">
    <SkipToContentLink />
    <Navbar v-if="showNavbar" />
    <main
      id="main-content"
      tabindex="-1"
      class="dashboard-shell"
      :class="showNavbar ? 'dashboard-shell--with-navbar' : 'dashboard-shell--fullheight'"
    >
      <div class="dashboard-shell__body">
        <NuxtPage />
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.dashboard-shell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
}

.dashboard-shell--fullheight {
  min-height: 100vh;
}

.dashboard-shell--with-navbar {
  min-height: calc(100vh - var(--gitpulse-topbar-height));
}

.dashboard-shell__body {
  display: flex;
  flex: 1 0 auto;
  align-items: stretch;
  padding: 0;
}

@media (max-width: 860px) {
  .dashboard-frame--home :deep(.top-navbar) {
    display: none;
  }

  .dashboard-frame--home,
  .dashboard-frame--home .dashboard-shell,
  .dashboard-frame--home .dashboard-shell--fullheight,
  .dashboard-frame--home .dashboard-shell--with-navbar {
    height: var(--gitpulse-frame-height);
    max-height: var(--gitpulse-frame-height);
    min-height: 0;
    overflow: hidden;
  }

  .dashboard-frame--home .dashboard-shell__body {
    height: 100%;
    min-height: 0;
    padding: 0;
  }
}
</style>
