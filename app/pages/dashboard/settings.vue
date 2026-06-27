<script setup lang="ts">
import {
  BellIcon,
  CheckIcon,
  LayoutPanelLeftIcon,
  LinkIcon,
  PaletteIcon,
  SearchIcon,
  TypeIcon,
} from '@lucide/vue';
import type { Component } from 'vue';
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import {
  NOTIFICATION_READ_MARK_DELAY_SECONDS,
  type AppFontId,
  type CodeFontId,
  type LinkTargetId,
  type NotificationReadMarkDelaySeconds,
  type NotificationReadMarkMode,
  type ShikiDarkThemeId,
  type ShikiLightThemeId,
} from '#shared/types/user-settings';
import { normalizeSystemFontFamily } from '#shared/utils/user-settings';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import FilterDropdown from '~/components/ui/FilterDropdown.vue';
import type { FilterOption } from '~/components/ui/FilterDropdown.vue';
import FontPickerModal from '~/components/ui/FontPickerModal.vue';
import {
  builtinAppFontOptions,
  builtinCodeFontOptions,
  shikiDarkThemeOptions,
  shikiLightThemeOptions,
  useUserSettings,
} from '~/composables/useUserSettings';

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const {
  settings,
  loading,
  error,
  loadSettings,
  updateFonts,
  updateAppearance,
  updateNavigation,
  updateNotificationBehavior,
} = useUserSettings();

// SEO: settings page title
usePageMeta(t('dashboard.settings.pageTitle'));

type SettingsCategory = 'appearance' | 'notifications' | 'navigation';

const activeSettingsCategory = shallowRef<SettingsCategory>('appearance');
const settingsCategoryMeta = {
  appearance: {
    icon: PaletteIcon,
    titleKey: 'dashboard.settings.appearanceTitle',
    descriptionKey: 'dashboard.settings.appearanceDescription',
  },
  notifications: {
    icon: BellIcon,
    titleKey: 'dashboard.settings.notificationBehaviorTitle',
    descriptionKey: 'dashboard.settings.notificationBehaviorDescription',
  },
  navigation: {
    icon: LinkIcon,
    titleKey: 'dashboard.settings.navigationTitle',
    descriptionKey: 'dashboard.settings.navigationDescription',
  },
} satisfies Record<
  SettingsCategory,
  {
    icon: Component;
    titleKey: string;
    descriptionKey: string;
  }
>;

const activeSettingsCategoryMeta = computed(
  () => settingsCategoryMeta[activeSettingsCategory.value]
);

// Font picker modal state
const showAppFontPicker = shallowRef(false);
const showCodeFontPicker = shallowRef(false);

// Editable font name state
const editingAppFont = shallowRef(false);
const editingCodeFont = shallowRef(false);
const appFontInput = shallowRef('');
const codeFontInput = shallowRef('');
const appFontInputInitial = shallowRef('');
const codeFontInputInitial = shallowRef('');
const appFontInputRef = useTemplateRef<HTMLInputElement>('appFontInput');
const codeFontInputRef = useTemplateRef<HTMLInputElement>('codeFontInput');

// Bundled-only options passed to the modal; the modal loads system fonts on demand
const bundledAppFontOptions = builtinAppFontOptions.map((f) => ({
  id: f.id,
  label: f.label,
  source: 'bundled' as const,
}));

const bundledCodeFontOptions = builtinCodeFontOptions.map((f) => ({
  id: f.id,
  label: f.label,
  source: 'bundled' as const,
}));

const shikiLightDropdownOptions: FilterOption[] = shikiLightThemeOptions.map((theme) => ({
  value: theme.id,
  label: theme.label,
}));

const shikiDarkDropdownOptions: FilterOption[] = shikiDarkThemeOptions.map((theme) => ({
  value: theme.id,
  label: theme.label,
}));

