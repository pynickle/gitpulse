<template>
  <a
    v-if="project?.url"
    :href="project.url"
    target="_blank"
    class="tag is-activity ml-1 is-link is-light"
  >
    {{ project.title }}
  </a>
  <span v-else class="tag is-activity ml-1 is-link is-light">{{
    project?.title || fallbackTitle
  }}</span>
</template>

<script setup lang="ts">
defineProps<{
  project?: {
    title?: string;
    url?: string;
  } | null;
  fallbackTitle?: string;
}>();
</script>

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
