<template>
  <button
    class="color-mode-toggle button is-ghost"
    :title="isDark ? t('colorMode.switchToLight') : t('colorMode.switchToDark')"
    @click="toggle"
  >
    <span class="icon">
      <Sun v-if="isDark" :size="18" />
      <Moon v-else :size="18" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next';

const colorMode = useColorMode();
const { t } = useI18n();

const isDark = computed(() => colorMode.value === 'dark');

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>
