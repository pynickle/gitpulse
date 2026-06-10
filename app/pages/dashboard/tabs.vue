<script setup lang="ts">
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import TabsSettingsPage from '~/components/dashboard/tabs-settings/TabsSettingsPage.vue';
import { useTabsSettingsPage } from '~/composables/useTabsSettingsPage';

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const tabsSettings = useTabsSettingsPage();

// SEO: tabs settings page title
usePageMeta(t('dashboard.tabsSettings.pageTitle'));

const handleBack = () => {
  void router.push(localePath('/dashboard'));
};
</script>

<template>
  <DashboardOverlayFrame
    :loading="false"
    loading-title=""
    loading-subtitle=""
    :back-label="t('dashboard.tabsSettings.backToDashboard')"
    home-label=""
    :show-home-button="false"
    content-class="p-0"
    @back="handleBack"
  >
    <TabsSettingsPage :model="tabsSettings" />
  </DashboardOverlayFrame>
</template>
