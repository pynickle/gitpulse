<script setup lang="ts">
import { Loader2Icon } from '@lucide/vue';

import type { FollowAddError, FollowedRepository } from '#shared/types/release-follows';
import FollowableRepoCard from '~/components/dashboard/release-follows/FollowableRepoCard.vue';
import type { StarredRepo } from '~/composables/useStarredRepos';

defineProps<{
  items: StarredRepo[];
  loading: boolean;
  error: string | null;
  followedIds: Set<string>;
  addBlock: Exclude<FollowAddError, 'duplicate'> | null;
  emptyMessage: string;
  errorMessage: string;
  retryLabel: string;
}>();

const emit = defineEmits<{
  retry: [];
  toggle: [repo: FollowedRepository];
}>();
</script>

<template>
  <div class="release-follows-grid">
    <div v-if="error" class="notification is-danger is-light">
      <p class="mb-2">{{ errorMessage }}</p>
      <button class="button is-small is-danger is-outlined" type="button" @click="emit('retry')">
        {{ retryLabel }}
      </button>
    </div>

    <div v-else-if="loading" class="release-follows-grid__empty" aria-busy="true">
      <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
    </div>

    <div v-else-if="items.length === 0" class="release-follows-grid__empty">
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="release-follows-grid__cards">
      <FollowableRepoCard
        v-for="repo in items"
        :key="repo.node_id || repo.id"
        class="release-follows-grid__cell"
        :repo="repo"
        :followed="Boolean(repo.node_id && followedIds.has(repo.node_id))"
        :add-block="addBlock"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-follows-grid {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 1rem calc(var(--gitpulse-scrollbar-track-size) + 0.5rem) 0 0;
}

.release-follows-grid__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.release-follows-grid__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1rem;
  align-items: stretch;
}

.spin-animation {
  animation: spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.release-follows-grid__cell {
  height: 100%;
}

.release-follows-grid__cell :deep(.card-content) {
  height: 100%;
  display: flex;
}

.release-follows-grid__cell :deep(.dashboard-list-card__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.release-follows-grid__cell :deep(.dashboard-list-card__meta) {
  margin-top: auto;
}

.release-follows-grid__cell :deep(.dashboard-list-card__description) {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

/* The narrow page runs its bands edge to edge, so the grid carries the gutter
   the wide layout gets from the page padding. */
@media (max-width: 860px) {
  .release-follows-grid {
    padding: 0.85rem 0.9rem 1.25rem;
  }
}
</style>
