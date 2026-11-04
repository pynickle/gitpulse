<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';
import SkipToContentLink from '~/components/ui/SkipToContentLink.vue';
</script>

<template>
  <SkipToContentLink />
  <Navbar variant="landing" />
  <main id="main-content" tabindex="-1" class="hero is-fullheight-with-navbar">
    <div class="hero-body">
      <div class="container has-text-centered">
        <NuxtPage />
      </div>
    </div>
  </main>
</template>
