<script setup lang="ts">
import { RocketIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import { toFollowedRepository } from '#shared/utils/release-follows';
import RepoItem from '~/components/dashboard/RepoItem.vue';
import type { StarredRepo } from '~/composables/useStarredRepos';

const props = defineProps<{
  repo: StarredRepo;
  followed: boolean;
  addBlock: 'valid-cap' | 'stored-cap' | null;
}>();

const emit = defineEmits<{
  toggle: [repo: FollowedRepository];
}>();

const { t } = useI18n();

const followedIdentity = computed(() => {
  return toFollowedRepository({
    id: props.repo.node_id,
    owner: props.repo.owner?.login,
    name: props.repo.name,
  });
});

const canToggle = computed(() => {
  if (!followedIdentity.value) return false;
  if (props.followed) return true;
  return props.addBlock === null;
});

const badgeLabel = computed(() => {
  const fullName = `${props.repo.owner?.login ?? ''}/${props.repo.name}`;
  if (props.followed) {
    return t('releaseFollows.unfollow', { repo: fullName });
  }
  if (props.addBlock === 'stored-cap') {
    return t('releaseFollows.storedCap');
  }
  if (props.addBlock === 'valid-cap') {
    return t('releaseFollows.validCap');
  }
  return t('releaseFollows.follow', { repo: fullName });
});

const handleToggle = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (!canToggle.value || !followedIdentity.value) return;
  emit('toggle', followedIdentity.value);
};
</script>

<template>
  <div class="followable-repo-card">
    <RepoItem :repo="repo" class="followable-repo-card__item" />
    <button
      class="followable-repo-card__badge"
      type="button"
      :class="{ 'is-followed': followed, 'is-disabled': !canToggle }"
      :disabled="!canToggle"
      :aria-pressed="followed"
      :aria-label="badgeLabel"
      :title="badgeLabel"
      @click="handleToggle"
      @pointerdown.stop
    >
      <RocketIcon :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.followable-repo-card {
  position: relative;
  height: 100%;
}

.followable-repo-card :deep(.dashboard-list-card__text-stack) {
  padding-right: 2rem;
}

.followable-repo-card__item {
  height: 100%;
}

.followable-repo-card__badge {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  box-shadow: var(--gitpulse-shadow-raised);

  &:hover:not(:disabled) {
    color: var(--gitpulse-text-strong);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }

  &.is-followed {
    border-color: var(--gitpulse-accent);
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
  }

  &.is-disabled,
  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}
</style>
