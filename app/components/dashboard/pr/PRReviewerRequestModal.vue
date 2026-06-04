<template>
  <Teleport to="body">
    <Transition name="reviewer-modal">
      <div
        v-if="isVisible"
        class="reviewer-modal-overlay"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
      >
        <div
          class="reviewer-modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('prReview.reviewerPicker.requestReviewers')"
        >
          <div class="reviewer-modal-header">
            <h3 class="reviewer-modal-title">
              {{ t('prReview.reviewerPicker.requestReviewers') }}
            </h3>
            <button
              class="reviewer-modal-close"
              type="button"
              :aria-label="t('prReview.reviewerPicker.close')"
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
                  :placeholder="t('prReview.reviewerPicker.placeholder')"
                  :aria-label="t('prReview.reviewerPicker.search')"
                  @keydown="handleSearchKeydown"
                />
                <button
                  v-if="searchQuery.length > 0"
                  class="reviewer-modal-search-clear"
                  type="button"
                  :aria-label="t('prReview.reviewerPicker.clearSearch')"
                  @click="clearSearch"
                >
                  <XIcon :size="12" />
                </button>
              </div>
            </form>

            <div v-if="error" class="reviewer-modal-error">
              <AlertCircleIcon :size="14" />
              <span>{{ error }}</span>
              <button class="reviewer-modal-error-dismiss" @click="emit('clearError')">
                <XIcon :size="12" />
              </button>
            </div>

            <div
              v-for="warning in warnings"
              :key="`${warning.source}:${warning.message}`"
              class="reviewer-modal-warning"
            >
              <AlertTriangleIcon :size="14" />
              <span>{{ warning.message }}</span>
            </div>

            <div v-if="loading" class="reviewer-modal-loading">
              <Loader2Icon class="spin-animation" :size="18" />
              <span>{{ t('prReview.reviewerPicker.loading') }}</span>
            </div>

            <div v-else-if="groupedCandidates.length > 0" class="reviewer-modal-list" ref="listRef">
              <CollapsibleGroup
                v-for="group in groupedCandidates"
                :key="group.kind"
                :id="group.kind"
                :count="group.items.length"
              >
                <template #header>
                  {{ t(`prReview.reviewerPicker.kind.${group.kind}`) }}
                </template>
                <label
                  v-for="candidate in group.items"
                  :key="candidate.key"
                  class="reviewer-modal-candidate"
                  :class="{
                    'reviewer-modal-candidate--selected': selectedKeys.has(candidate.key),
                    'reviewer-modal-candidate--requested': candidate.requested,
                    'reviewer-modal-candidate--focused': focusedKey === candidate.key,
                  }"
                  :data-key="candidate.key"
                >
                  <input
                    type="checkbox"
                    :checked="selectedKeys.has(candidate.key)"
                    :disabled="candidate.requested || submitting"
                    :aria-label="
                      t('prReview.reviewerPicker.selectCandidate', { name: candidate.name })
                    "
                    @change="toggleCandidate(candidate)"
                    @focus="focusedKey = candidate.key"
                  />
                  <div class="reviewer-modal-candidate-check">
                    <CheckIcon :size="10" />
                  </div>
                  <img
                    v-if="candidate.avatarUrl && candidate.kind === 'user'"
                    :src="candidate.avatarUrl"
                    :alt="candidate.name"
                    class="reviewer-modal-candidate-avatar"
                  />
                  <span
                    v-else
                    class="reviewer-modal-candidate-avatar reviewer-modal-candidate-avatar--fallback"
                  >
                    <UsersIcon v-if="candidate.kind === 'user'" :size="12" />
                    <UsersIcon v-else :size="12" />
                  </span>
                  <span class="reviewer-modal-candidate-body">
                    <span class="reviewer-modal-candidate-name">{{ candidate.name }}</span>
                    <span v-if="candidate.requested" class="reviewer-modal-candidate-badge">
                      {{ t('prReview.status.requested') }}
                    </span>
                  </span>
                </label>
              </CollapsibleGroup>
            </div>

            <div v-else class="reviewer-modal-empty">
              <UserIcon :size="24" />
              <p>{{ t('prReview.reviewerPicker.empty') }}</p>
            </div>
          </div>

          <div class="reviewer-modal-footer">
            <button
              class="reviewer-modal-btn reviewer-modal-btn--cancel"
              type="button"
              :disabled="submitting"
              @click="emit('close')"
            >
              {{ t('prReview.reviewerPicker.cancel') }}
            </button>
            <button
              class="reviewer-modal-btn reviewer-modal-btn--submit"
              type="button"
              :disabled="selectedCandidates.length === 0 || submitting"
              @click="submitSelection"
            >
              <Loader2Icon v-if="submitting" class="spin-animation" :size="14" />
              <SendIcon v-else :size="14" />
              <span>{{ t('prReview.reviewerPicker.requestSelected') }}</span>
              <span v-if="selectedCandidates.length > 0" class="reviewer-modal-btn-count">
                {{ selectedCandidates.length }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  SearchIcon,
  SendIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';
import type {
  PRReviewerCandidate,
  PRReviewerCandidateWarning,
  PRReviewerKind,
  PRReviewerMutationPayload,
} from '~/composables/usePRReviewers';

const props = defineProps<{
  isVisible: boolean;
  candidates: PRReviewerCandidate[];
  warnings: PRReviewerCandidateWarning[];
  loading: boolean;
  submitting: boolean;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  search: [query: string];
  submit: [payload: PRReviewerMutationPayload];
  clearError: [];
}>();

const { t } = useI18n();
const searchQuery = shallowRef('');
const selectedKeys = shallowRef(new Set<string>());
const focusedKey = shallowRef<string | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);

