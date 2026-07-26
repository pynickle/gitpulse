<script setup lang="ts">
import { Loader2Icon } from '@lucide/vue';
import { computed, toRef } from 'vue';

import RepoItem from '~/components/dashboard/RepoItem.vue';

const props = defineProps<{
  username: string;
}>();

const { t } = useI18n();

const { items, source, loading, error, refresh } = useProfilePinnedRepos(toRef(props, 'username'));

const title = computed(() =>
  source.value === 'popular' ? t('profile.pinned.popularTitle') : t('profile.pinned.title')
);

/** GitHub pins are read-only through the API, so an empty list just hides the section. */
const showSection = computed(() => loading.value || Boolean(error.value) || items.value.length > 0);
</script>

<template>
  <section v-if="showSection" class="profile-pinned">
    <header class="profile-pinned__header">
      <h2 class="profile-pinned__title">{{ title }}</h2>
    </header>

    <div v-if="loading" class="profile-pinned__status">
      <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
    </div>

    <div v-else-if="error" class="profile-pinned__status profile-pinned__status--error">
      <p>{{ error }}</p>
      <button type="button" class="button is-small is-light" @click="refresh">
        {{ t('profile.retry') }}
      </button>
    </div>

    <div v-else class="profile-pinned__grid">
      <RepoItem v-for="repo in items" :key="repo.id" :repo="repo" class="profile-pinned__card" />
    </div>
  </section>
</template>

<style scoped lang="scss">
.profile-pinned {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-pinned__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.profile-pinned__title {
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 600;
}

.profile-pinned__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 0.75rem;
  align-items: stretch;
}

.profile-pinned__card {
  height: 100%;
}

/* Match the repositories tab: pin the stats row to the card bottom. */
.profile-pinned__card :deep(.card-content) {
  height: 100%;
  display: flex;
}

.profile-pinned__card :deep(.dashboard-list-card__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.profile-pinned__card :deep(.dashboard-list-card__meta) {
  margin-top: auto;
}

.profile-pinned__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 7rem;
  padding: 1.5rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
  text-align: center;
}

.profile-pinned__status--error {
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
