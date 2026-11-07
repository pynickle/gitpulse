<template>
  <div class="timeline-event-note">
    <div class="timeline-event-note__heading">
      <component
        :is="icon"
        :size="14"
        :stroke-width="2.5"
        class="timeline-event-note__icon"
        aria-hidden="true"
      />
      <span class="timeline-event-note__label"><slot name="label" /></span>
      <TimelineEventTime v-if="date" :date="date" class="timeline-event-note__time" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

import TimelineEventTime from '~/components/dashboard/timeline/TimelineEventTime.vue';

defineProps<{
  icon: Component;
  date?: string;
}>();
</script>

<style scoped lang="scss">
.timeline-event-note {
  min-width: 0;
  margin-top: 1.25rem;
  padding: 1rem 0 0.25rem;
  border-top: 1px solid var(--gitpulse-border);
}

.timeline-event-note__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.timeline-event-note__icon {
  flex: none;
}

.timeline-event-note__label {
  min-width: 0;
}

.timeline-event-note__time {
  margin-left: auto;
}
</style>
