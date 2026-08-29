<script setup lang="ts">
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import ReleaseFollowsConfigPage from '~/components/dashboard/release-follows/ReleaseFollowsConfigPage.vue';

const { t } = useI18n();
const { goBackToPreviousPage, goToDashboardHome, shouldShowHomeButton } = useNavigationRouting();

usePageMeta(t('releaseFollows.pageTitle'));

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
    :loading-title="t('releaseFollows.loadingTitle')"
    :loading-subtitle="t('releaseFollows.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    content-class="release-follows-overlay-content"
    @back="handleBack"
    @home="handleHome"
  >
    <ReleaseFollowsConfigPage @return="handleBack" />
  </DashboardOverlayFrame>
</template>

<style lang="scss">
.card-content.release-follows-overlay-content {
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
