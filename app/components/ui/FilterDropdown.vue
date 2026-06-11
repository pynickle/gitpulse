<template>
  <div ref="triggerRef" class="filter-dropdown" :class="{ 'filter-dropdown--disabled': disabled }">
    <button
      ref="buttonRef"
      class="filter-dropdown-trigger"
      type="button"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      :aria-controls="listboxId"
      :aria-activedescendant="focusedIndex >= 0 ? optionId(focusedIndex) : undefined"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="filter-dropdown-trigger-content">
        <component
          v-if="selectedOption?.icon"
          :is="selectedOption.icon"
          :size="14"
          class="filter-dropdown-trigger-icon"
        />
        <span
          class="filter-dropdown-trigger-label"
          :class="{ 'filter-dropdown-trigger-label--placeholder': !selectedOption }"
        >
          {{ selectedOption?.label ?? placeholder }}
        </span>
      </span>
      <ChevronDownIcon
        :size="14"
        class="filter-dropdown-trigger-chevron"
        :class="{ 'filter-dropdown-trigger-chevron--open': isOpen }"
      />
    </button>

    <Teleport to="body">
      <Transition name="filter-dropdown-panel">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="filter-dropdown-panel"
          :style="panelStyle"
          @wheel.stop
        >
          <div v-if="searchable" class="filter-dropdown-search">
            <SearchIcon :size="14" class="filter-dropdown-search-icon" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="filter-dropdown-search-input"
              type="search"
              :placeholder="searchPlaceholder"
              :aria-label="searchPlaceholder"
              @keydown="onSearchKeydown"
            />
            <button
              v-if="searchQuery.length > 0"
              class="filter-dropdown-search-clear"
              type="button"
              :aria-label="clearSearchLabel"
              @click="clearSearch"
            >
              <XIcon :size="12" />
            </button>
          </div>

          <ul
            :id="listboxId"
            ref="listRef"
            class="filter-dropdown-list"
            role="listbox"
            :aria-label="ariaLabel"
          >
            <template
              v-for="(item, idx) in visibleItems"
              :key="isSeparator(item) ? `sep-${idx}` : item.value"
            >
              <li v-if="isSeparator(item)" class="filter-dropdown-separator" role="separator" />
              <li
                v-else
                :id="optionId(idx)"
                class="filter-dropdown-option"
                :class="{
                  'filter-dropdown-option--focused': focusedIndex === idx,
                  'filter-dropdown-option--selected': item.value === modelValue,
                }"
                role="option"
                :aria-selected="item.value === modelValue"
                @mousedown.prevent
                @click="selectOption(item)"
                @mouseenter="focusedIndex = idx"
              >
                <component
                  v-if="item.icon"
                  :is="item.icon"
                  :size="14"
                  class="filter-dropdown-option-icon"
                />
                <span class="filter-dropdown-option-content">
                  <span class="filter-dropdown-option-label">{{ item.label }}</span>
                  <span v-if="item.description" class="filter-dropdown-option-description">{{
                    item.description
                  }}</span>
                </span>
                <CheckIcon
                  v-if="item.value === modelValue"
                  :size="14"
                  class="filter-dropdown-option-check"
                />
              </li>
            </template>

            <li v-if="visibleItems.length === 0" class="filter-dropdown-empty">
              <SearchIcon :size="16" />
              <span>{{ noResultsLabel }}</span>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';

export interface FilterOption {
  value: string;
  label: string;
  description?: string;
  icon?: Component;
}

export interface FilterSeparator {
  type: 'separator';
}

export type FilterItem = FilterOption | FilterSeparator;

