<template>
  <FloatingMarkdownEditor
    v-if="shouldLoadEditor"
    v-bind="attrs"
    :repo-owner="repoOwner"
    :repo-name="repoName"
    :item-number="itemNumber"
    :submit="submit"
    :placeholder="placeholder"
    :submit-label="submitLabel"
    :submitting-label="submittingLabel"
    :model-value="modelValue"
    :compact="compact"
    :autofocus="shouldAutofocusEditor"
    :submitting="submitting"
    @comment-created="emit('comment-created', $event)"
    @submitted="emit('submitted')"
    @error="emit('error', $event)"
    @expanded="emit('expanded')"
    @collapsed="emit('collapsed')"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <div
    v-else-if="!isNarrowComposerSheet"
    v-bind="attrs"
    v-show="!isAnyModalOpen"
    class="deferred-floating-markdown-editor"
    :class="{ 'deferred-floating-markdown-editor--sheet-host': !compact && Boolean(chrome) }"
    :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    :inert="isAnyModalOpen || undefined"
  >
    <button
      class="deferred-floating-markdown-editor__capsule button is-light"
      type="button"
      @click="activateEditor"
    >
      <GitHubAvatar
        variant="raised"
        interactive
        width="28"
        height="28"
        :src="currentUserAvatar"
        :alt="currentUserLogin"
        class="deferred-floating-markdown-editor__capsule-avatar"
      />
      <span class="deferred-floating-markdown-editor__capsule-placeholder has-text-grey">
        {{ resolvedPlaceholder }}
      </span>
      <span class="button is-link is-small deferred-floating-markdown-editor__capsule-submit">
        {{ resolvedSubmitLabel }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef, useAttrs, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import { useDetailOverlayChrome } from '~/composables/useDetailOverlayChrome';

type TimelineCommentItem = {
  kind: 'comment';
  eventType: 'commented';
  id: string;
  createdAt: string;
  body: string;
  url?: string;
  timelineSource: 'local.created';
  author: {
    login?: string;
    avatarUrl?: string;
    url?: string;
    resourceType?: string;
  };
};

type SubmitHandler = (body: string) => Promise<void>;

defineOptions({
  inheritAttrs: false,
});

const {
  itemNumber = null,
  submit = null,
  placeholder,
  submitLabel,
  modelValue,
  compact = false,
  autofocus = false,
  submitting = false,
} = defineProps<{
  repoOwner: string;
  repoName: string;
  itemNumber?: number | null;
  submit?: SubmitHandler | null;
  placeholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  modelValue?: string;
  compact?: boolean;
  autofocus?: boolean;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (event: 'comment-created', item: TimelineCommentItem): void;
  (event: 'submitted'): void;
  (event: 'error', message: string): void;
  (event: 'expanded'): void;
  (event: 'collapsed'): void;
  (event: 'update:modelValue', value: string): void;
}>();

const FloatingMarkdownEditor = defineAsyncComponent(
  () => import('~/components/dashboard/timeline/FloatingMarkdownEditor.vue')
);
const attrs = useAttrs();
const { t } = useI18n();
const { user } = useUserSession();
const { isAnyModalOpen } = useModalState();
const chrome = useDetailOverlayChrome();
const activatedByPlaceholder = shallowRef(false);
const isNarrowComposerSheet = computed(() => !compact && Boolean(chrome?.isNarrowViewport.value));
const isSheetOpen = computed(
  () => isNarrowComposerSheet.value && chrome?.openSheet.value === 'composer'
);
const shouldLoadEditor = shallowRef(Boolean(compact || autofocus || isSheetOpen.value));
// Empty values fall back to GitHubAvatar's placeholder icon instead of a 404 image.
const currentUserLogin = computed(() => user.value?.login || '');
const currentUserAvatar = computed(() => user.value?.avatar_url || '');
const resolvedPlaceholder = computed(() => placeholder || t('floatingMarkdownEditor.placeholder'));
const resolvedSubmitLabel = computed(() => submitLabel || t('floatingMarkdownEditor.submit'));
const shouldAutofocusEditor = computed(() => autofocus || activatedByPlaceholder.value);

const activateEditor = () => {
  activatedByPlaceholder.value = true;
  shouldLoadEditor.value = true;
};

watch(
  () => [compact, autofocus, isSheetOpen.value],
  ([isCompact, isAutofocus, sheetOpen]) => {
    if (isCompact || isAutofocus || sheetOpen) {
      shouldLoadEditor.value = true;
    }
  },
  { immediate: true }
);

watch(
  () => modelValue,
  (value) => {
    if (!compact && !shouldLoadEditor.value) {
      chrome?.setComposerDraft(Boolean(value?.trim()));
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.deferred-floating-markdown-editor {
  position: sticky;
  bottom: 1rem;
  z-index: 6;
  padding-top: 0.5rem;
}

@media (max-width: 1024px) {
  .deferred-floating-markdown-editor--sheet-host {
    display: none;
  }
}

.deferred-floating-markdown-editor__capsule {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 52px;
  gap: 0.75rem;
  padding: 0.625rem 0.625rem 0.625rem 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--gitpulse-shadow-raised);
  text-align: left;
  cursor: text;
}

.deferred-floating-markdown-editor__capsule-avatar,
.deferred-floating-markdown-editor__capsule-submit {
  flex: none;
}

.deferred-floating-markdown-editor__capsule-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
