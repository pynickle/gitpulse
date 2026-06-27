<script setup lang="ts">
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '@lucide/vue';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type {
  DetailPeoplePickerCandidate,
  DetailPeoplePickerSubmitPayload,
  DetailPeoplePickerWarning,
} from '~/types/detail-people-picker';

interface CandidateGroup {
  kind: string;
  label: string;
  items: DetailPeoplePickerCandidate[];
}

const props = withDefaults(
  defineProps<{
    isVisible: boolean;
    title: string;
    closeLabel: string;
    searchPlaceholder: string;
    searchLabel: string;
    clearSearchLabel: string;
    loadingLabel: string;
    emptyLabel: string;
    cancelLabel: string;
    submitLabel: string;
    candidates: DetailPeoplePickerCandidate[];
    initialSelectedKeys?: string[];
    groupLabels?: Record<string, string>;
    warnings?: DetailPeoplePickerWarning[];
    loading: boolean;
    submitting: boolean;
    error: string;
    allowEmptySelection?: boolean;
    submitRequiresChange?: boolean;
    showSelectedCount?: boolean;
  }>(),
  {
    initialSelectedKeys: () => [],
    groupLabels: () => ({}),
    warnings: () => [],
    allowEmptySelection: false,
    submitRequiresChange: false,
    showSelectedCount: false,
  }
);

const emit = defineEmits<{
  close: [];
  search: [query: string];
  submit: [payload: DetailPeoplePickerSubmitPayload];
  clearError: [];
}>();

const searchQuery = shallowRef('');
const selectedKeys = shallowRef(new Set<string>());
const focusedKey = shallowRef<string | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);

const focusSearchInput = () => {
  if (!import.meta.client) return;

  nextTick(() => {
    window.requestAnimationFrame(() => searchInputRef.value?.focus());
  });
};

const initialSelectedKeySet = computed(() => new Set(props.initialSelectedKeys));

const groupedCandidates = computed<CandidateGroup[]>(() => {
  const groupMap = new Map<string, DetailPeoplePickerCandidate[]>();

  for (const candidate of props.candidates) {
    const items = groupMap.get(candidate.kind) ?? [];
    items.push(candidate);
    groupMap.set(candidate.kind, items);
  }

  return [...groupMap.entries()].map(([kind, items]) => ({
    kind,
    label: props.groupLabels[kind] ?? kind,
    items,
  }));
});

const selectedCandidates = computed(() =>
  props.candidates.filter(
    (candidate) => selectedKeys.value.has(candidate.key) && !candidate.disabled
  )
);

const hasSelectionChanges = computed(() => {
  if (selectedKeys.value.size !== initialSelectedKeySet.value.size) return true;

  for (const key of selectedKeys.value) {
    if (!initialSelectedKeySet.value.has(key)) return true;
  }

  return false;
});

const isSubmitDisabled = computed(() => {
  if (props.submitting) return true;
  if (!props.allowEmptySelection && selectedCandidates.value.length === 0) return true;
  if (props.submitRequiresChange && !hasSelectionChanges.value) return true;

  return false;
});

const handleSearch = () => {
  emit('search', searchQuery.value.trim());
};

const clearSearch = () => {
  searchQuery.value = '';
  emit('search', '');
  focusSearchInput();
};

const toggleCandidate = (candidate: DetailPeoplePickerCandidate) => {
  if (candidate.disabled) return;

  const nextKeys = new Set(selectedKeys.value);
  if (nextKeys.has(candidate.key)) {
    nextKeys.delete(candidate.key);
  } else {
    nextKeys.add(candidate.key);
  }
  selectedKeys.value = nextKeys;
};

const getFocusableCandidates = () => {
  if (!listRef.value) return [];

  const candidateElements = listRef.value.querySelectorAll('.reviewer-modal-candidate');
  return Array.from(candidateElements) as HTMLElement[];
};

const focusCandidateAt = (candidateElements: HTMLElement[], index: number) => {
  const candidateElement = candidateElements[index];
  if (!candidateElement) return;

  focusedKey.value = candidateElement.dataset.key ?? null;
  candidateElement.scrollIntoView({ block: 'nearest' });
  const checkbox = candidateElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checkbox?.focus();
};

const handleSearchKeydown = (event: KeyboardEvent) => {
  const candidateElements = getFocusableCandidates();
  if (candidateElements.length === 0) return;

  const currentIndex = focusedKey.value
    ? candidateElements.findIndex((el) => el.dataset.key === focusedKey.value)
    : -1;

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      const nextIndex = currentIndex < candidateElements.length - 1 ? currentIndex + 1 : 0;
      focusCandidateAt(candidateElements, nextIndex);
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : candidateElements.length - 1;
      focusCandidateAt(candidateElements, prevIndex);
      break;
    }
    case 'Enter': {
      if (focusedKey.value) {
        const candidate = props.candidates.find((c) => c.key === focusedKey.value);
        if (candidate && !candidate.disabled) {
          event.preventDefault();
          toggleCandidate(candidate);
        }
      }
      break;
    }
  }
};

const submitSelection = () => {
  if (isSubmitDisabled.value) return;

  emit('submit', {
    selectedKeys: [...selectedKeys.value],
    candidates: selectedCandidates.value,
  });
};

watch(
  () => props.candidates,
  (candidates) => {
    const availableKeys = new Set(
      candidates.filter((candidate) => !candidate.disabled).map((candidate) => candidate.key)
    );
    selectedKeys.value = new Set(
      [...selectedKeys.value].filter(
        (key) => availableKeys.has(key) || initialSelectedKeySet.value.has(key)
      )
    );
  }
);

