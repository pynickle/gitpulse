<script setup lang="ts">
import TabsSettingsPage from '~/components/dashboard/tabs-settings/TabsSettingsPage.vue';
import { useTabsSettingsPage } from '~/composables/useTabsSettingsPage';

const tabsSettings = useTabsSettingsPage();
</script>

<template>
  <TabsSettingsPage :model="tabsSettings" />
</template>
