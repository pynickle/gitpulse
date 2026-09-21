<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  filename: string;
}>();

const slashIndex = computed(() => props.filename.lastIndexOf('/'));
const directory = computed(() =>
  slashIndex.value < 0 ? '' : props.filename.slice(0, slashIndex.value + 1)
);
const name = computed(() =>
  slashIndex.value < 0 ? props.filename : props.filename.slice(slashIndex.value + 1)
);
</script>

<template>
  <span class="pr-review-file-path" :title="filename">
    <span v-if="directory" class="pr-review-file-path__directory"
      ><bdi>{{ directory }}</bdi></span
    ><span class="pr-review-file-path__name">{{ name }}</span>
  </span>
</template>