interface CandidateGroup {
  kind: PRReviewerKind;
  items: PRReviewerCandidate[];
}

const groupedCandidates = computed<CandidateGroup[]>(() => {
  const users = props.candidates.filter((c) => c.kind === 'user');
  const teams = props.candidates.filter((c) => c.kind === 'team');
  const groups: CandidateGroup[] = [];
  if (users.length > 0) groups.push({ kind: 'user', items: users });
  if (teams.length > 0) groups.push({ kind: 'team', items: teams });
  return groups;
});

const selectedCandidates = computed(() =>
  props.candidates.filter(
    (candidate) => selectedKeys.value.has(candidate.key) && !candidate.requested
  )
);

const handleSearch = () => {
  emit('search', searchQuery.value.trim());
};

const clearSearch = () => {
  searchQuery.value = '';
  emit('search', '');
  nextTick(() => searchInputRef.value?.focus());
};

const toggleCandidate = (candidate: PRReviewerCandidate) => {
  if (candidate.requested) return;

  const nextKeys = new Set(selectedKeys.value);
  if (nextKeys.has(candidate.key)) {
    nextKeys.delete(candidate.key);
  } else {
    nextKeys.add(candidate.key);
  }
  selectedKeys.value = nextKeys;
};

const handleSearchKeydown = (event: KeyboardEvent) => {
  if (!listRef.value) return;

  const candidateElements = listRef.value.querySelectorAll('.reviewer-modal-candidate');
  const candidateArray = Array.from(candidateElements) as HTMLElement[];
  const currentIndex = focusedKey.value
    ? candidateArray.findIndex((el) => el.dataset.key === focusedKey.value)
    : -1;

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      const nextIndex = currentIndex < candidateArray.length - 1 ? currentIndex + 1 : 0;
      const nextElement = candidateArray[nextIndex];
      if (nextElement) {
        focusedKey.value = nextElement.dataset.key ?? null;
        nextElement.scrollIntoView({ block: 'nearest' });
        const checkbox = nextElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
        checkbox?.focus();
      }
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : candidateArray.length - 1;
      const prevElement = candidateArray[prevIndex];
      if (prevElement) {
        focusedKey.value = prevElement.dataset.key ?? null;
        prevElement.scrollIntoView({ block: 'nearest' });
        const checkbox = prevElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
        checkbox?.focus();
      }
      break;
    }
    case 'Enter': {
      if (focusedKey.value) {
        const candidate = props.candidates.find((c) => c.key === focusedKey.value);
        if (candidate && !candidate.requested) {
          toggleCandidate(candidate);
        }
      }
      break;
    }
  }
};

