<script setup lang="ts">
const localePath = useLocalePath();

await navigateTo(localePath('/dashboard/tabs'), { replace: true });
</script>

<template>
  <div class="dashboard-settings-tabs-redirect" />
</template>
