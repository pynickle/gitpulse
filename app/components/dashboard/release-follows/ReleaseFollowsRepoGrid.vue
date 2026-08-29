<script setup lang="ts">
import { Loader2Icon } from '@lucide/vue';

import type { FollowAddError, FollowedRepository } from '#shared/types/release-follows';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import FollowableRepoCard from '~/components/dashboard/release-follows/FollowableRepoCard.vue';
import type { StarredPaginationMeta, StarredRepo } from '~/composables/useStarredRepos';

defineProps<{
  items: StarredRepo[];
  pagination: StarredPaginationMeta;
  loading: boolean;
  error: string | null;
  followedIds: Set<string>;
  addBlock: Exclude<FollowAddError, 'duplicate'> | null;
  emptyMessage: string;
  errorMessage: string;
  retryLabel: string;
  showPagination: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  pageChange: [page: number];
  toggle: [repo: FollowedRepository];
}>();
</script>

<template>
  <div class="release-follows-grid">
    <div class="release-follows-grid__body">
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

    <div v-if="showPagination" class="release-follows-grid__pagination">
      <DashboardPagination :pagination="pagination" @change="emit('pageChange', $event)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-follows-grid {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.release-follows-grid__empty {
  display: flex;
  align-items: center;
  justify-content: center;
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

.release-follows-grid__pagination {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  padding: 0.75rem 0;
  background: var(--gitpulse-surface);
  border-top: 1px solid var(--gitpulse-border);
}
</style>
