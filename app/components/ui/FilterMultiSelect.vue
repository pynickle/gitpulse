<script setup lang="ts">
import { CheckIcon, SearchIcon, XIcon } from 'lucide-vue-next';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue';

export interface FilterMultiSelectOption {
  value: string;
  label?: string;
}

const props = withDefaults(
  defineProps<{
    suggestions: FilterMultiSelectOption[];
    modelValue: string[];
    placeholder?: string;
    emptyMessage?: string;
    ariaLabel?: string;
    removeLabel?: string;
  }>(),
  {
    placeholder: '',
    emptyMessage: 'No results found',
    ariaLabel: undefined,
    removeLabel: 'Remove',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  search: [query: string];
}>();

const componentId = useId();
const listboxId = `${componentId}-listbox`;

const isOpen = shallowRef(false);
const activeIndex = shallowRef(-1);
const inputValue = shallowRef('');
const panelStyle = shallowRef<Record<string, string>>({});

const inputRef = useTemplateRef<HTMLInputElement>('inputEl');
const listRef = useTemplateRef<HTMLElement>('listEl');
const containerRef = useTemplateRef<HTMLElement>('containerEl');

const normalizeLabel = (label: string) => label.trim().toLowerCase();

const selectedLookup = computed(() => new Set(props.modelValue.map(normalizeLabel)));

const uniqueSuggestions = computed(() => {
  const seen = new Set<string>();
  const options: FilterMultiSelectOption[] = [];

  for (const suggestion of props.suggestions) {
    const value = suggestion.value.trim();
    const key = normalizeLabel(value);
    if (!value || seen.has(key) || selectedLookup.value.has(key)) continue;
    seen.add(key);
    options.push({ value, label: suggestion.label });
  }

  return options;
});

const visibleSuggestions = computed(() => {
  const query = inputValue.value.trim().toLowerCase();
  if (!query) return uniqueSuggestions.value;
  return uniqueSuggestions.value.filter((suggestion) => {
    return (
      suggestion.value.toLowerCase().includes(query) ||
      suggestion.label?.toLowerCase().includes(query)
    );
  });
});

const showPlaceholder = computed(() => props.modelValue.length === 0 && inputValue.value === '');

const getDisplayLabel = (suggestion: FilterMultiSelectOption) =>
  suggestion.label ?? suggestion.value;

const splitInputLabels = (value: string) =>
  value
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);

const emitLabels = (additions: string[]) => {
  const seen = new Set<string>();
  const nextLabels: string[] = [];

  for (const label of [...props.modelValue, ...additions]) {
    const trimmed = label.trim();
    const key = normalizeLabel(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    nextLabels.push(trimmed);
  }

  emit('update:modelValue', nextLabels);
};

const PANEL_GAP = 4;
const PANEL_VIEWPORT_MARGIN = 8;
const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_HEIGHT = 280;
const PANEL_MIN_HEIGHT = 120;

const updatePanelPosition = () => {
  const anchor = containerRef.value;
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const width = Math.max(rect.width, PANEL_MIN_WIDTH);
  const left = Math.min(
    Math.max(rect.left, PANEL_VIEWPORT_MARGIN),
    Math.max(viewportWidth - width - PANEL_VIEWPORT_MARGIN, PANEL_VIEWPORT_MARGIN)
  );

  const spaceBelow = viewportHeight - rect.bottom - PANEL_GAP - PANEL_VIEWPORT_MARGIN;
  const spaceAbove = rect.top - PANEL_GAP - PANEL_VIEWPORT_MARGIN;
  const openUpward = spaceBelow < PANEL_MIN_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    PANEL_MAX_HEIGHT,
    Math.max(openUpward ? spaceAbove : spaceBelow, PANEL_MIN_HEIGHT)
  );

  const style: Record<string, string> = {
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
  };
  if (openUpward) {
    style.bottom = `${Math.round(viewportHeight - rect.top + PANEL_GAP)}px`;
  } else {
    style.top = `${Math.round(rect.bottom + PANEL_GAP)}px`;
  }

  panelStyle.value = style;
};

const open = () => {
  updatePanelPosition();
  isOpen.value = true;
};

