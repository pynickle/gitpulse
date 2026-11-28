<template>
  <div class="timeline-renamed">
    <GitHubAvatar
      variant="raised"
      interactive
      class="timeline-renamed__avatar"
      width="24"
      height="24"
      :src="actor?.avatarUrl || ''"
      :alt="actor?.login || ''"
    />
    <p class="timeline-renamed__action">
      <GitHubProfileLink
        v-if="actor?.login"
        :login="actor?.login"
        :github-href="actor?.url"
        class="timeline-renamed__actor"
        >{{ actor?.login }}</GitHubProfileLink
      >{{ actorTail }}
      <span class="timeline-renamed__time">
        {{ formatDurationFromNow(createdAt, localeCode, relativeTimeNow) }}
      </span>
    </p>
    <div v-if="previousTitle || currentTitle" class="timeline-renamed__titles">
      <del v-if="previousTitle" class="timeline-renamed__title timeline-renamed__title--previous">
        {{ previousTitle }}
      </del>
      <p v-if="currentTitle" class="timeline-renamed__title">{{ currentTitle }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

const { actor, createdAt = '' } = defineProps<{
  actor?: TimelineActor;
  previousTitle?: string;
  currentTitle?: string;
  createdAt?: string;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const actorTail = computed(() => {
  const name = actor?.name?.trim() ?? '';
  const login = actor?.login?.trim() ?? '';
  const distinctName = name && name.toLowerCase() !== login.toLowerCase() ? ` (${name})` : '';
  return `${distinctName} changed the title`;
});
</script>

<style scoped lang="scss">
.timeline-renamed {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 1rem;
  row-gap: 0.25rem;
  align-items: center;
  min-width: 0;
}

.timeline-renamed__avatar {
  grid-column: 1;
  grid-row: 1;
}

.timeline-renamed__action {
  grid-column: 2;
  grid-row: 1;
  margin: 0;
  min-width: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  text-box: trim-both cap alphabetic;
}

.timeline-renamed__actor {
  color: var(--gitpulse-link);
  font-weight: 500;
}

.timeline-renamed__time {
  margin-left: 0.5rem;
  color: var(--gitpulse-text-muted);
}

.timeline-renamed__titles {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.timeline-renamed__title {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-wrap: pretty;
  color: var(--gitpulse-text-strong);
}

.timeline-renamed__title--previous {
  color: var(--gitpulse-text-muted);
  text-decoration: line-through;
}
</style>
