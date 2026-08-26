<script setup lang="ts">
import { BookMarkedIcon, Loader2Icon } from '@lucide/vue';
import { toRef } from 'vue';

import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import RepoItem from '~/components/dashboard/RepoItem.vue';
import { useUserRepositories } from '~/composables/useUserConnections';

const props = defineProps<{
  username: string;
  emptyLabel: string;
}>();

const { t } = useI18n();

const { items, loading, error, pagination, showPagination, goToPage, refresh } =
  useUserRepositories(toRef(props, 'username'));
</script>

<template>
  <div class="profile-repo-list">
    <div v-if="error" class="profile-repo-list__status profile-repo-list__status--error">
      <p>{{ error }}</p>
      <button type="button" class="button is-small is-light" @click="refresh">
        {{ t('profile.retry') }}
      </button>
    </div>

    <template v-else>
      <div v-if="loading" class="profile-repo-list__status">
        <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
      </div>

      <div v-else-if="items.length" class="profile-repo-list__items">
        <RepoItem
          v-for="repo in items"
          :key="repo.id"
          :repo="repo"
          class="profile-repo-list__cell"
        />
      </div>

      <div v-else class="profile-repo-list__status profile-repo-list__status--empty">
        <BookMarkedIcon :size="26" aria-hidden="true" />
        <p>{{ emptyLabel }}</p>
      </div>

      <DashboardPagination
        v-if="showPagination"
        class="profile-repo-list__pagination"
        :pagination="pagination"
        @change="goToPage"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.profile-repo-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 1rem;
}

.profile-repo-list__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 0.75rem;
  align-items: stretch;
}

/* Cards fill their grid cell so rows stay even regardless of description length. */
.profile-repo-list__cell {
  height: 100%;
}

/* Pin the stats row to the card bottom so it doesn't drift with description length. */
.profile-repo-list__cell :deep(.card-content) {
  height: 100%;
  display: flex;
}

.profile-repo-list__cell :deep(.dashboard-list-card__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.profile-repo-list__cell :deep(.dashboard-list-card__meta) {
  margin-top: auto;
}

/* The shared card style clamps descriptions to a single line; give grid cards
   room for up to three lines before truncating. */
.profile-repo-list__cell :deep(.dashboard-list-card__description) {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.profile-repo-list__pagination {
  margin-top: 0.5rem;
}

.profile-repo-list__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 10rem;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.profile-repo-list__status--error {
  color: var(--gitpulse-danger);
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
</style>
