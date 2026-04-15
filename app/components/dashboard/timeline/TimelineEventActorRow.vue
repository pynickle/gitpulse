<template>
  <div class="is-flex is-align-items-center">
    <RoundImg
      class="mr-4"
      :width="String(avatarSize)"
      :height="String(avatarSize)"
      :src="actor?.avatarUrl || ''"
      :alt="actor?.login || ''"
    />
    <div class="is-flex is-justify-content-center">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import RoundImg from '~/components/ui/RoundImg.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';

withDefaults(
  defineProps<{
    actor?: TimelineActor;
    avatarSize?: number;
  }>(),
  {
    avatarSize: 24,
  }
);
</script>
