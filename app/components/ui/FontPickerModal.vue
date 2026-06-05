<template>
  <Teleport to="body">
    <Transition name="font-modal">
      <div
        v-if="isVisible"
        class="font-modal-overlay"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
      >
        <div class="font-modal-panel" role="dialog" aria-modal="true" :aria-label="title">
          <div class="font-modal-header">
            <h3 class="font-modal-title">{{ title }}</h3>
            <button
              class="font-modal-close"
              type="button"
              :aria-label="t('fontModal.closeAriaLabel')"
              @click="emit('close')"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <div class="font-modal-content">
            <div class="font-modal-search">
              <div class="font-modal-search-input-wrapper">
                <SearchIcon :size="14" class="font-modal-search-icon" />
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  class="font-modal-search-input"
                  type="search"
                  :placeholder="t('fontModal.searchPlaceholder')"
                  :aria-label="t('fontModal.searchAriaLabel')"
                />
                <button
                  v-if="searchQuery.length > 0"
                  class="font-modal-search-clear"
                  type="button"
                  :aria-label="t('fontModal.clearSearchAriaLabel')"
                  @click="clearSearch"
                >
                  <XIcon :size="12" />
                </button>
              </div>
            </div>

            <div v-if="systemFontsLoading" class="font-modal-loading">
              <Loader2Icon class="spin-animation" :size="18" />
              <span>{{ t('dashboard.settings.loadingSystemFonts') }}</span>
            </div>

            <div v-else-if="groupedFonts.length > 0" class="font-modal-list">
              <CollapsibleGroup
                v-for="group in groupedFonts"
                :key="group.label"
                :id="group.label"
                :count="group.items.length"
              >
                <template #header>{{ group.label }}</template>
                <label
                  v-for="font in group.items"
                  :key="font.id"
                  class="font-modal-item"
                  :class="{ 'font-modal-item--selected': font.id === modelValue }"
                >
                  <input
                    type="radio"
                    :name="`font-picker-${uid}`"
                    :value="font.id"
                    :checked="font.id === modelValue"
                    class="font-modal-item-radio"
                    @change="selectFont(font.id)"
                  />
                  <span class="font-modal-item-check">
                    <CheckIcon :size="10" />
                  </span>
                  <span class="font-modal-item-label">{{ font.label }}</span>
                </label>
              </CollapsibleGroup>

              <div v-if="canLoadMoreSystemFonts" class="font-modal-load-more">
                <button
                  class="font-modal-load-btn"
                  type="button"
                  :disabled="systemFontsLoading"
                  @click="loadSystemFonts"
                >
                  {{ t('dashboard.settings.loadSystemFonts') }}
                </button>
              </div>

              <div v-if="systemFontsError" class="font-modal-error">
                {{ systemFontsError }}
              </div>
            </div>

            <div v-else class="font-modal-empty">
              <TypeIcon :size="24" />
              <p>{{ t('fontModal.noFontsFound') }}</p>
            </div>
          </div>

          <div class="font-modal-footer">
            <div class="font-modal-footer-info">
              <span class="font-modal-footer-hint">{{ t('fontModal.footerHint') }}</span>
            </div>
            <button
              class="font-modal-btn font-modal-btn--close"
              type="button"
              @click="emit('close')"
            >
              {{ t('fontModal.close') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckIcon, Loader2Icon, SearchIcon, TypeIcon, XIcon } from 'lucide-vue-next';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import { normalizeSystemFontFamily } from '#shared/utils/user-settings';
import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';

export interface FontOption {
  id: string;
  label: string;
  source?: 'bundled' | 'system';
}

interface FontGroup {
  label: string;
  items: FontOption[];
}

interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

interface LocalFontWindow extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
}

const { t } = useI18n();

const props = defineProps<{
  isVisible: boolean;
  title: string;
  modelValue: string;
  bundledFonts: FontOption[];
}>();

const emit = defineEmits<{
  close: [];
  'update:modelValue': [value: string];
}>();

const uid = Math.random().toString(36).slice(2, 8);
const searchQuery = shallowRef('');
const searchInputRef = ref<HTMLInputElement | null>(null);

// System font state (managed inside the modal so callers don't need to pre-load)
const systemFonts = shallowRef<string[]>([]);
const systemFontsLoading = shallowRef(false);
const systemFontsError = shallowRef('');

const supportsLocalFonts = computed(() => {
  return import.meta.client && typeof (window as LocalFontWindow).queryLocalFonts === 'function';
});

const canLoadMoreSystemFonts = computed(() => {
  return supportsLocalFonts.value && systemFonts.value.length === 0 && !systemFontsError.value;
});

