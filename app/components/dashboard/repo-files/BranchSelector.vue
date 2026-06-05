<script setup lang="ts">
import {
  CheckIcon,
  ChevronDownIcon,
  GitBranchIcon,
  Loader2Icon,
  SearchIcon,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';

import type { RepoBranch } from '~/composables/useRepoFiles';

const props = defineProps<{
  branches: RepoBranch[];
  currentBranch: string;
  defaultBranch: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  select: [branch: string];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();

const isOpen = shallowRef(false);
const searchQuery = shallowRef('');
const hasOpenedModal = shallowRef(false);
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInput');
const listRef = useTemplateRef<HTMLElement>('branchList');
const activeIndex = shallowRef(-1);

const sortedBranches = computed(() => {
  const defaultB = props.branches.find((branch) => branch.name === props.defaultBranch);
  const others = props.branches
    .filter((branch) => branch.name !== props.defaultBranch)
    .sort((first, second) => first.name.localeCompare(second.name));

  return defaultB ? [defaultB, ...others] : others;
});

const filteredBranches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return sortedBranches.value;

  return sortedBranches.value.filter((branch) => branch.name.toLowerCase().includes(query));
});

const open = () => {
  if (props.loading || isOpen.value) return;

  searchQuery.value = '';
  activeIndex.value = -1;
  isOpen.value = true;
  openModal();
  hasOpenedModal.value = true;
};

const close = () => {
  if (!isOpen.value) return;

  isOpen.value = false;
  searchQuery.value = '';
  activeIndex.value = -1;

  if (hasOpenedModal.value) {
    closeModal();
    hasOpenedModal.value = false;
  }
};

const selectBranch = (branch: string) => {
  if (branch !== props.currentBranch) {
    emit('select', branch);
  }

  close();
};

const moveActive = (direction: 1 | -1) => {
  const len = filteredBranches.value.length;
  if (!len) return;

  if (activeIndex.value < 0) {
    activeIndex.value = direction === 1 ? 0 : len - 1;
  } else {
    activeIndex.value = (activeIndex.value + direction + len) % len;
  }

  // Scroll active item into view
  const items = listRef.value?.querySelectorAll('[role="option"]');
  items?.[activeIndex.value]?.scrollIntoView({ block: 'nearest' });
};

const confirmActive = () => {
  if (activeIndex.value >= 0 && activeIndex.value < filteredBranches.value.length) {
    selectBranch(filteredBranches.value[activeIndex.value]!.name);
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close();
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
    confirmActive();
  }
};

watch(isOpen, async (openState) => {
  if (!openState) return;

  await nextTick();
  searchInputRef.value?.focus();
});

watch(searchQuery, () => {
  activeIndex.value = -1;
});

onBeforeUnmount(() => {
  if (hasOpenedModal.value) {
    closeModal();
  }
});
</script>

