<script setup lang="ts">
import { computed } from 'vue';

import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import ProfileView, { type ProfileTab } from '~/components/dashboard/profile/ProfileView.vue';
import getQueryParamValue from '~/utils/getQueryParamValue';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const { user } = useUserSession();

const VALID_TABS = new Set<ProfileTab>(['overview', 'followers', 'following']);

const sessionLogin = computed(() => user.value?.login ?? '');

/** Target profile: `?user=` query, falling back to the signed-in user. */
const username = computed(() => getQueryParamValue(route.query.user)?.trim() || sessionLogin.value);

const activeTab = computed<ProfileTab>(() => {
  const raw = getQueryParamValue(route.query.tab) as ProfileTab | undefined;
  return raw && VALID_TABS.has(raw) ? raw : 'overview';
});

const pageTitle = computed(() =>
  username.value ? t('profile.pageTitle', { login: username.value }) : t('profile.pageTitleGeneric')
);

usePageMeta(pageTitle);

const updateTab = async (tab: ProfileTab) => {
  if (tab === activeTab.value) {
    return;
  }
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      tab: tab === 'overview' ? undefined : tab,
    },
  });
};

const openUserProfile = async (login: string) => {
  if (!login || login === username.value) {
    return;
  }
  await router.push({
    path: localePath('/dashboard/profile'),
    query: { user: login },
  });
};

const handleBack = async () => {
  await router.push(localePath('/dashboard'));
};
</script>

<template>
  <DashboardOverlayFrame
    :loading="false"
    loading-title=""
    loading-subtitle=""
    :back-label="t('profile.backToDashboard')"
    home-label=""
    :show-home-button="false"
    @back="handleBack"
  >
    <ProfileView
      v-if="username"
      :username="username"
      :tab="activeTab"
      @update:tab="updateTab"
      @select-user="openUserProfile"
    />
    <div v-else class="profile-page__empty">
      <p>{{ t('profile.noUser') }}</p>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.profile-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}
</style>
