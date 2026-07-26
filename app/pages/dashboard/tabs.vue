<script setup lang="ts">
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import TabsSettingsPage from '~/components/dashboard/tabs-settings/TabsSettingsPage.vue';
import { useTabsSettingsPage } from '~/composables/useTabsSettingsPage';

const { t } = useI18n();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();
const tabsSettings = useTabsSettingsPage();

// SEO: tabs settings page title
usePageMeta(t('dashboard.tabsSettings.pageTitle'));

const handleBack = async () => {
  await goBackToPreviousPage();
};

const handleHome = async () => {
  await goToDashboardHome();
};
</script>

<template>
  <DashboardOverlayFrame
    :loading="false"
    loading-title=""
    loading-subtitle=""
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="p-0"
    @back="handleBack"
    @home="handleHome"
  >
    <TabsSettingsPage :model="tabsSettings" />
  </DashboardOverlayFrame>
</template>
