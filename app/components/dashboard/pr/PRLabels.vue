<template>
  <div class="mb-4">
    <div class="is-flex items-center justify-between mb-3">
      <h3 class="title is-6 mb-0">Labels</h3>
    </div>
    <div class="is-flex flex-wrap mb-4">
      <span
        v-for="label in labels"
        :key="label.id || label.name"
        class="tag mr-2 mb-2 has-text-weight-medium"
        :style="{
          backgroundColor: `#${label.color}`,
          color: `#${getTextColorFromBackground(label.color)}`,
        }"
      >
        {{ label.name }}
      </span>
      <span v-if="labels.length === 0" class="has-text-grey is-size-7"> No labels </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  labels: any[];
}>();

const getTextColorFromBackground = (backgroundColor: string) => {
  const r = parseInt(backgroundColor.slice(0, 2), 16);
  const g = parseInt(backgroundColor.slice(2, 4), 16);
  const b = parseInt(backgroundColor.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '000000' : 'ffffff';
};
</script>
