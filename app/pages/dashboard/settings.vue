<script setup lang="ts">
import { PaletteIcon, SearchIcon, TypeIcon } from 'lucide-vue-next';
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';

import type { AppFontId, CodeFontId } from '#shared/types/user-settings';
import { normalizeSystemFontFamily } from '#shared/utils/user-settings';
import FloatingRefreshButton from '~/components/dashboard/FloatingRefreshButton.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import FontPickerModal from '~/components/ui/FontPickerModal.vue';
import {
  builtinAppFontOptions,
  builtinCodeFontOptions,
  useUserSettings,
} from '~/composables/useUserSettings';

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const { settings, loading, saving, error, loadSettings, updateFonts } = useUserSettings();
const settingsRefresh = useRefreshableView({
  refresh: () => loadSettings({ force: true }),
  enabled: computed(() => !saving.value),
});
const {
  refreshing: settingsRefreshing,
  checking: settingsChecking,
  hasNewContent: settingsHasNewContent,
  refreshNow: refreshSettings,
} = settingsRefresh;

// SEO: settings page title
usePageMeta(t('dashboard.settings.pageTitle'));

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
            <div class="settings__nav-item is-active">
              <TypeIcon :size="15" />
              <span>{{ t('dashboard.settings.fontsTitle') }}</span>
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="settings__main">
        <div class="settings__content">
          <div class="settings__header">
            <div class="settings__header-icon">
              <PaletteIcon :size="20" />
            </div>
            <div>
              <h1 class="settings__title">{{ t('dashboard.settings.fontsTitle') }}</h1>
              <p class="settings__desc">{{ t('dashboard.settings.pageKicker') }}</p>
            </div>
          </div>

          <div v-if="error" class="settings__error">{{ error }}</div>

          <!-- App Font -->
          <section class="settings__section">
            <h2 class="settings__section-title">{{ t('dashboard.settings.appFontSection') }}</h2>
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
            <h2 class="settings__section-title">{{ t('dashboard.settings.codeFontSection') }}</h2>
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

  <FloatingRefreshButton
    :has-new-content="settingsHasNewContent"
    :refreshing="settingsRefreshing"
    :checking="settingsChecking"
    :disabled="saving"
    :label="t('dashboard.actions.refresh')"
    @refresh="refreshSettings"
  />
</template>

<style scoped lang="scss">
.settings {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── Sidebar (backgroundless; active item uses soft accent fill) ── */
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
  padding: 0 0.75rem;
  overflow-y: auto;
}

.settings__nav-group {
  margin-bottom: 0.5rem;
}

.settings__nav-label {
  display: block;
  padding: 0 0.75rem 0.6rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.settings__nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  font-weight: 550;
  cursor: default;
  transition:
    color 0.12s ease,
    background 0.12s ease;

  &:hover:not(.is-active) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    background: var(--gitpulse-surface-hover);
  }

  &.is-active {
    color: var(--gitpulse-accent);
    background: var(--gitpulse-accent-soft);
    font-weight: 650;
  }
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
  padding: 0.45rem 0.6rem 0.45rem 0.85rem;
  margin-left: 0.25rem;
  border-radius: 0 6px 6px 0;
  border-left: 2px solid transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 550;
  cursor: default;
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
