<template>
  <div class="merge-item">
    <div class="merge-item__row">
      <GitHubAvatar
        variant="raised"
        interactive
        v-if="item.actor?.avatarUrl"
        class="merge-avatar"
        width="32"
        height="32"
        :src="item.actor.avatarUrl"
        :alt="item.actor.login"
      />
      <div v-else class="merge-avatar-fallback merge-avatar">
        <GitMergeIcon :size="16" />
      </div>

      <div class="merge-item__body">
        <div class="merge-item__meta">
          <GitHubProfileLink
            v-if="item.actor?.login"
            :login="item.actor.login"
            :github-href="item.actor.url"
            class="merge-item__actor"
          >
            {{ item.actor.login }}
          </GitHubProfileLink>
          <span class="merge-label">
            <GitMergeIcon :size="14" />
            merged commit
          </span>
        </div>

        <TimelineEventTime class="merge-item__time" :date="item.createdAt" />
      </div>

      <a
        v-if="item.commit?.oid"
        :href="
          item.commit.commitUrl ||
          item.commit.url ||
          `https://github.com/${repoOwner}/${repoName}/commit/${item.commit.oid}`
        "
        target="_blank"
        rel="noopener"
        class="merge-sha gp-tag"
      >
        {{ item.commit.oid.slice(0, 7) }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GitMergeIcon } from '@lucide/vue';

import TimelineEventTime from '~/components/dashboard/timeline/TimelineEventTime.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';

defineProps<{
  item: PRTimelineItem;
  repoOwner: string;
  repoName: string;
}>();
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;
@use '~/assets/scss/timeline-card' as *;

.merge-item {
  @include timeline-event-accent(var(--gitpulse-purple));

  padding: 0.75rem 1rem;
  border-radius: 12px;
  background-color: var(--gitpulse-purple-soft);
  transition: background-color 0.2s ease;
}

.merge-item__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.merge-item__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
}

.merge-item__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.merge-item__actor {
  color: var(--gitpulse-link);
  font-size: 1rem;
  font-weight: 500;
}

.merge-item__time {
  margin-top: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.merge-avatar {
  flex-shrink: 0;
}

.merge-avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--gitpulse-surface-muted);
  color: var(--gitpulse-purple);
}

.merge-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gitpulse-purple);
}

.merge-sha {
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.75rem;
  background-color: var(--gitpulse-accent-soft);
  color: var(--gitpulse-purple);
  font-weight: 500;

  @include hover-only {
    &:hover {
      background-color: var(--gitpulse-surface-hover);
      color: var(--gitpulse-accent);
    }
  }
}
</style>
