<script setup lang="ts">
import { AlertTriangleIcon, Loader2Icon } from '@lucide/vue';
import { computed, toRef } from 'vue';

import ContributionGraph from '~/components/dashboard/profile/ContributionGraph.vue';
import ProfileHeader from '~/components/dashboard/profile/ProfileHeader.vue';
import ProfileReadme from '~/components/dashboard/profile/ProfileReadme.vue';
import UserConnectionList from '~/components/dashboard/profile/UserConnectionList.vue';
import { useUserProfile } from '~/composables/useUserProfile';

export type ProfileTab = 'overview' | 'followers' | 'following';

const props = defineProps<{
  username: string;
}>();

const emit = defineEmits<{
  (e: 'select-user', login: string): void;
}>();

const tab = defineModel<ProfileTab>('tab', { default: 'overview' });

const { t } = useI18n();

const {
  profile,
  readme,
  contributions,
  loadingProfile,
  loadingReadme,
  loadingContributions,
  profileError,
  contributionsError,
  refresh,
} = useUserProfile(toRef(props, 'username'));

const tabs = computed(() => [
  { id: 'overview' as const, label: t('profile.tabs.overview') },
  {
    id: 'followers' as const,
    label: t('profile.tabs.followers'),
    count: profile.value?.followers,
  },
  {
    id: 'following' as const,
    label: t('profile.tabs.following'),
    count: profile.value?.following,
  },
]);

const showOverviewSkeleton = computed(
  () => tab.value === 'overview' && (loadingReadme.value || loadingContributions.value)
);
</script>

<template>
  <div class="profile-view">
    <div v-if="loadingProfile" class="profile-view__status">
      <Loader2Icon :size="28" class="spin-animation" aria-hidden="true" />
    </div>

    <div v-else-if="profileError" class="profile-view__status profile-view__status--error">
      <AlertTriangleIcon :size="32" aria-hidden="true" />
      <p>{{ profileError }}</p>
      <button type="button" class="button is-small is-light" @click="refresh">
        {{ t('profile.retry') }}
      </button>
    </div>

    <div v-else-if="profile" class="profile-view__layout">
      <aside class="profile-view__sidebar">
        <ProfileHeader :profile="profile" @show-connections="tab = $event" />
      </aside>

      <div class="profile-view__main">
        <nav class="profile-view__tabs" role="tablist">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            role="tab"
            class="profile-view__tab"
            :class="{ 'profile-view__tab--active': tab === item.id }"
            :aria-selected="tab === item.id"
            @click="tab = item.id"
          >
            <span>{{ item.label }}</span>
            <span v-if="typeof item.count === 'number'" class="profile-view__tab-count">
              {{ item.count }}
            </span>
          </button>
        </nav>

        <div v-if="tab === 'overview'" class="profile-view__overview">
          <div v-if="showOverviewSkeleton" class="profile-view__status">
            <Loader2Icon :size="24" class="spin-animation" aria-hidden="true" />
          </div>

          <template v-else>
            <ProfileReadme :login="profile.login" :readme="readme" />

            <ContributionGraph v-if="contributions" :calendar="contributions" />
            <div
              v-else-if="contributionsError"
              class="profile-view__status profile-view__status--error profile-view__status--inline"
            >
              <p>{{ contributionsError }}</p>
            </div>
          </template>
        </div>

        <UserConnectionList
          v-else
          :username="profile.login"
          :relation="tab"
          :empty-label="
            tab === 'followers' ? t('profile.emptyFollowers') : t('profile.emptyFollowing')
          "
          @select="emit('select-user', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  width: 100%;
  max-width: 76rem;
  margin: 0 auto;
}

.profile-view__layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.profile-view__sidebar {
  position: sticky;
  top: 0;
}

.profile-view__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1.25rem;
}

.profile-view__tabs {
  display: flex;
  gap: 0.35rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.profile-view__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }
}

.profile-view__tab--active {
  border-bottom-color: var(--gitpulse-accent);
  color: var(--gitpulse-text-strong);
  font-weight: 600;
}

.profile-view__tab-count {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-active);
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.profile-view__overview {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-view__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 14rem;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.profile-view__status--error {
  color: var(--gitpulse-danger);
}

.profile-view__status--inline {
  min-height: 6rem;
  border: 1px dashed var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg, 10px);
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

@media (max-width: 1023px) {
  .profile-view__layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .profile-view__sidebar {
    position: static;
  }
}
</style>
