<template>
  <NuxtLinkLocale :to="to" class="link-icon">
    <slot />
  </NuxtLinkLocale>
</template>

<script setup lang="ts">
defineProps<{
  to?: string;
}>();
</script>

<style scoped lang="scss">
.link-icon {
  display: flex;
  justify-content: center;
  color: inherit;
  text-decoration: none;
}
</style>
