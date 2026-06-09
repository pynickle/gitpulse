<script setup lang="ts">
import TabsSettingsPage from '~/components/dashboard/tabs-settings/TabsSettingsPage.vue';
import { useTabsSettingsPage } from '~/composables/useTabsSettingsPage';

const { t } = useI18n();
const tabsSettings = useTabsSettingsPage();

// SEO: tabs settings page title
usePageMeta(t('dashboard.tabsSettings.pageTitle'));
</script>

<template>
  <TabsSettingsPage :model="tabsSettings" />
</template>
