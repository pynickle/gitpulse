<script setup lang="ts">
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-vue-next';

const colorMode = useColorMode();
const { t } = useI18n();

const modes = [
  { value: 'system', icon: MonitorIcon, labelKey: 'colorMode.system' },
  { value: 'light', icon: SunIcon, labelKey: 'colorMode.light' },
  { value: 'dark', icon: MoonIcon, labelKey: 'colorMode.dark' },
] as const;
</script>

<template>
  <ColorScheme tag="span">
    <span class="color-mode-toggle" role="group" :aria-label="t('colorMode.label')">
      <button
        v-for="mode in modes"
        :key="mode.value"
        class="color-mode-toggle__button"
        :class="{ 'is-active': colorMode.preference === mode.value }"
        type="button"
        :title="t(mode.labelKey)"
        :aria-label="t(mode.labelKey)"
        :aria-pressed="colorMode.preference === mode.value"
        @click="colorMode.preference = mode.value"
      >
        <component :is="mode.icon" :size="15" />
      </button>
    </span>

    <template #placeholder>
      <span class="color-mode-toggle" aria-hidden="true">
        <span class="color-mode-toggle__button is-active">
          <MonitorIcon :size="15" />
        </span>
      </span>
    </template>
  </ColorScheme>
</template>

<style scoped lang="scss">
.color-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.18rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
}

.color-mode-toggle__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;

  &:hover,
  &:focus-visible {
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 2px;
  }

  &.is-active {
    background: var(--gitpulse-accent);
    color: #fff;
    box-shadow: 0 1px 3px color-mix(in srgb, var(--gitpulse-accent) 35%, transparent);
  }
}
</style>
