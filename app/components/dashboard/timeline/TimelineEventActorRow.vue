<template>
  <div class="is-flex is-align-items-center">
    <GitHubAvatar
      variant="raised"
      interactive
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
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';

const { actor, avatarSize = 24 } = defineProps<{
  actor?: TimelineActor;
  avatarSize?: number;
}>();
</script>
