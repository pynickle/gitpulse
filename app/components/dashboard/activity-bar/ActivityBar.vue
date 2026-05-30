<template>
  <div class="activity-bar">
    <!-- User Avatar -->
    <button
      class="activity-bar__avatar"
      type="button"
      :title="userName || 'User'"
      @click="$emit('avatar-click')"
    >
      <img
        v-if="userAvatar"
        :src="userAvatar"
        :alt="userName || 'User'"
        class="activity-bar__avatar-img"
      />
      <div v-else class="activity-bar__avatar-placeholder">
        <UserIcon :size="18" />
      </div>
    </button>

    <!-- Group Icons -->
    <nav class="activity-bar__groups" aria-label="View groups">
      <button
        v-for="group in groups"
        :key="group.id"
        class="activity-bar__icon-btn"
        :class="{ 'is-active': activeGroupId === group.id }"
        :title="group.name"
        :aria-label="group.name"
        :aria-current="activeGroupId === group.id ? 'page' : undefined"
        type="button"
        @click="$emit('group-select', group.id)"
      >
        <component :is="getGroupIcon(group.icon)" :size="19" />
      </button>
    </nav>

    <!-- Settings -->
    <div class="activity-bar__bottom">
      <div class="activity-bar__divider" role="separator" aria-hidden="true"></div>
      <button
        class="activity-bar__icon-btn"
        title="Settings"
        aria-label="Settings"
        type="button"
        @click="$emit('settings-click')"
      >
        <SettingsIcon :size="19" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BellIcon,
  BookMarkedIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  InboxIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-vue-next';

interface Group {
  id: string;
  name: string;
  icon?: string;
}

defineProps<{
  userAvatar?: string;
  userName?: string;
  activeGroupId?: string;
  groups?: Group[];
}>();

defineEmits<{
  'avatar-click': [];
  'group-select': [groupId: string];
  'settings-click': [];
}>();

const iconMap: Record<string, typeof UserIcon> = {
  inbox: InboxIcon,
  bell: BellIcon,
  'circle-dot': CircleDotIcon,
  'git-pull-request': GitPullRequestIcon,
  'book-marked': BookMarkedIcon,
  user: UserIcon,
  settings: SettingsIcon,
};

function getGroupIcon(icon?: string) {
  return iconMap[icon || 'inbox'] || InboxIcon;
}
</script>

<style scoped lang="scss">
.activity-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0.75rem 0;
  background: transparent;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    margin-bottom: 1rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: box-shadow 0.15s ease;

    &:focus-visible {
      outline: 2px solid var(--gitpulse-focus-ring);
      outline-offset: 2px;
    }

    &:hover {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--gitpulse-accent) 25%, transparent);
    }

    &:active {
      opacity: 0.8;
    }
  }

  &__avatar-img {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
  }

  &__avatar-placeholder {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bulma-border, #d1d5db);
    color: var(--bulma-text-weak, #6b7280);
  }

  &__groups {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  &__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bulma-text-weak, #9ca3af);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: var(--bulma-background-hover);
      color: var(--bulma-text-strong, #1e293b);
    }

    &:focus-visible {
      outline: 2px solid var(--gitpulse-focus-ring);
      outline-offset: 1px;
    }

    &:active {
      background: var(--bulma-background-hover);
    }

    &.is-active {
      background: var(--gitpulse-surface-active);
      color: var(--gitpulse-accent);
    }
  }

  &__bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: auto;
  }

  &__divider {
    width: 20px;
    height: 1px;
    border-radius: 1px;
    background: var(--gitpulse-border);
    margin-bottom: 0.3rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity-bar__icon-btn,
  .activity-bar__avatar {
    transition: none;
  }

  .activity-bar__avatar:active {
    opacity: 1;
  }
}
</style>
