<template>
  <NuxtLinkLocale :to="target" class="is-flex is-justify-content-center">
    <slot />
  </NuxtLinkLocale>
</template>

<script setup lang="ts">
const props = defineProps<{
  to?: string;
}>();

const target = computed(() => props.to);
</script>

<style scoped lang="scss">
.is-flex {
  color: inherit;
  text-decoration: none;
}
</style>