const allFonts = computed<FontOption[]>(() => {
  return [
    ...props.bundledFonts,
    ...systemFonts.value.map((f) => ({
      id: `system:${f}`,
      label: f,
      source: 'system' as const,
    })),
  ];
});

const filteredFonts = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return allFonts.value;
  return allFonts.value.filter(
    (font) => font.label.toLowerCase().includes(query) || font.id.toLowerCase().includes(query)
  );
});

const groupedFonts = computed<FontGroup[]>(() => {
  const bundled = filteredFonts.value.filter((f) => f.source === 'bundled');
  const system = filteredFonts.value.filter((f) => f.source === 'system');
  const groups: FontGroup[] = [];
  if (bundled.length > 0) {
    groups.push({ label: t('fontModal.bundledFontsGroup'), items: bundled });
  }
  if (system.length > 0) {
    groups.push({ label: t('fontModal.systemFontsGroup'), items: system });
  }
  return groups;
});

const clearSearch = () => {
  searchQuery.value = '';
  nextTick(() => searchInputRef.value?.focus());
};

const selectFont = (fontId: string) => {
  emit('update:modelValue', fontId);
  emit('close');
};

const loadSystemFonts = async () => {
  systemFontsError.value = '';

  if (!supportsLocalFonts.value) {
    systemFontsError.value = t('dashboard.settings.systemFontsUnsupported');
    return;
  }

  const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
  if (!queryLocalFonts) {
    systemFontsError.value = t('dashboard.settings.systemFontsUnsupported');
    return;
  }

  systemFontsLoading.value = true;
  try {
    const fonts = await queryLocalFonts();
    const families = new Set<string>();

    for (const font of fonts) {
      const family = normalizeSystemFontFamily(font.family);
      if (family) {
        families.add(family);
      }
    }

    systemFonts.value = [...families].sort((a, b) => a.localeCompare(b));
  } catch {
    systemFontsError.value = t('dashboard.settings.systemFontsDenied');
  } finally {
    systemFontsLoading.value = false;
  }
};

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      searchQuery.value = '';
      nextTick(() => searchInputRef.value?.focus());
    }
  }
);
</script>

<style scoped lang="scss">
.font-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

.font-modal-panel {
  width: 100%;
  max-width: 380px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.font-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.font-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.font-modal-close {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

.font-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  min-height: 0;
}

.font-modal-search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 0 8px;
  background: var(--gitpulse-surface);
}

.font-modal-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.font-modal-search-icon {
  position: absolute;
  left: 10px;
  color: var(--gitpulse-text-muted);
  pointer-events: none;
}

.font-modal-search-input {
  width: 100%;
  height: 32px;
  padding: 0 32px 0 32px;
  font-size: 13px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  transition: border-color 0.12s ease;

  &::placeholder {
    color: var(--gitpulse-text-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--gitpulse-accent);
  }
}

.font-modal-search-clear {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--gitpulse-text-muted);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

.font-modal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

.font-modal-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.font-modal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin: 0 -8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &--selected {
    background: var(--gitpulse-accent-soft);
  }
}

.font-modal-item-radio {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.font-modal-item-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--gitpulse-input-border);
  border-radius: 50%;
  background: var(--gitpulse-input-bg);
  color: transparent;
  flex-shrink: 0;
  transition: all 0.12s ease;

  .font-modal-item:hover & {
    border-color: var(--gitpulse-border-strong);
  }

  .font-modal-item--selected & {
    background: var(--gitpulse-accent);
    border-color: var(--gitpulse-accent);
    color: var(--gitpulse-surface);
  }
}

.font-modal-item-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-modal-load-more {
  display: flex;
  justify-content: center;
  padding: 8px 4px 4px;
  border-top: 1px solid var(--gitpulse-border);
  margin-top: 6px;
}

.font-modal-load-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 550;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.font-modal-error {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.font-modal-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: center;

  p {
    margin: 0;
  }
}

.font-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
}

.font-modal-footer-info {
  flex: 1;
}

.font-modal-footer-hint {
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
}

.font-modal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.font-modal-btn--close {
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.font-modal-enter-active,
.font-modal-leave-active {
  transition: opacity 0.18s ease;

  .font-modal-panel {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.font-modal-enter-from,
.font-modal-leave-to {
  opacity: 0;

  .font-modal-panel {
    transform: scale(0.96) translateY(8px);
  }
}

.font-modal-enter-to,
.font-modal-leave-from {
  opacity: 1;

  .font-modal-panel {
    transform: scale(1) translateY(0);
  }
}
</style>
