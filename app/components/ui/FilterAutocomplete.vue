<script setup lang="ts">
import { Loader2Icon, SearchIcon } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';

import type { AutocompleteSuggestion } from '~/components/ui/autocomplete';
import AutocompleteMenu from '~/components/ui/AutocompleteMenu.vue';

export type { AutocompleteSuggestion } from '~/components/ui/autocomplete';

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

const inputRef = useTemplateRef<HTMLInputElement>('inputEl');
const containerRef = useTemplateRef<HTMLElement>('containerEl');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const filteredSuggestions = computed(() => {
  const query = inputValue.value.trim().toLowerCase();
  if (!query) return props.suggestions;
  return props.suggestions.filter(
    (s) => s.value.toLowerCase().includes(query) || s.label?.toLowerCase().includes(query)
  );
});

const close = () => {
  if (!isOpen.value) return;
  isOpen.value = false;
  activeIndex.value = -1;
};

const { panelStyle, updatePanelPosition } = useAutocompletePanel({
  isOpen,
  listboxId,
  getAnchor: () => containerRef.value,
  onClose: close,
});

const open = () => {
  if (isOpen.value) return;
  updatePanelPosition();
  isOpen.value = true;
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

    <AutocompleteMenu
      :open="isOpen"
      :suggestions="filteredSuggestions"
      :query="inputValue"
      :active-index="activeIndex"
      :listbox-id="listboxId"
      :option-id-prefix="componentId"
      :panel-style="panelStyle"
      :loading="loading"
      :empty-message="emptyMessage"
      :aria-label="placeholder || 'Suggestions'"
      @select="selectSuggestion"
      @activate="activeIndex = $event"
    />
  </div>
</template>

<style scoped lang="scss">
.fa-container {
  position: relative;
  min-width: 0;
}

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

@keyframes fa-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
