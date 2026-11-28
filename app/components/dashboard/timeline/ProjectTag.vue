<template>
  <a
    v-if="project?.url"
    :href="project.url"
    target="_blank"
    rel="noopener"
    class="gp-tag gp-tag--activity gp-tag--link project-tag"
  >
    {{ project.title }}
  </a>
  <span v-else class="gp-tag gp-tag--activity gp-tag--link project-tag">{{
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
.project-tag {
  margin-left: 0.25rem;
}
</style>