const props = withDefaults(
  defineProps<{
    options: FilterItem[];
    modelValue?: string;
    placeholder?: string;
    searchable?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    searchPlaceholder?: string;
    clearSearchLabel?: string;
    noResultsLabel?: string;
  }>(),
  {
    modelValue: '',
    placeholder: 'Select...',
    searchable: false,
    disabled: false,
    ariaLabel: undefined,
    searchPlaceholder: 'Search...',
    clearSearchLabel: 'Clear search',
    noResultsLabel: 'No results found',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const listboxId = `${useId()}-listbox`;

const isOpen = shallowRef(false);
const searchQuery = shallowRef('');
const focusedIndex = shallowRef(-1);

const triggerRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const listRef = ref<HTMLUListElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const panelStyle = shallowRef<Record<string, string>>({});

function isSeparator(item: FilterItem): item is FilterSeparator {
  return 'type' in item && item.type === 'separator';
}

const plainOptions = computed(() =>
  props.options.filter((o): o is FilterOption => !isSeparator(o))
);

const selectedOption = computed(() => plainOptions.value.find((o) => o.value === props.modelValue));

const filteredItems = computed<FilterItem[]>(() => {
  if (!props.searchable || !searchQuery.value.trim()) return props.options;
  const query = searchQuery.value.toLowerCase().trim();
  return plainOptions.value.filter(
    (o) => o.label.toLowerCase().includes(query) || o.description?.toLowerCase().includes(query)
  );
});

const visibleItems = computed<FilterItem[]>(() => filteredItems.value);

function optionId(idx: number) {
  return `${listboxId}-option-${idx}`;
}

const PANEL_GAP = 4;
const PANEL_VIEWPORT_MARGIN = 8;
const PANEL_MAX_HEIGHT = 320;
const PANEL_MIN_HEIGHT = 140;

function updatePanelPosition() {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const minWidth = Math.round(rect.width);
  const left = Math.round(
    Math.min(
      Math.max(rect.left, PANEL_VIEWPORT_MARGIN),
      Math.max(viewportWidth - minWidth - PANEL_VIEWPORT_MARGIN, PANEL_VIEWPORT_MARGIN)
    )
  );

  const spaceBelow = viewportHeight - rect.bottom - PANEL_GAP - PANEL_VIEWPORT_MARGIN;
  const spaceAbove = rect.top - PANEL_GAP - PANEL_VIEWPORT_MARGIN;
  const openUpward = spaceBelow < PANEL_MIN_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.round(
    Math.min(PANEL_MAX_HEIGHT, Math.max(openUpward ? spaceAbove : spaceBelow, PANEL_MIN_HEIGHT))
  );

  const style: Record<string, string> = {
    position: 'fixed',
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    maxWidth: `${Math.max(viewportWidth - left - PANEL_VIEWPORT_MARGIN, minWidth)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '9999',
  };
  if (openUpward) {
    style.bottom = `${Math.round(viewportHeight - rect.top + PANEL_GAP)}px`;
  } else {
    style.top = `${Math.round(rect.bottom + PANEL_GAP)}px`;
  }
  panelStyle.value = style;
}

function open() {
  if (props.disabled) return;
  updatePanelPosition();
  isOpen.value = true;
  focusedIndex.value = props.modelValue
    ? visibleItems.value.findIndex((o) => !isSeparator(o) && o.value === props.modelValue)
    : -1;
  if (props.searchable) {
    nextTick(() => searchInputRef.value?.focus());
  }
}

function close() {
  isOpen.value = false;
  searchQuery.value = '';
  focusedIndex.value = -1;
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function selectOption(option: FilterOption) {
  emit('update:modelValue', option.value);
  close();
  nextTick(() => buttonRef.value?.focus());
}

function clearSearch() {
  searchQuery.value = '';
  focusedIndex.value = -1;
  nextTick(() => searchInputRef.value?.focus());
}

function moveFocus(direction: 1 | -1) {
  const items = visibleItems.value;
  if (items.length === 0) return;
  let idx = focusedIndex.value;
  for (let attempt = 0; attempt < items.length; attempt++) {
    idx = (idx + direction + items.length) % items.length;
    const item = items[idx];
    if (item && !isSeparator(item)) {
      focusedIndex.value = idx;
      scrollToFocused();
      return;
    }
  }
}

function scrollToFocused() {
  nextTick(() => {
    const el = listRef.value?.querySelector(`#${optionId(focusedIndex.value)}`);
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function onTriggerKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
    case 'Down':
      e.preventDefault();
      if (!isOpen.value) open();
      else moveFocus(1);
      break;
    case 'ArrowUp':
    case 'Up':
      e.preventDefault();
      if (!isOpen.value) open();
      else moveFocus(-1);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (!isOpen.value) {
        open();
      } else if (focusedIndex.value >= 0) {
        const item = visibleItems.value[focusedIndex.value];
        if (item && !isSeparator(item)) selectOption(item);
      }
      break;
    case 'Escape':
      e.preventDefault();
      close();
      break;
    case 'Tab':
      if (isOpen.value) close();
      break;
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
    case 'Down':
      e.preventDefault();
      moveFocus(1);
      break;
    case 'ArrowUp':
    case 'Up':
      e.preventDefault();
      moveFocus(-1);
      break;
    case 'Enter':
      e.preventDefault();
      if (focusedIndex.value >= 0) {
        const item = visibleItems.value[focusedIndex.value];
        if (item && !isSeparator(item)) selectOption(item);
      }
      break;
    case 'Escape':
      e.preventDefault();
      close();
      nextTick(() => buttonRef.value?.focus());
      break;
  }
}

// Pressing a native scrollbar fires mousedown on the scrolled element with
// offsets beyond its client box — don't treat that as a click outside.
function isScrollbarPress(e: MouseEvent) {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  return e.offsetX > target.clientWidth || e.offsetY > target.clientHeight;
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (triggerRef.value?.contains(target)) return;
  if (panelRef.value?.contains(target)) return;
  if (isScrollbarPress(e)) return;
  close();
}

let repositionFrame: number | null = null;

function onViewportChange() {
  if (!isOpen.value || repositionFrame !== null) return;
  repositionFrame = requestAnimationFrame(() => {
    repositionFrame = null;
    if (isOpen.value) updatePanelPosition();
  });
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);
});

