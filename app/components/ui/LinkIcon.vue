<template>
  <NuxtLinkLocale :to="to" class="is-flex is-justify-content-center">
    <slot />
  </NuxtLinkLocale>
</template>

<script setup lang="ts">
const { to } = defineProps<{
  to?: string;
}>();
</script>

<style scoped lang="scss">
.is-flex {
  color: inherit;
  text-decoration: none;
}
</style>
