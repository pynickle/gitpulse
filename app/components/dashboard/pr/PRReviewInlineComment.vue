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
    <MarkdownComposer
      v-model="draft"
      surface="review-inline"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      :placeholder="t('prReview.inlinePlaceholder')"
      :disabled="submitting"
      compact
    />
    <div class="buttons is-justify-content-flex-end mt-2 mb-0">
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
  </div>
</template>

<style scoped lang="scss">
.pr-review-inline-comment {
  padding: 0.75rem;
  border-top: 1px solid var(--gitpulse-border);
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-draft-bg);
}
</style>
