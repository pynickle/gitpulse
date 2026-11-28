<template>
  <div
    class="timeline-actor-row"
    :class="{
      'timeline-actor-row--start': alignStart,
    }"
  >
    <GitHubAvatar
      variant="raised"
      interactive
      class="timeline-actor-row__avatar"
      :width="String(avatarSize)"
      :height="String(avatarSize)"
      :src="actor?.avatarUrl || ''"
      :alt="actor?.login || ''"
    />
    <div class="timeline-actor-row__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';

const { avatarSize = 24, alignStart = false } = defineProps<{
  actor?: TimelineActor;
  avatarSize?: number;
  alignStart?: boolean;
}>();
</script>

<style scoped lang="scss">
.timeline-actor-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.timeline-actor-row--start {
  align-items: flex-start;
}

.timeline-actor-row__body {
  display: flex;
  justify-content: center;
}
</style>