const close = () => {
  isOpen.value = false;
  activeIndex.value = -1;
};

const focusInput = () => {
  void nextTick(() => inputRef.value?.focus());
};

const addInputLabels = () => {
  const labels = splitInputLabels(inputValue.value);
  if (labels.length === 0) return false;
  emitLabels(labels);
  inputValue.value = '';
  activeIndex.value = -1;
  void nextTick(updatePanelPosition);
  return true;
};

const selectSuggestion = (suggestion: FilterMultiSelectOption) => {
  emitLabels([suggestion.value]);
  inputValue.value = '';
  activeIndex.value = -1;
  open();
  focusInput();
};

const removeSelectedLabel = (label: string) => {
  const target = normalizeLabel(label);
  emit(
    'update:modelValue',
    props.modelValue.filter((value) => normalizeLabel(value) !== target)
  );
  focusInput();
};

const moveActive = (direction: 1 | -1) => {
  const len = visibleSuggestions.value.length;
  if (!len) return;

  if (activeIndex.value < 0) {
    activeIndex.value = direction === 1 ? 0 : len - 1;
  } else {
    activeIndex.value = (activeIndex.value + direction + len) % len;
  }

  const items = listRef.value?.querySelectorAll('[role="option"]');
  items?.[activeIndex.value]?.scrollIntoView({ block: 'nearest' });
};

const confirmActive = () => {
  const suggestion = visibleSuggestions.value[activeIndex.value];
  if (suggestion) {
    selectSuggestion(suggestion);
  }
};

const handleInput = (event: Event) => {
  inputValue.value = (event.target as HTMLInputElement).value;
  activeIndex.value = -1;
  open();
  emit('search', inputValue.value);
};

const handleFocus = () => {
  open();
};

const handleContainerMouseDown = (event: MouseEvent) => {
  if (event.target === inputRef.value) return;
  event.preventDefault();
  open();
  focusInput();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key === 'Backspace' && inputValue.value === '' && props.modelValue.length > 0) {
    removeSelectedLabel(props.modelValue[props.modelValue.length - 1] ?? '');
    return;
  }

  if (event.key === 'Tab') {
    close();
    return;
  }

  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (isOpen.value && activeIndex.value >= 0) {
      confirmActive();
      return;
    }
    addInputLabels();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!isOpen.value) open();
    moveActive(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!isOpen.value) open();
    moveActive(-1);
  }
};

const isScrollbarPress = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return event.offsetX > target.clientWidth || event.offsetY > target.clientHeight;
};

const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value) return;
  const target = event.target as Node;
  if (containerRef.value?.contains(target)) return;
  if (listRef.value?.contains(target)) return;
  if (isScrollbarPress(event)) return;
  close();
};

let repositionFrame: number | null = null;

const handleViewportChange = () => {
  if (!isOpen.value || repositionFrame !== null) return;
  repositionFrame = requestAnimationFrame(() => {
    repositionFrame = null;
    if (isOpen.value) updatePanelPosition();
  });
};

onMounted(() => {
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);
});

onBeforeUnmount(() => {
  if (repositionFrame !== null) cancelAnimationFrame(repositionFrame);
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});

watch(isOpen, (openPanel) => {
  if (openPanel) {
    updatePanelPosition();
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }
});

watch(visibleSuggestions, (suggestions) => {
  if (activeIndex.value >= suggestions.length) {
    activeIndex.value = suggestions.length > 0 ? suggestions.length - 1 : -1;
  }
});
</script>

