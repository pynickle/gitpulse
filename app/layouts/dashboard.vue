<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';
</script>

<template>
  <!-- Header Component -->
  <Navbar />
  <section class="hero is-fullheight-with-navbar">
    <div class="hero-body">
      <NuxtPage />
    </div>
  </section>
</template>
