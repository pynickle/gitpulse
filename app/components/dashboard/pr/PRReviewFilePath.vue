<script setup lang="ts">
import { computed } from 'vue';

const { filename } = defineProps<{
  filename: string;
}>();

const slashIndex = computed(() => filename.lastIndexOf('/'));
const directory = computed(() =>
  slashIndex.value < 0 ? '' : filename.slice(0, slashIndex.value + 1)
);
const name = computed(() =>
  slashIndex.value < 0 ? filename : filename.slice(slashIndex.value + 1)
);
</script>

<template>
  <span class="pr-review-file-path" :title="filename">
    <span v-if="directory" class="pr-review-file-path__directory"><bdi>{{ directory }}</bdi></span
    ><span class="pr-review-file-path__name">{{ name }}</span>
  </span>
</template>
