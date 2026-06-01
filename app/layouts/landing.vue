<script setup lang="ts">
import LandingNavbar from '~/components/layouts/LandingNavbar.vue';
</script>

<template>
  <LandingNavbar />
  <section class="hero is-fullheight-with-navbar">
    <div class="hero-body">
      <div class="container has-text-centered">
        <NuxtPage />
      </div>
    </div>
  </section>
</template>