const notificationReadMarkModeOptions: FilterOption[] = [
  {
    value: 'delayed',
    label: t('dashboard.settings.notificationReadMarkModeDelayed'),
    description: t('dashboard.settings.notificationReadMarkModeDelayedDescription'),
  },
  {
    value: 'immediate',
    label: t('dashboard.settings.notificationReadMarkModeImmediate'),
    description: t('dashboard.settings.notificationReadMarkModeImmediateDescription'),
  },
  {
    value: 'manual',
    label: t('dashboard.settings.notificationReadMarkModeManual'),
    description: t('dashboard.settings.notificationReadMarkModeManualDescription'),
  },
];

const notificationReadMarkDelayOptions: FilterOption[] = NOTIFICATION_READ_MARK_DELAY_SECONDS.map(
  (seconds) => ({
    value: String(seconds),
    label: t('dashboard.settings.notificationReadMarkDelaySeconds', {
      seconds: String(seconds),
    }),
  })
);

const showNotificationReadMarkDelay = computed(() => {
  return settings.value.notificationBehavior.readMarkMode === 'delayed';
});

const linkTargetOptions: {
  value: LinkTargetId;
  icon: Component;
  label: string;
  description: string;
}[] = [
  {
    value: 'gitpulse',
    icon: LayoutPanelLeftIcon,
    label: t('dashboard.settings.linkTargetGitPulse'),
    description: t('dashboard.settings.linkTargetGitPulseDescription'),
  },
  {
    value: 'github',
    icon: GitHubIcon,
    label: t('dashboard.settings.linkTargetGithub'),
    description: t('dashboard.settings.linkTargetGithubDescription'),
  },
];

// Current font display names
const currentAppFontName = computed(() => {
  const { appFont, appSystemFont } = settings.value.fonts;
  if (appFont === 'system' && appSystemFont) return appSystemFont;
  const found = builtinAppFontOptions.find((f) => f.id === appFont);
  return found?.label ?? appFont;
});

const currentCodeFontName = computed(() => {
  const { codeFont, codeSystemFont } = settings.value.fonts;
  if (codeFont === 'system' && codeSystemFont) return codeSystemFont;
  const found = builtinCodeFontOptions.find((f) => f.id === codeFont);
  return found?.label ?? codeFont;
});

const appFontPickerValue = computed(() => {
  const { appFont, appSystemFont } = settings.value.fonts;
  return appFont === 'system' && appSystemFont ? `system:${appSystemFont}` : appFont;
});

const codeFontPickerValue = computed(() => {
  const { codeFont, codeSystemFont } = settings.value.fonts;
  return codeFont === 'system' && codeSystemFont ? `system:${codeSystemFont}` : codeFont;
});

// Apply font from modal selection
const applyAppFontFromModal = (fontId: string) => {
  if (fontId.startsWith('system:')) {
    const appSystemFont = normalizeSystemFontFamily(fontId.slice('system:'.length));
    if (appSystemFont) {
      void updateFonts({ appFont: 'system', appSystemFont });
    }
  } else if (builtinAppFontOptions.some((f) => f.id === fontId)) {
    void updateFonts({ appFont: fontId as AppFontId });
  }
};

const applyCodeFontFromModal = (fontId: string) => {
  if (fontId.startsWith('system:')) {
    const codeSystemFont = normalizeSystemFontFamily(fontId.slice('system:'.length));
    if (codeSystemFont) {
      void updateFonts({ codeFont: 'system', codeSystemFont });
    }
  } else if (builtinCodeFontOptions.some((f) => f.id === fontId)) {
    void updateFonts({ codeFont: fontId as CodeFontId });
  }
};

const applyLightShikiTheme = (themeId: string) => {
  if (shikiLightThemeOptions.some((theme) => theme.id === themeId)) {
    void updateAppearance({ shikiLightTheme: themeId as ShikiLightThemeId });
  }
};

