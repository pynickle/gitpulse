<script setup lang="ts">
import { XIcon } from '@lucide/vue';

import type { FollowedRepository } from '#shared/types/release-follows';

defineProps<{
  items: FollowedRepository[];
}>();

const emit = defineEmits<{
  remove: [id: string];
  clear: [];
  return: [];
}>();

const { t } = useI18n();

const repoLabel = (item: FollowedRepository) => `${item.owner}/${item.name}`;
</script>

<template>
  <div class="followed-list">
    <div class="followed-list__header">
      <h2 class="followed-list__title">
        {{ t('releaseFollows.followedHeading') }}
        <span class="followed-list__count">{{ items.length }}</span>
      </h2>
      <div class="followed-list__actions">
        <button
          class="followed-list__action"
          type="button"
          :disabled="items.length === 0"
          @click="emit('clear')"
        >
          {{ t('releaseFollows.clear') }}
        </button>
        <button class="followed-list__action" type="button" @click="emit('return')">
          {{ t('releaseFollows.return') }}
        </button>
      </div>
    </div>

    <p v-if="items.length === 0" class="followed-list__empty">
      {{ t('releaseFollows.emptyFollowed') }}
    </p>

    <ul v-else class="followed-list__items">
      <li v-for="item in items" :key="item.id" class="followed-list__item">
        <span class="followed-list__name" :title="repoLabel(item)">{{ repoLabel(item) }}</span>
        <button
          class="followed-list__remove"
          type="button"
          :aria-label="t('releaseFollows.remove', { repo: repoLabel(item) })"
          @click="emit('remove', item.id)"
        >
          <XIcon :size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.followed-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.followed-list__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.followed-list__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.followed-list__count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
}

.followed-list__actions {
  display: flex;
  gap: 0.5rem;
}

.followed-list__action {
  flex: 1;
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md, 6px);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  font-size: 0.8rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__empty {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.followed-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
}

.followed-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--gitpulse-border);
}

.followed-list__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}

.followed-list__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}
</style>