<template>
  <div class="branch-selector">
    <button
      type="button"
      class="branch-selector__trigger"
      :disabled="loading"
      :aria-expanded="isOpen"
      :aria-label="t('branchSelector.label')"
      @click="open"
    >
      <Loader2Icon v-if="loading" :size="14" class="branch-selector__spinner" />
      <GitBranchIcon v-else :size="14" aria-hidden="true" />
      <span class="branch-selector__branch-name">{{ currentBranch || '-' }}</span>
      <ChevronDownIcon :size="14" class="branch-selector__chevron" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <Transition name="branch-modal">
        <div
          v-if="isOpen"
          class="branch-selector-overlay"
          @click.self="close"
          @keydown="handleKeydown"
        >
          <div
            class="branch-selector-panel"
            role="dialog"
            aria-modal="true"
            :aria-label="t('branchSelector.title')"
          >
            <div class="branch-selector-panel__header">
              <h3 class="branch-selector-panel__title">
                {{ t('branchSelector.title') }}
              </h3>
              <button
                class="branch-selector-panel__close"
                type="button"
                :aria-label="t('branchSelector.close')"
                @click="close"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div class="branch-selector-panel__content">
              <div class="branch-selector-panel__search">
                <SearchIcon
                  :size="14"
                  class="branch-selector-panel__search-icon"
                  aria-hidden="true"
                />
                <input
                  ref="searchInput"
                  v-model="searchQuery"
                  type="text"
                  class="branch-selector-panel__search-input"
                  :placeholder="t('branchSelector.searchPlaceholder')"
                />
              </div>

              <div v-if="filteredBranches.length === 0" class="branch-selector-panel__empty">
                {{ t('branchSelector.noBranches') }}
              </div>

              <div
                v-else
                ref="branchList"
                class="branch-selector-panel__list"
                role="listbox"
                :aria-label="t('branchSelector.title')"
              >
                <button
                  v-for="(branch, index) in filteredBranches"
                  :key="branch.name"
                  type="button"
                  :class="[
                    'branch-selector-panel__item',
                    {
                      'branch-selector-panel__item--active': branch.name === currentBranch,
                      'branch-selector-panel__item--highlighted': index === activeIndex,
                    },
                  ]"
                  role="option"
                  :aria-selected="branch.name === currentBranch"
                  @click="selectBranch(branch.name)"
                  @mouseenter="activeIndex = index"
                >
                  <GitBranchIcon
                    :size="14"
                    class="branch-selector-panel__item-icon"
                    aria-hidden="true"
                  />
                  <span class="branch-selector-panel__item-name">{{ branch.name }}</span>
                  <span
                    v-if="branch.name === defaultBranch"
                    class="branch-selector-panel__item-badge"
                  >
                    {{ t('branchSelector.default') }}
                  </span>
                  <CheckIcon
                    v-if="branch.name === currentBranch"
                    :size="14"
                    class="branch-selector-panel__item-check"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            <div class="branch-selector-panel__footer">
              <button
                type="button"
                class="branch-selector-btn branch-selector-btn--cancel"
                @click="close"
              >
                {{ t('branchSelector.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

// ─── Trigger button ────────────────────────────────────────────
.branch-selector {
  flex: none;
}

.branch-selector__trigger {
  display: inline-flex;
  max-width: 12rem;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border-strong);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.branch-selector__branch-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--gitpulse-code-font-family);
}

.branch-selector__chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.branch-selector__trigger[aria-expanded='true'] .branch-selector__chevron {
  transform: rotate(180deg);
}

.branch-selector__spinner {
  animation: spin 1s linear infinite;
}

// ─── Overlay (matches label editor pattern) ────────────────────
.branch-selector-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

// ─── Panel ─────────────────────────────────────────────────────
.branch-selector-panel {
  width: 100%;
  max-width: 24rem;
  max-height: min(36rem, calc(100vh - 4rem));
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.branch-selector-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
}

.branch-selector-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.branch-selector-panel__close {
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
  font-size: 18px;
  line-height: 1;
  transition: all 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 1px;
  }
}

// ─── Content area ──────────────────────────────────────────────
.branch-selector-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  min-height: 0;
}

.branch-selector-panel__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin: 4px 0 8px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);
  transition: border-color 0.12s ease;

  &:focus-within {
    border-color: var(--gitpulse-accent);
    box-shadow: 0 0 0 2px rgba($brand-primary, 0.12);
  }
}

.branch-selector-panel__search-icon {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.branch-selector-panel__search-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 13px;
  outline: none;

  &::placeholder {
    color: var(--gitpulse-text-muted);
  }
}

// ─── Empty state ───────────────────────────────────────────────
.branch-selector-panel__empty {
  padding: 28px 0;
  text-align: center;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
}

// ─── Branch list ───────────────────────────────────────────────
.branch-selector-panel__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0;
}

.branch-selector-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  margin: 0 -8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -2px;
  }

  &--highlighted {
    background: var(--gitpulse-surface-hover);
  }

  &--active {
    color: var(--gitpulse-accent);
  }

  &--active.branch-selector-panel__item--highlighted {
    background: var(--gitpulse-accent-soft);
  }
}

.branch-selector-panel__item-icon {
  flex-shrink: 0;
}

.branch-selector-panel__item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--gitpulse-code-font-family);
}

.branch-selector-panel__item-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.branch-selector-panel__item-check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

// ─── Footer ────────────────────────────────────────────────────
.branch-selector-panel__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px 14px;
}

// ─── Buttons ───────────────────────────────────────────────────
.branch-selector-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 1px;
  }

  &--cancel {
    color: var(--gitpulse-text-muted);
    background: transparent;

    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-hover);
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    }
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

// ─── Animations ────────────────────────────────────────────────
.branch-modal-enter-active {
  transition: opacity 0.18s ease;

  .branch-selector-panel {
    transition:
      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.18s ease;
  }
}

.branch-modal-leave-active {
  transition: opacity 0.12s ease;

  .branch-selector-panel {
    transition:
      transform 0.12s ease,
      opacity 0.12s ease;
  }
}

.branch-modal-enter-from {
  opacity: 0;

  .branch-selector-panel {
    transform: scale(0.97) translateY(6px);
    opacity: 0;
  }
}

.branch-modal-leave-to {
  opacity: 0;

  .branch-selector-panel {
    transform: scale(0.97) translateY(6px);
    opacity: 0;
  }
}

// ─── Mobile ────────────────────────────────────────────────────
@media (max-width: 480px) {
  .branch-selector-panel {
    max-width: calc(100vw - 1.5rem);
    max-height: calc(100vh - 2rem);
    margin: 0 0.75rem;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
