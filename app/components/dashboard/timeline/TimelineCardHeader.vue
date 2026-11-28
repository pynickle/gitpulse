<template>
  <header class="timeline-card-header">
    <GitHubAvatar
      variant="raised"
      interactive
      class="timeline-card-header__avatar"
      width="32"
      height="32"
      :src="author?.avatarUrl || ''"
      :alt="author?.login || ''"
    />
    <div class="timeline-card-header__meta">
      <GitHubProfileLink
        :login="author?.login"
        :github-href="author?.url"
        class="timeline-card-header__author"
      >
        {{ author?.login }}
      </GitHubProfileLink>
      <span class="timeline-card-header__time">
        {{ formatDurationFromNow(createdAt || '', localeCode, relativeTimeNow) }}
      </span>
    </div>
    <slot />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

defineProps<{
  author?: TimelineActor;
  createdAt?: string;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
</script>

<style scoped lang="scss">
.timeline-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.timeline-card-header__avatar {
  flex: none;
}

.timeline-card-header__meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.timeline-card-header__author {
  color: var(--gitpulse-link);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.timeline-card-header__time {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
