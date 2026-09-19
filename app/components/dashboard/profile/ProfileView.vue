<script setup lang="ts">
import { AlertTriangleIcon, Loader2Icon } from '@lucide/vue';
import { computed, toRef } from 'vue';

import type { PackageSummary, PackageType } from '#shared/types/packages';
import ContributionGraph from '~/components/dashboard/profile/ContributionGraph.vue';
import ProfileHeader from '~/components/dashboard/profile/ProfileHeader.vue';
import ProfilePackageList from '~/components/dashboard/profile/ProfilePackageList.vue';
import ProfilePinnedRepos from '~/components/dashboard/profile/ProfilePinnedRepos.vue';
import ProfileReadme from '~/components/dashboard/profile/ProfileReadme.vue';
import ProfileRepositoryList from '~/components/dashboard/profile/ProfileRepositoryList.vue';
import ProfileTabNav, { type ProfileTab } from '~/components/dashboard/profile/ProfileTabNav.vue';
import UserConnectionList from '~/components/dashboard/profile/UserConnectionList.vue';
import { useUserProfile } from '~/composables/useUserProfile';

export type { ProfileTab };

/** Everything the profile page needs to route to the package detail page. */
export interface ProfilePackageSelection {
  name: string;
  packageType: PackageType;
  isOrganization: boolean;
}

const props = defineProps<{
  username: string;
}>();

const emit = defineEmits<{
  (e: 'select-user', login: string): void;
  (e: 'select-package', selection: ProfilePackageSelection): void;
}>();

const tab = defineModel<ProfileTab>('tab', { default: 'overview' });

const { t } = useI18n();

const {
  profile,
  readme,
  contributions,
  organizations,
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
    id: 'repositories' as const,
    label: t('profile.tabs.repositories'),
    count: profile.value?.publicRepos,
  },
  { id: 'packages' as const, label: t('profile.tabs.packages') },
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

// Organizations are not GraphQL `user`s and have no contribution wall on GitHub either.
const isOrganization = computed(() => profile.value?.type === 'Organization');

const handlePackageSelect = (pkg: PackageSummary) => {
  emit('select-package', {
    name: pkg.name,
    packageType: pkg.packageType,
    isOrganization: isOrganization.value,
  });
};

const showOverviewSkeleton = computed(
  () =>
    tab.value === 'overview' &&
    (loadingReadme.value || (!isOrganization.value && loadingContributions.value))
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
        <ProfileHeader
          :profile="profile"
          :organizations="organizations"
          @show-connections="tab = $event"
        />
      </aside>

      <div class="profile-view__main">
        <ProfileTabNav v-model="tab" :tabs="tabs" />

        <div v-if="tab === 'overview'" class="profile-view__overview">
          <div v-if="showOverviewSkeleton" class="profile-view__status">
            <Loader2Icon :size="24" class="spin-animation" aria-hidden="true" />
          </div>

          <template v-else>
            <ProfileReadme :login="profile.login" :readme="readme" />

            <ProfilePinnedRepos :username="profile.login" />

            <template v-if="!isOrganization">
              <ContributionGraph v-if="contributions" :calendar="contributions" />
              <div
                v-else-if="contributionsError"
                class="profile-view__status profile-view__status--error profile-view__status--inline"
              >
                <p>{{ contributionsError }}</p>
              </div>
            </template>
          </template>
        </div>

        <ProfileRepositoryList
          v-else-if="tab === 'repositories'"
          :username="profile.login"
          :empty-label="t('profile.emptyRepositories')"
        />

        <ProfilePackageList
          v-else-if="tab === 'packages'"
          :username="profile.login"
          :is-organization="isOrganization"
          :empty-label="t('profile.emptyPackages')"
          @select-package="handlePackageSelect"
        />

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
  min-width: 0;
  margin: 0 auto;
  overflow-x: hidden;
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

.profile-view__overview {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
