<script setup lang="ts">
import { Loader2Icon, SearchIcon } from 'lucide-vue-next';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

export interface AutocompleteSuggestion {
  value: string;
  label?: string;
}

const props = withDefaults(
  defineProps<{
    suggestions: AutocompleteSuggestion[];
    modelValue: string;
    placeholder?: string;
    loading?: boolean;
    emptyMessage?: string;
  }>(),
  {
    placeholder: '',
    loading: false,
    emptyMessage: 'No results found',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [query: string];
}>();

const componentId = useId();
const listboxId = `${componentId}-listbox`;

const isOpen = shallowRef(false);
const activeIndex = shallowRef(-1);
const inputValue = shallowRef(props.modelValue);
const panelStyle = shallowRef<Record<string, string>>({});

const inputRef = useTemplateRef<HTMLInputElement>('inputEl');
const listRef = useTemplateRef<HTMLElement>('listEl');
const containerRef = useTemplateRef<HTMLElement>('containerEl');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const filteredSuggestions = computed(() => {
  const query = inputValue.value.trim().toLowerCase();
  if (!query) return props.suggestions;
  return props.suggestions.filter(
    (s) => s.value.toLowerCase().includes(query) || s.label?.toLowerCase().includes(query)
  );
});

const getDisplayLabel = (suggestion: AutocompleteSuggestion) =>
  suggestion.label ?? suggestion.value;

const highlightMatch = (text: string) => {
  const query = inputValue.value.trim();
  if (!query) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
  return escaped.replace(regex, '<mark class="fa-highlight">$1</mark>');
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PANEL_GAP = 4;
const PANEL_VIEWPORT_MARGIN = 8;
const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_HEIGHT = 280;
const PANEL_MIN_HEIGHT = 120;

const updatePanelPosition = () => {
  // Anchor on the bordered wrapper (not the inner <input>) so the panel
  // lines up with the visible control, icon and padding included.
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
  if (isOpen.value) return;
  updatePanelPosition();
  isOpen.value = true;
  activeIndex.value = -1;
};

const close = () => {
  if (!isOpen.value) return;
  isOpen.value = false;
  activeIndex.value = -1;
};

const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
  inputValue.value = suggestion.value;
  emit('update:modelValue', suggestion.value);
  close();
  nextTick(() => inputRef.value?.focus());
};

const moveActive = (direction: 1 | -1) => {
  const len = filteredSuggestions.value.length;
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
  const suggestion = filteredSuggestions.value[activeIndex.value];
  if (suggestion) {
    selectSuggestion(suggestion);
  }
};

const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  inputValue.value = value;
  emit('update:modelValue', value);
  activeIndex.value = -1;
  open();

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('search', value);
  }, 300);
};

const handleFocus = () => {
  open();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (!isOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActive(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActive(-1);
    return;
  }

  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (activeIndex.value >= 0) {
      confirmActive();
    } else {
      emit('update:modelValue', inputValue.value);
      close();
    }
  }
};

// Pressing a native scrollbar fires mousedown on the scrolled element with
// offsets beyond its client box — don't treat that as a click outside.
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

watch(
  () => props.modelValue,
  (val) => {
    if (val !== inputValue.value) {
      inputValue.value = val;
    }
  }
);

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (repositionFrame !== null) cancelAnimationFrame(repositionFrame);
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});

onMounted(() => {
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);
});

watch(isOpen, (open) => {
  if (open) {
    updatePanelPosition();
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }
});
</script>

<template>
  <div ref="containerEl" class="fa-container">
    <div class="fa-input-wrapper" :class="{ 'fa-input-wrapper--open': isOpen }">
      <SearchIcon :size="14" class="fa-input-icon" aria-hidden="true" />
      <input
        ref="inputEl"
        type="text"
        class="fa-input"
        role="combobox"
        autocomplete="off"
        :value="inputValue"
        :placeholder="placeholder"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="activeIndex >= 0 ? `${componentId}-opt-${activeIndex}` : undefined"
        aria-haspopup="listbox"
        @input="handleInput"
        @focus="handleFocus"
        @keydown="handleKeydown"
      />
      <Loader2Icon v-if="loading" :size="14" class="fa-input-spinner" aria-hidden="true" />
    </div>

    <Teleport to="body">
      <Transition name="fa-panel">
        <div
          v-if="isOpen"
          ref="listEl"
          :id="listboxId"
          class="fa-panel"
          :style="panelStyle"
          role="listbox"
          :aria-label="placeholder || 'Suggestions'"
          @wheel.stop
        >
          <template v-if="loading">
            <div v-for="i in 3" :key="`skeleton-${i}`" class="fa-skeleton-row">
              <div class="fa-skeleton-bar" />
            </div>
          </template>

          <template v-else-if="filteredSuggestions.length > 0">
            <button
              v-for="(suggestion, index) in filteredSuggestions"
              :key="suggestion.value"
              :id="`${componentId}-opt-${index}`"
              type="button"
              class="fa-option"
              :class="{
                'fa-option--active': index === activeIndex,
              }"
              role="option"
              :aria-selected="index === activeIndex"
              @mousedown.prevent
              @click="selectSuggestion(suggestion)"
              @mouseenter="activeIndex = index"
            >
              <span class="fa-option-label" v-html="highlightMatch(getDisplayLabel(suggestion))" />
            </button>
          </template>

          <div v-else class="fa-empty">
            <SearchIcon :size="16" class="fa-empty-icon" aria-hidden="true" />
            <span>{{ emptyMessage }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.fa-container {
  position: relative;
  min-width: 0;
}

// ─── Input wrapper ─────────────────────────────────────────────
.fa-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 30px;
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-input-bg);
  border-radius: var(--gitpulse-radius-md);
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

.fa-input-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.fa-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.8125rem;
  outline: none;
  line-height: 1.4;

  &::placeholder {
    color: var(--gitpulse-text-subtle);
  }
}

.fa-input-spinner {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  animation: fa-spin 1s linear infinite;
}

// ─── Floating panel ────────────────────────────────────────────
.fa-panel {
  position: fixed;
  z-index: 99998;
  max-height: 280px; // fallback; actual cap is set inline from available space
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  border-radius: var(--gitpulse-radius-md);
  box-shadow: var(--gitpulse-shadow-raised);
  overscroll-behavior: contain;
}

// ─── Option rows ───────────────────────────────────────────────
.fa-option {
  display: flex;
  align-items: center;
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

  &:hover {
    background: var(--gitpulse-surface-active);
  }

  &--active {
    background: var(--gitpulse-surface-active);
  }
}

.fa-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(.fa-highlight) {
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
    border-radius: 2px;
    padding: 0 1px;
  }
}

// ─── Skeleton loading ──────────────────────────────────────────
.fa-skeleton-row {
  padding: 6px 8px;
}

.fa-skeleton-bar {
  height: 14px;
  border-radius: 4px;
  background: var(--gitpulse-skeleton-bg);
  animation: fa-shimmer 1.5s infinite;
}

// ─── Empty state ───────────────────────────────────────────────
.fa-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 8px;
  color: var(--gitpulse-text-subtle);
  font-size: 0.8125rem;
}

.fa-empty-icon {
  opacity: 0.5;
}

// ─── Panel transition ──────────────────────────────────────────
.fa-panel-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fa-panel-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}

.fa-panel-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.fa-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

// ─── Animations ────────────────────────────────────────────────
@keyframes fa-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fa-shimmer {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
</style>