<template>
  <div ref="containerEl" class="filter-multiselect">
    <div
      class="filter-multiselect__control"
      :class="{ 'filter-multiselect__control--open': isOpen }"
      @mousedown="handleContainerMouseDown"
    >
      <SearchIcon
        v-if="modelValue.length === 0"
        :size="14"
        class="filter-multiselect__search-icon"
        aria-hidden="true"
      />

      <span v-for="label in modelValue" :key="label" class="filter-multiselect__tag" :title="label">
        <span class="filter-multiselect__tag-dot" aria-hidden="true" />
        <span class="filter-multiselect__tag-label">{{ label }}</span>
        <button
          class="filter-multiselect__tag-remove"
          type="button"
          :aria-label="`${props.removeLabel} ${label}`"
          @mousedown.prevent
          @click="removeSelectedLabel(label)"
        >
          <XIcon :size="12" aria-hidden="true" />
        </button>
      </span>

      <input
        ref="inputEl"
        type="text"
        class="filter-multiselect__input"
        role="combobox"
        autocomplete="off"
        :value="inputValue"
        :placeholder="showPlaceholder ? placeholder : ''"
        :aria-label="ariaLabel ?? placeholder"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="
          activeIndex >= 0 ? `${componentId}-option-${activeIndex}` : undefined
        "
        aria-haspopup="listbox"
        @input="handleInput"
        @focus="handleFocus"
        @keydown="handleKeydown"
      />
    </div>

    <Teleport to="body">
      <Transition name="filter-multiselect-panel">
        <div
          v-if="isOpen"
          ref="listEl"
          :id="listboxId"
          class="filter-multiselect__panel"
          :style="panelStyle"
          role="listbox"
          aria-multiselectable="true"
          :aria-label="ariaLabel ?? placeholder"
          @wheel.stop
        >
          <button
            v-for="(suggestion, index) in visibleSuggestions"
            :key="suggestion.value"
            :id="`${componentId}-option-${index}`"
            type="button"
            class="filter-multiselect__option"
            :class="{ 'filter-multiselect__option--active': index === activeIndex }"
            role="option"
            aria-selected="false"
            @mousedown.prevent
            @click="selectSuggestion(suggestion)"
            @mouseenter="activeIndex = index"
          >
            <span class="filter-multiselect__option-label">
              {{ getDisplayLabel(suggestion) }}
            </span>
            <CheckIcon :size="14" class="filter-multiselect__option-check" aria-hidden="true" />
          </button>

          <div v-if="visibleSuggestions.length === 0" class="filter-multiselect__empty">
            <SearchIcon :size="16" class="filter-multiselect__empty-icon" aria-hidden="true" />
            <span>{{ emptyMessage }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.filter-multiselect {
  position: relative;
  min-width: 0;
}

.filter-multiselect__control {
  display: flex;
  align-items: flex-start;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  min-height: 30px;
  max-height: 58px;
  padding: 3px 7px;
  overflow-y: auto;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-input-bg);
  cursor: text;
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  &:focus-within {
    border-color: var(--gitpulse-accent);
    box-shadow: 0 0 0 2px var(--gitpulse-accent-soft);
  }

  &--open {
    border-color: var(--gitpulse-accent);
  }
}

.filter-multiselect__search-icon {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--gitpulse-text-muted);
}

.filter-multiselect__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-height: 22px;
  padding: 0 4px 0 7px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 9999px;
  background: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-multiselect__tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--gitpulse-accent);
  opacity: 0.8;
}

.filter-multiselect__tag-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-multiselect__tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 1px;
  }
}

.filter-multiselect__input {
  flex: 1;
  min-width: 86px;
  height: 22px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.8125rem;
  line-height: 22px;

  &::placeholder {
    color: var(--gitpulse-text-subtle);
  }
}

.filter-multiselect__panel {
  position: fixed;
  z-index: 99998;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
  overscroll-behavior: contain;
}

.filter-multiselect__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--gitpulse-radius-sm);
  background: transparent;
  color: var(--gitpulse-text);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.08s ease;

  &:hover,
  &--active {
    background: var(--gitpulse-surface-active);
  }
}

.filter-multiselect__option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-multiselect__option-check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
  opacity: 0;
}

.filter-multiselect__option:hover .filter-multiselect__option-check,
.filter-multiselect__option--active .filter-multiselect__option-check {
  opacity: 1;
}

.filter-multiselect__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 8px;
  color: var(--gitpulse-text-subtle);
  font-size: 0.8125rem;
}

.filter-multiselect__empty-icon {
  opacity: 0.5;
}

.filter-multiselect-panel-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.filter-multiselect-panel-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}

.filter-multiselect-panel-enter-from,
.filter-multiselect-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
