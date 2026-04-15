<template>
  <TimelineCommentCard :item="item" :empty-text="emptyText" />
</template>

<script setup lang="ts">
import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';

withDefaults(
  defineProps<{
    item: PRTimelineItem;
    emptyText?: string;
  }>(),
  {
    emptyText: 'No comment body',
  }
);
</script>