onBeforeUnmount(() => {
  if (repositionFrame !== null) cancelAnimationFrame(repositionFrame);
  document.removeEventListener('mousedown', onClickOutside);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});

watch(
  () => props.modelValue,
  () => {
    if (isOpen.value) {
      focusedIndex.value = visibleItems.value.findIndex(
        (o) => !isSeparator(o) && o.value === props.modelValue
      );
    }
  }
);
</script>

<style scoped lang="scss">
.filter-dropdown {
  position: relative;
  display: inline-flex;
}

.filter-dropdown--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.filter-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-input-border);
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -1px;
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.filter-dropdown-trigger-content {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.filter-dropdown-trigger-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.filter-dropdown-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;

  &--placeholder {
    color: var(--gitpulse-text-subtle);
  }
}

.filter-dropdown-trigger-chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition: transform 0.18s ease;

  &--open {
    transform: rotate(180deg);
  }
}

.filter-dropdown-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px;
  border-bottom: 1px solid var(--gitpulse-border);
}

.filter-dropdown-search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  margin-left: 2px;
}

.filter-dropdown-search-input {
  flex: 1;
  height: 28px;
  padding: 0 6px;
  font-size: 13px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: var(--gitpulse-text-subtle);
  }
}

.filter-dropdown-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--gitpulse-radius-sm);
  color: var(--gitpulse-text-muted);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

.filter-dropdown-list {
  flex: 1;
  min-height: 0;
  max-height: 280px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.filter-dropdown-separator {
  height: 1px;
  margin: 4px 0;
  background: var(--gitpulse-border);
}

.filter-dropdown-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;

  &:hover {
    background: var(--gitpulse-surface-active);
  }

  &--focused {
    background: var(--gitpulse-surface-active);
  }

  &--selected {
    background: var(--gitpulse-accent-soft);
  }

  &--selected.filter-dropdown-option--focused {
    background: var(--gitpulse-accent-soft);
  }
}

.filter-dropdown-option-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);

  .filter-dropdown-option--selected & {
    color: var(--gitpulse-accent);
  }
}

.filter-dropdown-option-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.filter-dropdown-option-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-dropdown-option-description {
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-dropdown-option-check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.filter-dropdown-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 8px;
  color: var(--gitpulse-text-muted);
  font-size: 12px;
}

:global(.filter-dropdown-panel) {
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

:global(.filter-dropdown-panel-enter-active),
:global(.filter-dropdown-panel-leave-active) {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

:global(.filter-dropdown-panel-enter-from),
:global(.filter-dropdown-panel-leave-to) {
  opacity: 0;
  transform: translateY(-4px);
}

:global(.filter-dropdown-panel-enter-to),
:global(.filter-dropdown-panel-leave-from) {
  opacity: 1;
  transform: translateY(0);
}
</style>
