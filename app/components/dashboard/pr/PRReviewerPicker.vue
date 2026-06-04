<template>
  <div class="reviewer-picker sidebar-card">
    <div class="reviewer-picker__header">
      <span class="reviewer-picker__title">{{ t('prReview.reviewers') }}</span>
      <button
        class="reviewer-picker__icon-button"
        type="button"
        :aria-label="t('prReview.reviewerPicker.close')"
        :title="t('prReview.reviewerPicker.close')"
        @click="emit('close')"
      >
        <XIcon :size="13" />
      </button>
    </div>

    <div class="reviewer-picker__content">
      <form class="reviewer-picker__search" @submit.prevent="emitSearch">
        <input
          v-model="searchQuery"
          class="reviewer-picker__input"
          type="search"
          :aria-label="t('prReview.reviewerPicker.search')"
          :placeholder="t('prReview.reviewerPicker.placeholder')"
        />
        <button
          class="reviewer-picker__icon-button"
          type="submit"
          :aria-label="t('prReview.reviewerPicker.search')"
          :title="t('prReview.reviewerPicker.search')"
          :disabled="loading || submitting"
        >
          <SearchIcon :size="13" />
        </button>
      </form>

      <p v-if="error" class="reviewer-picker__message reviewer-picker__message--error">
        {{ error }}
      </p>
      <p
        v-for="warning in warnings"
        :key="`${warning.source}:${warning.message}`"
        class="reviewer-picker__message"
      >
        {{ warning.message }}
      </p>

      <div v-if="loading" class="reviewer-picker__message">
        {{ t('prReview.reviewerPicker.loading') }}
      </div>
      <div v-else-if="candidates.length > 0" class="reviewer-picker__list">
        <label
          v-for="candidate in candidates"
          :key="candidate.key"
          class="reviewer-picker__candidate"
          :class="{ 'reviewer-picker__candidate--disabled': candidate.requested }"
        >
          <input
            type="checkbox"
            :checked="selectedKeys.has(candidate.key)"
            :disabled="candidate.requested || submitting"
            :aria-label="t('prReview.reviewerPicker.selectCandidate', { name: candidate.name })"
            @change="toggleCandidate(candidate)"
          />
          <span class="reviewer-picker__candidate-body">
            <span class="reviewer-picker__candidate-name">{{ candidate.name }}</span>
            <span class="reviewer-picker__candidate-meta">
              {{ getCandidateKindLabel(candidate.kind) }}
              <span v-if="candidate.requested">{{ t('prReview.status.requested') }}</span>
            </span>
          </span>
        </label>
      </div>
      <p v-else class="reviewer-picker__message">
        {{ t('prReview.reviewerPicker.empty') }}
      </p>

      <button
        class="reviewer-picker__submit"
        type="button"
        :aria-label="t('prReview.reviewerPicker.requestSelected')"
        :title="t('prReview.reviewerPicker.requestSelected')"
        :disabled="selectedCandidates.length === 0 || submitting"
        @click="submitSelection"
      >
        <SendIcon :size="13" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SearchIcon, SendIcon, XIcon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  PRReviewerCandidate,
  PRReviewerCandidateWarning,
  PRReviewerMutationPayload,
} from '~/composables/usePRReviewers';

const props = defineProps<{
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
}>();

const { t } = useI18n();
const searchQuery = shallowRef('');
const selectedKeys = shallowRef(new Set<string>());

const selectedCandidates = computed(() =>
  props.candidates.filter(
    (candidate) => selectedKeys.value.has(candidate.key) && !candidate.requested
  )
);

const getCandidateKindLabel = (kind: PRReviewerCandidate['kind']) =>
  t(`prReview.reviewerPicker.kind.${kind}`);

const emitSearch = () => {
  emit('search', searchQuery.value.trim());
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
</script>

<style scoped lang="scss">
.reviewer-picker {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.reviewer-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.reviewer-picker__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.reviewer-picker__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
}

.reviewer-picker__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  gap: 8px;
}

.reviewer-picker__input {
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  font-size: 12px;
}

.reviewer-picker__icon-button,
.reviewer-picker__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.reviewer-picker__message {
  margin: 0;
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
}

.reviewer-picker__message--error {
  color: var(--gitpulse-danger);
}

.reviewer-picker__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reviewer-picker__candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 7px 8px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
}

.reviewer-picker__candidate--disabled {
  opacity: 0.64;
}

.reviewer-picker__candidate-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.reviewer-picker__candidate-name {
  overflow: hidden;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewer-picker__candidate-meta {
  display: inline-flex;
  gap: 6px;
  color: var(--gitpulse-text-subtle);
  font-size: 11px;
}

.reviewer-picker__submit {
  align-self: flex-end;
}
</style>
