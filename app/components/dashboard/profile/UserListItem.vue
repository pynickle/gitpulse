<script setup lang="ts">
import { computed } from 'vue';

import type { UserSummary } from '#shared/types/users';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

const props = defineProps<{
  user: UserSummary;
}>();

const emit = defineEmits<{
  (e: 'select', login: string): void;
}>();

const displayName = computed(() => props.user.name?.trim() || props.user.login);
const showSecondaryLogin = computed(
  () => Boolean(props.user.name?.trim()) && props.user.name?.trim() !== props.user.login
);
</script>

<template>
  <button type="button" class="user-list-item" @click="emit('select', user.login)">
    <GitHubAvatar
      :src="user.avatarUrl"
      :alt="displayName"
      size="40"
      variant="raised"
      class="user-list-item__avatar"
    />
    <span class="user-list-item__identity">
      <span class="user-list-item__name">{{ displayName }}</span>
      <span v-if="showSecondaryLogin" class="user-list-item__login">{{ user.login }}</span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.user-list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    transform 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }

  &:active {
    transform: translateY(1px);
  }
}

.user-list-item__avatar {
  flex-shrink: 0;
}

.user-list-item__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.user-list-item__name {
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-list-item__login {
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
