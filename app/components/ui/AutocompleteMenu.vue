<script setup lang="ts">
import { SearchIcon } from 'lucide-vue-next';
import { nextTick, useTemplateRef, watch } from 'vue';

import type { AutocompleteSuggestion } from './autocomplete';

const props = withDefaults(
  defineProps<{
    open: boolean;
    suggestions: AutocompleteSuggestion[];
    query?: string;
    activeIndex: number;
    listboxId: string;
    optionIdPrefix: string;
    panelStyle: Record<string, string>;
    loading?: boolean;
    emptyMessage?: string;
    ariaLabel?: string;
  }>(),
  {
    query: '',
    loading: false,
    emptyMessage: 'No results found',
    ariaLabel: 'Suggestions',
  }
);

const emit = defineEmits<{
  select: [suggestion: AutocompleteSuggestion];
  activate: [index: number];
}>();

const listRef = useTemplateRef<HTMLElement>('listEl');

const getDisplayLabel = (suggestion: AutocompleteSuggestion) =>
  suggestion.label ?? suggestion.value;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightMatch = (text: string) => {
  const query = props.query.trim();
  if (!query) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
  return escaped.replace(regex, '<mark class="fa-highlight">$1</mark>');
};

const scrollActiveOptionIntoView = async () => {
  await nextTick();
  if (props.activeIndex < 0) {
    return;
  }

  const items = listRef.value?.querySelectorAll('[role="option"]');
  items?.[props.activeIndex]?.scrollIntoView({ block: 'nearest' });
};

watch(() => props.activeIndex, scrollActiveOptionIntoView);
</script>

<template>
  <Teleport to="body">
    <Transition name="fa-panel">
      <div
        v-if="open"
        ref="listEl"
        :id="listboxId"
        class="fa-panel"
        :style="panelStyle"
        role="listbox"
        :aria-label="ariaLabel"
        :data-autocomplete-menu-id="listboxId"
        @wheel.stop
      >
        <template v-if="loading">
          <div v-for="i in 3" :key="`skeleton-${i}`" class="fa-skeleton-row">
            <div class="fa-skeleton-bar" />
          </div>
        </template>

        <template v-else-if="suggestions.length > 0">
          <button
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.value"
            :id="`${optionIdPrefix}-opt-${index}`"
            type="button"
            class="fa-option"
            :class="{
              'fa-option--active': index === activeIndex,
            }"
            role="option"
            :aria-selected="index === activeIndex"
            @mousedown.prevent
            @click="emit('select', suggestion)"
            @mouseenter="emit('activate', index)"
          >
            <img
              v-if="suggestion.avatarUrl"
              class="fa-option-avatar"
              :src="suggestion.avatarUrl"
              alt=""
              aria-hidden="true"
            />
            <span class="fa-option-copy">
              <span class="fa-option-label" v-html="highlightMatch(getDisplayLabel(suggestion))" />
              <span v-if="suggestion.description" class="fa-option-description">
                {{ suggestion.description }}
              </span>
            </span>
          </button>
        </template>

        <div v-else class="fa-empty">
          <SearchIcon :size="16" class="fa-empty-icon" aria-hidden="true" />
          <span>{{ emptyMessage }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.fa-panel {
  position: fixed;
  z-index: 99998;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  border-radius: var(--gitpulse-radius-md);
  box-shadow: var(--gitpulse-shadow-raised);
  overscroll-behavior: contain;
}

.fa-option {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 8px;
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

.fa-option-avatar {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.fa-option-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.fa-option-label,
.fa-option-description {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fa-option-label {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));

  :deep(.fa-highlight) {
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
    border-radius: 2px;
    padding: 0 1px;
  }
}

.fa-option-description {
  color: var(--gitpulse-text-subtle);
  font-size: 0.72rem;
}

.fa-skeleton-row {
  padding: 6px 8px;
}

.fa-skeleton-bar {
  height: 14px;
  border-radius: 4px;
  background: var(--gitpulse-skeleton-bg);
  animation: fa-shimmer 1.5s infinite;
}

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
