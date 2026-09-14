<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';

const route = useRoute();
const { presentation } = useDashboardHomeChrome();

const isFileBrowserActive = computed(() => {
  return Boolean(route.query.repo && Object.hasOwn(route.query, 'path'));
});

const isDashboardHome = computed(() => {
  return !isFileBrowserActive.value && route.path.replace(/\/$/, '').endsWith('/dashboard');
});

const showNavbar = computed(() => {
  if (isFileBrowserActive.value) return false;
  if (!isDashboardHome.value) return true;
  return presentation.value.showNavbar;
});
</script>

<template>
  <div class="dashboard-frame" :class="{ 'dashboard-frame--home': isDashboardHome }">
    <Navbar v-if="showNavbar" />
    <section
      class="hero dashboard-shell"
      :class="showNavbar ? 'is-fullheight-with-navbar' : 'is-fullheight'"
    >
      <div class="hero-body dashboard-shell__body">
        <NuxtPage />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dashboard-shell__body {
  align-items: stretch;
}

@media (max-width: 860px) {
  .dashboard-frame--home :deep(.navbar) {
    display: none;
  }

  .dashboard-frame--home .dashboard-shell {
    min-height: 100vh;
  }
}
</style>
