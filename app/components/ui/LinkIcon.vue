<template>
  <NuxtLinkLocale :to="target" class="is-flex is-justify-content-center">
    <slot />
  </NuxtLinkLocale>
</template>

<script setup lang="ts">
const { to } = defineProps<{
  to?: string;
}>();

const target = computed(() => to);
</script>

<style scoped lang="scss">
.is-flex {
  color: inherit;
  text-decoration: none;
}
</style>