const applyDarkShikiTheme = (themeId: string) => {
  if (shikiDarkThemeOptions.some((theme) => theme.id === themeId)) {
    void updateAppearance({ shikiDarkTheme: themeId as ShikiDarkThemeId });
  }
};

const applyNotificationReadMarkMode = (mode: string) => {
  if (mode === 'delayed' || mode === 'immediate' || mode === 'manual') {
    void updateNotificationBehavior({ readMarkMode: mode as NotificationReadMarkMode });
  }
};

const applyNotificationReadMarkDelay = (secondsValue: string) => {
  const seconds = Number.parseInt(secondsValue, 10);
  if (NOTIFICATION_READ_MARK_DELAY_SECONDS.includes(seconds as NotificationReadMarkDelaySeconds)) {
    void updateNotificationBehavior({
      readMarkDelaySeconds: seconds as NotificationReadMarkDelaySeconds,
    });
  }
};

const applyLinkTarget = (value: string) => {
  if (value === 'gitpulse' || value === 'github') {
    void updateNavigation({ linkTarget: value });
  }
};

// Manual input handlers
const focusEditableFontInput = (input: HTMLInputElement | null) => {
  if (!input) return;

  input.focus({ preventScroll: true });
  const cursorPosition = input.value.length;
  input.setSelectionRange(cursorPosition, cursorPosition);
};

const getChangedSystemFontInput = (value: string, initialValue: string) => {
  const systemFont = normalizeSystemFontFamily(value);
  if (!systemFont || systemFont === normalizeSystemFontFamily(initialValue)) {
    return undefined;
  }

  return systemFont;
};

const startEditingAppFont = () => {
  const currentName = currentAppFontName.value;
  appFontInput.value = currentName;
  appFontInputInitial.value = currentName;
  editingAppFont.value = true;
  void nextTick(() => focusEditableFontInput(appFontInputRef.value));
};

const startEditingCodeFont = () => {
  const currentName = currentCodeFontName.value;
  codeFontInput.value = currentName;
  codeFontInputInitial.value = currentName;
  editingCodeFont.value = true;
  void nextTick(() => focusEditableFontInput(codeFontInputRef.value));
};

const applyAppFontFromInput = () => {
  editingAppFont.value = false;
  const appSystemFont = getChangedSystemFontInput(appFontInput.value, appFontInputInitial.value);
  if (appSystemFont) {
    void updateFonts({ appFont: 'system', appSystemFont });
  }
};

const applyCodeFontFromInput = () => {
  editingCodeFont.value = false;
  const codeSystemFont = getChangedSystemFontInput(codeFontInput.value, codeFontInputInitial.value);
  if (codeSystemFont) {
    void updateFonts({ codeFont: 'system', codeSystemFont });
  }
};

const handleAppFontInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    applyAppFontFromInput();
  } else if (e.key === 'Escape') {
    editingAppFont.value = false;
  }
};

const handleCodeFontInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    applyCodeFontFromInput();
  } else if (e.key === 'Escape') {
    editingCodeFont.value = false;
  }
};

