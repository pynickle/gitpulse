<script setup lang="ts">
import { Loader2Icon, UsersIcon } from '@lucide/vue';
import { toRef } from 'vue';

import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import UserListItem from '~/components/dashboard/profile/UserListItem.vue';
import { useUserConnections, type UserConnectionRelation } from '~/composables/useUserConnections';

const props = defineProps<{
  username: string;
  relation: UserConnectionRelation;
  emptyLabel: string;
}>();

const emit = defineEmits<{
  (e: 'select', login: string): void;
}>();

const { t } = useI18n();

const { items, loading, error, pagination, showPagination, goToPage, refresh } = useUserConnections(
  toRef(props, 'username'),
  toRef(props, 'relation')
);
</script>

<template>
  <div class="user-connection-list">
    <div v-if="loading" class="user-connection-list__status">
      <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
    </div>

    <div v-else-if="error" class="user-connection-list__status user-connection-list__status--error">
      <p>{{ error }}</p>
      <button type="button" class="button is-small is-light" @click="refresh">
        {{ t('profile.retry') }}
      </button>
    </div>

    <template v-else-if="items.length">
      <div class="user-connection-list__items">
        <UserListItem
          v-for="user in items"
          :key="user.login"
          :user="user"
          @select="emit('select', $event)"
        />
      </div>

      <DashboardPagination
        v-if="showPagination"
        class="user-connection-list__pagination"
        :pagination="pagination"
        @change="goToPage"
      />
    </template>

    <div v-else class="user-connection-list__status user-connection-list__status--empty">
      <UsersIcon :size="26" aria-hidden="true" />
      <p>{{ emptyLabel }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-connection-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 1rem;
}

.user-connection-list__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.6rem;
}

.user-connection-list__pagination {
  margin-top: 0.5rem;
}

.user-connection-list__status {
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

.user-connection-list__status--error {
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