watch(
  () => props.initialSelectedKeys,
  (keys) => {
    if (props.isVisible) {
      selectedKeys.value = new Set(keys);
    }
  }
);

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      searchQuery.value = '';
      selectedKeys.value = new Set(props.initialSelectedKeys);
      focusedKey.value = null;
      focusSearchInput();
    }
  },
  { immediate: true }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="reviewer-modal">
      <div
        v-if="isVisible"
        class="reviewer-modal-overlay"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
      >
        <div class="reviewer-modal-panel" role="dialog" aria-modal="true" :aria-label="title">
          <div class="reviewer-modal-header">
            <h3 class="reviewer-modal-title">
              {{ title }}
            </h3>
            <button
              class="reviewer-modal-close"
              type="button"
              :aria-label="closeLabel"
              :disabled="submitting"
              @click="emit('close')"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <div class="reviewer-modal-content">
            <form class="reviewer-modal-search" @submit.prevent="handleSearch">
              <div class="reviewer-modal-search-input-wrapper">
                <SearchIcon :size="14" class="reviewer-modal-search-icon" />
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  class="reviewer-modal-search-input"
                  type="search"
                  :placeholder="searchPlaceholder"
                  :aria-label="searchLabel"
                  @keydown="handleSearchKeydown"
                />
                <button
                  v-if="searchQuery.length > 0"
                  class="reviewer-modal-search-clear"
                  type="button"
                  :aria-label="clearSearchLabel"
                  @click="clearSearch"
                >
                  <XIcon :size="12" />
                </button>
              </div>
            </form>

            <div v-if="error" class="reviewer-modal-error">
              <AlertCircleIcon :size="14" />
              <span>{{ error }}</span>
              <button
                class="reviewer-modal-error-dismiss"
                type="button"
                @click="emit('clearError')"
              >
                <XIcon :size="12" />
              </button>
            </div>

            <div v-for="warning in warnings" :key="warning.key" class="reviewer-modal-warning">
              <AlertTriangleIcon :size="14" />
              <span>{{ warning.message }}</span>
            </div>

            <div v-if="loading" class="reviewer-modal-loading">
              <Loader2Icon class="spin-animation" :size="18" />
              <span>{{ loadingLabel }}</span>
            </div>

            <div v-else-if="groupedCandidates.length > 0" ref="listRef" class="reviewer-modal-list">
              <CollapsibleGroup
                v-for="group in groupedCandidates"
                :key="group.kind"
                :id="group.kind"
                :count="group.items.length"
              >
                <template #header>
                  {{ group.label }}
                </template>
                <label
                  v-for="candidate in group.items"
                  :key="candidate.key"
                  class="reviewer-modal-candidate"
                  :class="{
                    'reviewer-modal-candidate--selected': selectedKeys.has(candidate.key),
                    'reviewer-modal-candidate--requested': candidate.disabled,
                    'reviewer-modal-candidate--focused': focusedKey === candidate.key,
                  }"
                  :data-key="candidate.key"
                >
                  <input
                    type="checkbox"
                    :checked="selectedKeys.has(candidate.key)"
                    :disabled="candidate.disabled || submitting"
                    :aria-label="candidate.ariaLabel"
                    @change="toggleCandidate(candidate)"
                    @focus="focusedKey = candidate.key"
                  />
                  <div class="reviewer-modal-candidate-check">
                    <CheckIcon :size="10" />
                  </div>
                  <GitHubAvatar
                    v-if="candidate.avatarUrl && candidate.kind === 'user'"
                    :src="candidate.avatarUrl"
                    :alt="candidate.name"
                    size="24"
                    class="reviewer-modal-candidate-avatar"
                  />
                  <span
                    v-else
                    class="reviewer-modal-candidate-avatar reviewer-modal-candidate-avatar--fallback"
                  >
                    <UsersIcon v-if="candidate.kind === 'team'" :size="12" />
                    <UserIcon v-else :size="12" />
                  </span>
                  <span class="reviewer-modal-candidate-body">
                    <span class="reviewer-modal-candidate-name">{{ candidate.name }}</span>
                    <span v-if="candidate.badgeLabel" class="reviewer-modal-candidate-badge">
                      {{ candidate.badgeLabel }}
                    </span>
                  </span>
                </label>
              </CollapsibleGroup>
            </div>

            <div v-else class="reviewer-modal-empty">
              <slot name="empty-icon">
                <UserIcon :size="24" />
              </slot>
              <p>{{ emptyLabel }}</p>
            </div>
          </div>

          <div class="reviewer-modal-footer">
            <button
              class="reviewer-modal-btn reviewer-modal-btn--cancel"
              type="button"
              :disabled="submitting"
              @click="emit('close')"
            >
              {{ cancelLabel }}
            </button>
            <button
              class="reviewer-modal-btn reviewer-modal-btn--submit"
              type="button"
              :disabled="isSubmitDisabled"
              @click="submitSelection"
            >
              <Loader2Icon v-if="submitting" class="spin-animation" :size="14" />
              <slot v-else name="submit-icon">
                <CheckIcon :size="14" />
              </slot>
              <span>{{ submitLabel }}</span>
              <span
                v-if="showSelectedCount && selectedCandidates.length > 0"
                class="reviewer-modal-btn-count"
              >
                {{ selectedCandidates.length }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/assets/scss/reviewer-modal';
</style>