const handleBack = () => {
  void router.push(localePath('/dashboard'));
};

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="loading"
    :loading-title="t('dashboard.settings.statusLoading')"
    loading-subtitle=""
    :back-label="t('dashboard.settings.backToDashboard')"
    home-label=""
    :show-home-button="false"
    @back="handleBack"
  >
    <div class="settings">
      <!-- Sidebar -->
      <aside class="settings__sidebar">
        <nav class="settings__nav">
          <div class="settings__nav-group">
            <span class="settings__nav-label">{{ t('dashboard.settings.pageTitle') }}</span>
            <button
              class="settings__nav-item"
              :class="{ 'is-active': activeSettingsCategory === 'appearance' }"
              type="button"
              @click="activeSettingsCategory = 'appearance'"
            >
              <TypeIcon :size="15" />
              <span>{{ t('dashboard.settings.appearanceTitle') }}</span>
            </button>
            <button
              class="settings__nav-item"
              :class="{ 'is-active': activeSettingsCategory === 'notifications' }"
              type="button"
              @click="activeSettingsCategory = 'notifications'"
            >
              <BellIcon :size="15" />
              <span>{{ t('dashboard.settings.notificationBehaviorTitle') }}</span>
            </button>
            <button
              class="settings__nav-item"
              :class="{ 'is-active': activeSettingsCategory === 'navigation' }"
              type="button"
              @click="activeSettingsCategory = 'navigation'"
            >
              <LinkIcon :size="15" />
              <span>{{ t('dashboard.settings.navigationTitle') }}</span>
            </button>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="settings__main">
        <div class="settings__content">
          <div class="settings__header">
            <div class="settings__header-icon">
              <component :is="activeSettingsCategoryMeta.icon" :size="20" />
            </div>
            <div>
              <h1 class="settings__title">{{ t(activeSettingsCategoryMeta.titleKey) }}</h1>
              <p class="settings__desc">
                {{ t(activeSettingsCategoryMeta.descriptionKey) }}
              </p>
            </div>
          </div>

          <div v-if="error" class="settings__error">{{ error }}</div>

          <template v-if="activeSettingsCategory === 'appearance'">
            <!-- App Font -->
            <section class="settings__section">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.appFontSection') }}
              </h2>
              <div class="settings__font-card">
                <div class="settings__font-field">
                  <label class="settings__label">{{ t('dashboard.settings.appFontLabel') }}</label>
                  <div class="settings__font-input-row">
                    <input
                      v-if="editingAppFont"
                      ref="appFontInput"
                      v-model="appFontInput"
                      class="settings__font-input"
                      type="text"
                      @blur="applyAppFontFromInput"
                      @keydown="handleAppFontInputKeydown"
                    />
                    <span v-else class="settings__font-value" @click="startEditingAppFont">
                      {{ currentAppFontName }}
                    </span>
                    <button
                      class="settings__font-picker-btn"
                      type="button"
                      :aria-label="t('dashboard.settings.selectAppFont')"
                      @click="showAppFontPicker = true"
                    >
                      <SearchIcon :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Code Font -->
            <section class="settings__section">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.codeFontSection') }}
              </h2>
              <div class="settings__font-card">
                <div class="settings__font-field">
                  <label class="settings__label">{{ t('dashboard.settings.codeFontLabel') }}</label>
                  <div class="settings__font-input-row">
                    <input
                      v-if="editingCodeFont"
                      ref="codeFontInput"
                      v-model="codeFontInput"
                      class="settings__font-input"
                      type="text"
                      @blur="applyCodeFontFromInput"
                      @keydown="handleCodeFontInputKeydown"
                    />
                    <span v-else class="settings__font-value" @click="startEditingCodeFont">
                      {{ currentCodeFontName }}
                    </span>
                    <button
                      class="settings__font-picker-btn"
                      type="button"
                      :aria-label="t('dashboard.settings.selectCodeFont')"
                      @click="showCodeFontPicker = true"
                    >
                      <SearchIcon :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Code Highlighting -->
            <section class="settings__section">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.codeHighlightSection') }}
              </h2>
              <div class="settings__font-card">
                <div class="settings__font-field">
                  <label class="settings__label">
                    {{ t('dashboard.settings.shikiLightThemeLabel') }}
                  </label>
                  <div class="settings__dropdown-row">
                    <FilterDropdown
                      :model-value="settings.appearance.shikiLightTheme"
                      :options="shikiLightDropdownOptions"
                      :placeholder="t('dashboard.settings.shikiLightThemeLabel')"
                      :aria-label="t('dashboard.settings.shikiLightThemeLabel')"
                      @update:model-value="applyLightShikiTheme"
                    />
                  </div>
                </div>

                <div class="settings__font-field">
                  <label class="settings__label">
                    {{ t('dashboard.settings.shikiDarkThemeLabel') }}
                  </label>
                  <div class="settings__dropdown-row">
                    <FilterDropdown
                      :model-value="settings.appearance.shikiDarkTheme"
                      :options="shikiDarkDropdownOptions"
                      :placeholder="t('dashboard.settings.shikiDarkThemeLabel')"
                      :aria-label="t('dashboard.settings.shikiDarkThemeLabel')"
                      @update:model-value="applyDarkShikiTheme"
                    />
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="activeSettingsCategory === 'notifications'">
            <section class="settings__section">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.notificationReadSection') }}
              </h2>
              <div class="settings__font-card">
                <div class="settings__font-field">
                  <label class="settings__label">
                    {{ t('dashboard.settings.notificationReadMarkModeLabel') }}
                  </label>
                  <div class="settings__dropdown-row">
                    <FilterDropdown
                      :model-value="settings.notificationBehavior.readMarkMode"
                      :options="notificationReadMarkModeOptions"
                      :placeholder="t('dashboard.settings.notificationReadMarkModeLabel')"
                      :aria-label="t('dashboard.settings.notificationReadMarkModeLabel')"
                      @update:model-value="applyNotificationReadMarkMode"
                    />
                  </div>
                </div>

                <div v-if="showNotificationReadMarkDelay" class="settings__font-field">
                  <label class="settings__label">
                    {{ t('dashboard.settings.notificationReadMarkDelayLabel') }}
                  </label>
                  <div class="settings__dropdown-row">
                    <FilterDropdown
                      :model-value="String(settings.notificationBehavior.readMarkDelaySeconds)"
                      :options="notificationReadMarkDelayOptions"
                      :placeholder="t('dashboard.settings.notificationReadMarkDelayLabel')"
                      :aria-label="t('dashboard.settings.notificationReadMarkDelayLabel')"
                      @update:model-value="applyNotificationReadMarkDelay"
                    />
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="settings__section">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.linkTargetSection') }}
              </h2>
              <div
                class="settings__option-group"
                role="radiogroup"
                :aria-label="t('dashboard.settings.linkTargetSection')"
              >
                <label
                  v-for="option in linkTargetOptions"
                  :key="option.value"
                  class="settings__option-card"
                  :class="{ 'is-selected': settings.navigation.linkTarget === option.value }"
                >
                  <input
                    class="settings__option-input"
                    type="radio"
                    name="linkTarget"
                    :value="option.value"
                    :checked="settings.navigation.linkTarget === option.value"
                    :aria-label="option.label"
                    @change="applyLinkTarget(option.value)"
                  />
                  <span class="settings__option-icon-wrap" aria-hidden="true">
                    <component :is="option.icon" class="settings__option-icon" />
                  </span>
                  <span class="settings__option-body">
                    <span class="settings__option-label">{{ option.label }}</span>
                    <span class="settings__option-desc">{{ option.description }}</span>
                  </span>
                  <CheckIcon class="settings__option-check" :size="16" aria-hidden="true" />
                </label>
              </div>
            </section>
          </template>
        </div>
      </main>
    </div>

    <!-- Font Picker Modals -->
    <FontPickerModal
      :is-visible="showAppFontPicker"
      :title="t('dashboard.settings.selectAppFont')"
      :model-value="appFontPickerValue"
      :bundled-fonts="bundledAppFontOptions"
      @close="showAppFontPicker = false"
      @update:model-value="applyAppFontFromModal"
    />

    <FontPickerModal
      :is-visible="showCodeFontPicker"
      :title="t('dashboard.settings.selectCodeFont')"
      :model-value="codeFontPickerValue"
      :bundled-fonts="bundledCodeFontOptions"
      @close="showCodeFontPicker = false"
      @update:model-value="applyCodeFontFromModal"
    />
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.settings {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── Sidebar ── */
.settings__sidebar {
  width: 14rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  background: transparent;
}

.settings__nav {
  flex: 1;
  padding: 0.75rem 0.5rem;
  overflow-y: auto;
}

.settings__nav-group {
  margin-bottom: 0.5rem;
}

.settings__nav-label {
  display: block;
  padding: 0 0.5rem 0.35rem;
  color: var(--gitpulse-text-subtle);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.settings__nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem 0.45rem 0.85rem;
  margin-left: 0.25rem;
  border-radius: 0 6px 6px 0;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-left-color: var(--gitpulse-accent);
    font-weight: 650;
  }
}

