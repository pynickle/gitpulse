<template>
  <div class="activity-bar">
    <button
      type="button"
      class="activity-bar__avatar"
      :title="userName || 'User'"
      :aria-label="t('profile.openProfile')"
      @click="$emit('avatar-click')"
    >
      <GitHubAvatar
        :src="userAvatar"
        :alt="userName || 'User'"
        size="34"
        class="activity-bar__avatar-img"
      >
        <template #fallback>
          <UserIcon :size="18" />
        </template>
      </GitHubAvatar>
    </button>

    <nav class="activity-bar__groups" aria-label="View groups">
      <button
        v-for="group in primaryGroups"
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
      <div
        v-if="primaryGroups.length > 0 && mainGroups.length > 0"
        class="activity-bar__groups-divider"
        role="separator"
        aria-hidden="true"
      ></div>
      <button
        v-for="group in mainGroups"
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
      <button
        class="activity-bar__icon-btn"
        title="Logout"
        aria-label="Logout"
        type="button"
        @click="$emit('logout-click')"
      >
        <LogOutIcon :size="19" />
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
  ListTodoIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from '@lucide/vue';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

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
  'logout-click': [];
}>();

const { t } = useI18n();

const activityGroups = computed(() => props.groups ?? []);
const primaryGroups = computed(() => activityGroups.value.filter((group) => group.id === 'todos'));
const mainGroups = computed(() => activityGroups.value.filter((group) => group.id !== 'todos'));

const iconMap: Record<string, typeof UserIcon> = {
  'list-todo': ListTodoIcon,
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
  }

  &__groups {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  &__groups-divider {
    width: 20px;
    height: 1px;
    margin: 0.3rem 0;
    border-radius: 1px;
    background: var(--gitpulse-border);
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
    gap: 0.2rem;
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