const submitSelection = () => {
  const payload = selectedCandidates.value.reduce<PRReviewerMutationPayload>(
    (nextPayload, candidate) => {
      if (candidate.kind === 'team' && candidate.slug) {
        nextPayload.teamReviewers ??= [];
        nextPayload.teamReviewers.push(candidate.slug);
      }

      if (candidate.kind === 'user' && candidate.login) {
        nextPayload.reviewers ??= [];
        nextPayload.reviewers.push(candidate.login);
      }

      return nextPayload;
    },
    {}
  );

  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  emit('submit', payload);
};

watch(
  () => props.candidates,
  (candidates) => {
    const availableKeys = new Set(
      candidates.filter((candidate) => !candidate.requested).map((candidate) => candidate.key)
    );
    selectedKeys.value = new Set([...selectedKeys.value].filter((key) => availableKeys.has(key)));
  }
);

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      searchQuery.value = '';
      selectedKeys.value = new Set();
      focusedKey.value = null;
      nextTick(() => searchInputRef.value?.focus());
    }
  }
);
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.reviewer-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

.reviewer-modal-panel {
  width: 100%;
  max-width: 420px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.reviewer-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.reviewer-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.reviewer-modal-close {
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

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.reviewer-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  min-height: 0;
}

.reviewer-modal-search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 0 8px;
  background: var(--gitpulse-surface);
}

.reviewer-modal-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.reviewer-modal-search-icon {
  position: absolute;
  left: 10px;
  color: var(--gitpulse-text-muted);
  pointer-events: none;
}

.reviewer-modal-search-input {
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

.reviewer-modal-search-clear {
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

.reviewer-modal-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--gitpulse-danger-soft);
  border-radius: 6px;
  color: var(--gitpulse-danger);
  font-size: 12px;
}

.reviewer-modal-error-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: auto;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--gitpulse-danger);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-danger-soft);
  }
}

.reviewer-modal-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--gitpulse-warning-soft);
  border-radius: 6px;
  color: var(--gitpulse-warning);
  font-size: 12px;
}

.reviewer-modal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

.reviewer-modal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reviewer-modal-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reviewer-modal-candidate {
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

  &--requested {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--focused {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -2px;
  }

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.reviewer-modal-candidate-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--gitpulse-input-border);
  border-radius: 4px;
  background: var(--gitpulse-input-bg);
  color: transparent;
  flex-shrink: 0;
  transition: all 0.12s ease;

  .reviewer-modal-candidate:hover & {
    border-color: var(--gitpulse-border-strong);
  }

  .reviewer-modal-candidate--selected & {
    background: $brand-primary;
    border-color: $brand-primary;
    color: var(--gitpulse-surface);
  }

  .reviewer-modal-candidate--requested & {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border);
  }
}

.reviewer-modal-candidate-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.reviewer-modal-candidate-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-surface-hover);
  color: var(--gitpulse-text-muted);
}

.reviewer-modal-candidate-body {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
}

.reviewer-modal-candidate-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewer-modal-candidate-badge {
  font-size: 10px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.reviewer-modal-empty {
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

.reviewer-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
}

.reviewer-modal-btn {
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

.reviewer-modal-btn--cancel {
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }
}

.reviewer-modal-btn--submit {
  color: var(--gitpulse-surface);
  background: $brand-primary;
  border: 1px solid $brand-primary;

  &:hover:not(:disabled) {
    background: var(--gitpulse-accent-hover);
    border-color: var(--gitpulse-accent-hover);
  }
}

.reviewer-modal-btn-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--gitpulse-surface);
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9px;
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

.reviewer-modal-enter-active,
.reviewer-modal-leave-active {
  transition: opacity 0.18s ease;

  .reviewer-modal-panel {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.reviewer-modal-enter-from,
.reviewer-modal-leave-to {
  opacity: 0;

  .reviewer-modal-panel {
    transform: scale(0.96) translateY(8px);
  }
}

.reviewer-modal-enter-to,
.reviewer-modal-leave-from {
  opacity: 1;

  .reviewer-modal-panel {
    transform: scale(1) translateY(0);
  }
}
</style>