/* ── Main ── */
.settings__main {
  flex: 1;
  overflow-y: auto;
  /* Reserve scrollbar gutter so centered content (.settings__content uses
     margin: 0 auto) doesn't shift horizontally when the scrollbar appears
     or disappears across tabs with different content heights. */
  scrollbar-gutter: stable;
  background: var(--gitpulse-surface);
}

.settings__content {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;
}

/* ── Header ── */
.settings__header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.settings__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 10px;
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
  flex-shrink: 0;
}

.settings__title {
  margin: 0 0 0.15rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.settings__desc {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

/* ── Error ── */
.settings__error {
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 0.82rem;
  font-weight: 500;
}

/* ── Section (replaces CollapsibleGroup) ── */
.settings__section {
  margin-bottom: 1.75rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings__section-title {
  margin: 0 0 0.6rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* ── Font Card ── */
.settings__font-card {
  padding: 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
}

.settings__font-field {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings__label {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.82rem;
  font-weight: 650;
}

.settings__font-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings__font-value {
  flex: 1;
  height: 2.35rem;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  border: 1px solid var(--gitpulse-input-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.82rem;
  font-weight: 500;
  cursor: text;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
  }
}

.settings__font-input {
  flex: 1;
  height: 2.35rem;
  padding: 0 0.75rem;
  border: 1px solid var(--gitpulse-accent);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.82rem;
  font-weight: 500;
  outline: none;
  box-shadow: 0 0 0 3px var(--gitpulse-accent-soft);
}

.settings__dropdown-row {
  display: flex;
  min-width: 0;

  :deep(.filter-dropdown),
  :deep(.filter-dropdown-trigger) {
    width: 100%;
  }

  :deep(.filter-dropdown-trigger) {
    justify-content: space-between;
    height: 2.35rem;
    background: var(--gitpulse-surface-muted);
  }
}

/* ── Option cards (radio group) ── */
.settings__option-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.settings__option-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
  }

  &.is-selected {
    border-color: var(--gitpulse-accent);
    background: var(--gitpulse-accent-soft);
  }

  &:has(.settings__option-input:focus-visible) {
    box-shadow: 0 0 0 3px var(--gitpulse-accent-soft);
  }
}

.settings__option-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.settings__option-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;

  .settings__option-card.is-selected & {
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
  }
}

.settings__option-icon {
  width: 16px;
  height: 16px;
}

.settings__option-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.settings__option-label {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.85rem;
  font-weight: 650;
  line-height: 1.2;
}

.settings__option-desc {
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.settings__option-check {
  flex: 0 0 auto;
  align-self: center;
  color: var(--gitpulse-accent);
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;

  .settings__option-card.is-selected & {
    opacity: 1;
    transform: scale(1);
  }
}

.settings__font-picker-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Mobile ── */
@media screen and (max-width: 768px) {
  .settings {
    flex-direction: column;
  }

  .settings__sidebar {
    width: 100%;
  }

  .settings__nav {
    padding: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .settings__nav-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0;
  }

  .settings__nav-label {
    display: none;
  }

  .settings__nav-item {
    flex-shrink: 0;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
  }

  .settings__content {
    padding: 1.5rem 1rem 3rem;
  }

  .settings__header {
    margin-bottom: 1.5rem;
  }
}
</style>
