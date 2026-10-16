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
    content-class="release-follows-overlay-content is-flush"
    @back="handleBack"
    @home="handleHome"
  >
    <ReleaseFollowsConfigPage />
  </DashboardOverlayFrame>
</template>

<style lang="scss">
/* The page owns every scroll container below the overlay, so the frame drops
   its own scrolling and padding and hands over one full-height flex box. The
   content class lands on the SimpleBar content element as well; flattening that
   wrapper lets the page itself be the flex item that fills the overlay. */
.card-content.release-follows-overlay-content {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.simplebar-content.release-follows-overlay-content {
  display: contents;
}
</style>
