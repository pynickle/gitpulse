<script setup lang="ts">
import LandingNavbar from '~/components/layouts/LandingNavbar.vue';
import SkipToContentLink from '~/components/ui/SkipToContentLink.vue';
</script>

<template>
  <SkipToContentLink />
  <LandingNavbar />
  <main id="main-content" tabindex="-1" class="hero is-fullheight-with-navbar">
    <div class="hero-body">
      <div class="container has-text-centered">
        <NuxtPage />
      </div>
    </div>
  </main>
</template>
