<script setup lang="ts">
import LandingNavbar from '~/components/layouts/LandingNavbar.vue';
</script>

<template>
  <div class="native-login-shell">
    <LandingNavbar />
    <main class="native-login-shell__main">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped lang="scss">
.native-login-shell {
  display: flex;
  flex-direction: column;
  min-height: var(--gitpulse-frame-height);
  background: var(--gitpulse-page-bg);
}

.native-login-shell__main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 1rem 1.25rem 1.25rem;
}

@media (max-width: 860px) {
  .native-login-shell__main {
    align-items: flex-start;
    padding: 0.75rem;
  }
}
</style>
