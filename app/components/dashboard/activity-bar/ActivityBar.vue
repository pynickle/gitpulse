<template>
  <div class="activity-bar">
    <!-- User Avatar (top) -->
    <div class="activity-bar__avatar" @click="$emit('avatar-click')">
      <img
        v-if="userAvatar"
        :src="userAvatar"
        :alt="userName || 'User'"
        class="activity-bar__avatar-img"
      />
      <div v-else class="activity-bar__avatar-placeholder">
        <UserIcon :size="20" />
      </div>
    </div>

    <!-- Group Icons (middle) -->
    <div class="activity-bar__groups">
      <button
        v-for="group in groups"
        :key="group.id"
        class="activity-bar__icon-btn"
        :class="{ 'is-active': activeGroupId === group.id }"
        :title="group.name"
        @click="$emit('group-select', group.id)"
      >
        <component :is="getGroupIcon(group.icon)" :size="20" />
      </button>
    </div>

    <!-- Settings Icon (bottom) -->
    <div class="activity-bar__bottom">
      <button class="activity-bar__icon-btn" title="Settings" @click="$emit('settings-click')">
        <SettingsIcon :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  User as UserIcon,
  Settings as SettingsIcon,
  Inbox,
  Bell,
  CircleDot,
  GitPullRequest,
  BookMarked,
} from 'lucide-vue-next';

interface Group {
  id: string;
  name: string;
  icon?: string;
}

const props = defineProps<{
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
  inbox: Inbox,
  bell: Bell,
  'circle-dot': CircleDot,
  'git-pull-request': GitPullRequest,
  'book-marked': BookMarked,
  user: UserIcon,
  settings: SettingsIcon,
};

function getGroupIcon(icon?: string) {
  return iconMap[icon || 'inbox'] || Inbox;
}
</script>

<style scoped lang="scss">
.activity-bar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  background-color: transparent;
  border-right: 1px solid rgba(0, 0, 0, 0.05);

  @media (prefers-color-scheme: dark) {
    border-right: 1px solid rgba(255, 255, 255, 0.05);
  }

  &__avatar {
    margin-bottom: 1rem;
    cursor: pointer;
  }

  &__avatar-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  &__avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--bulma-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bulma-text-light);
  }

  &__groups {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  &__icon-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--bulma-text-light);
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);

    &:hover {
      background-color: var(--bulma-background-hover, rgba(0, 0, 0, 0.04));
      color: var(--bulma-text);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(1px);
    }

    &.is-active {
      background-color: var(--bulma-primary-light, rgba(0, 105, 255, 0.1));
      color: var(--bulma-primary);
      box-shadow: inset 2px 0 0 var(--bulma-primary);
    }
  }

  &__bottom {
    margin-top: auto;
  }
}
</style>
