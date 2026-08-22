<script setup lang="ts">
import { computed } from 'vue';

import MarkdownComposer from '~/components/dashboard/composer/MarkdownComposer.vue';

const props = defineProps<{
  path: string;
  line: number;
  body: string;
  submitting: boolean;
  repoOwner: string;
  repoName: string;
}>();

const emit = defineEmits<{
  (e: 'update:body', body: string): void;
  (e: 'save', path: string, line: number, body: string): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const draft = computed({
  get: () => props.body,
  set: (body: string) => emit('update:body', body),
});
const trimmedDraft = computed(() => draft.value.trim());
</script>

<template>
  <div class="pr-review-inline-comment">
    <section class="pr-review-inline-comment__card" :aria-label="t('prReview.addLineComment')">
      <MarkdownComposer
        v-model="draft"
        surface="review-inline"
        :repo-owner="repoOwner"
        :repo-name="repoName"
        :placeholder="t('prReview.inlinePlaceholder')"
        :disabled="submitting"
        compact
      />
      <footer class="pr-review-inline-comment__footer">
        <span class="pr-review-inline-comment__line-label">
          {{ t('prReview.lineLabel', { line }) }}
        </span>
        <div class="pr-review-inline-comment__actions">
          <button
            class="button is-small is-light"
            type="button"
            :disabled="submitting"
            @click="emit('cancel')"
          >
            {{ t('prReview.cancelDraft') }}
          </button>
          <button
            class="button is-small is-link"
            type="button"
            :disabled="submitting || !trimmedDraft"
            @click="emit('save', path, line, trimmedDraft)"
          >
            {{ t('prReview.saveDraft') }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped lang="scss">
.pr-review-inline-comment {
  padding: 0.35rem 0.75rem 0.75rem 1rem;
}

.pr-review-inline-comment__card {
  padding: 0.65rem 0.7rem 0.55rem;
  border: 1px solid var(--gitpulse-border-strong);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 10px 28px -12px rgba(15, 23, 42, 0.22);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:focus-within {
    border-color: color-mix(in srgb, var(--gitpulse-accent) 50%, var(--gitpulse-border-strong));
    box-shadow:
      0 0 0 3px var(--gitpulse-accent-soft),
      0 1px 2px rgba(15, 23, 42, 0.06),
      0 10px 28px -12px rgba(15, 23, 42, 0.22);
  }
}

html.dark .pr-review-inline-comment__card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 12px 32px -14px rgba(0, 0, 0, 0.55);

  &:focus-within {
    box-shadow:
      0 0 0 3px var(--gitpulse-accent-soft),
      0 1px 2px rgba(0, 0, 0, 0.4),
      0 12px 32px -14px rgba(0, 0, 0, 0.55);
  }
}

// Tighten the composer for the inline surface: smaller min height, capped growth.
.pr-review-inline-comment__card :deep(.markdown-composer__header) {
  margin-bottom: 0.45rem;
}

.pr-review-inline-comment__card :deep(.markdown-composer__textarea),
.pr-review-inline-comment__card :deep(.markdown-composer__preview) {
  min-height: 5.25rem;
  max-height: 16rem;
}

.pr-review-inline-comment__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.55rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--gitpulse-border);
}

.pr-review-inline-comment__line-label {
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pr-review-inline-comment__actions {
  display: flex;
  gap: 0.4rem;
}
</style>
