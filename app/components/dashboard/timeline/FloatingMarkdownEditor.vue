<template>
  <div
    v-show="!isAnyModalOpen"
    :class="[
      'floating-markdown-editor',
      {
        'floating-markdown-editor--expanded': isExpanded,
        'floating-markdown-editor--compact': compact,
      },
    ]"
    :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    :inert="isAnyModalOpen || undefined"
  >
    <div v-if="errorMessage" class="notification is-danger is-light mb-3 py-2 px-3">
      <button
        class="delete is-small"
        type="button"
        :aria-label="t('floatingMarkdownEditor.dismissError')"
        @click="errorMessage = ''"
      />
      <p class="is-size-7">{{ errorMessage }}</p>
    </div>

    <!-- Collapsed capsule (non-compact mode only) -->
    <button
      v-if="!compact && !isExpanded"
      class="floating-markdown-editor__capsule button is-light"
      type="button"
      @click="expandComposer"
    >
      <GitHubAvatar
        variant="raised"
        interactive
        width="28"
        height="28"
        :src="currentUserAvatar"
        :alt="currentUserLogin"
        class="floating-markdown-editor__capsule-avatar"
      />
      <span class="floating-markdown-editor__capsule-placeholder has-text-grey">
        {{ placeholder }}
      </span>
      <span class="button is-link is-small floating-markdown-editor__capsule-submit">
        {{ submitLabel }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div v-if="compact || isExpanded" class="floating-markdown-editor__panel">
      <div class="floating-markdown-editor__header">
        <div class="floating-markdown-editor__tabs tabs is-small mb-0">
          <ul>
            <li :class="{ 'is-active': activeTab === 'write' }">
              <a href="#" @click.prevent="activeTab = 'write'">
                {{ t('floatingMarkdownEditor.writeTab') }}
              </a>
            </li>
            <li :class="{ 'is-active': activeTab === 'preview' }">
              <a href="#" @click.prevent="activeTab = 'preview'">
                {{ t('floatingMarkdownEditor.previewTab') }}
              </a>
            </li>
          </ul>
        </div>
        <div class="floating-markdown-editor__header-meta">
          <span v-if="!compact" class="is-size-7 has-text-weight-medium has-text-grey">{{
            currentUserLogin
          }}</span>
          <GitHubAvatar
            variant="raised"
            interactive
            width="22"
            height="22"
            :src="currentUserAvatar"
            :alt="currentUserLogin"
            class="floating-markdown-editor__avatar"
          />
        </div>
      </div>

      <div class="floating-markdown-editor__content-area">
        <textarea
          ref="textareaRef"
          :value="draft"
          class="textarea floating-markdown-editor__textarea"
          :class="{ 'floating-markdown-editor__textarea--hidden': activeTab !== 'write' }"
          role="combobox"
          :rows="compact ? 4 : 6"
          :placeholder="placeholder"
          :disabled="isSubmitting"
          :aria-expanded="mentionOpen"
          :aria-controls="mentionListboxId"
          :aria-activedescendant="
            mentionActiveIndex >= 0 ? `${mentionComponentId}-opt-${mentionActiveIndex}` : undefined
          "
          aria-haspopup="listbox"
          autocomplete="off"
          @input="handleDraftInput"
          @keydown="handleTextareaKeydown"
          @keyup="handleTextareaKeyup"
          @click="refreshMentionTrigger"
          @select="refreshMentionTrigger"
        />

        <div
          class="floating-markdown-editor__preview content"
          :class="{ 'floating-markdown-editor__preview--hidden': activeTab !== 'preview' }"
        >
          <MarkdownRenderer
            v-if="trimmedDraft"
            :value="draft"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
          <p v-else class="has-text-grey is-size-7 mb-0">
            {{ t('floatingMarkdownEditor.previewEmpty') }}
          </p>
        </div>

        <AutocompleteMenu
          :open="mentionOpen"
          :suggestions="mentionSuggestions"
          :query="mentionQuery"
          :active-index="mentionActiveIndex"
          :listbox-id="mentionListboxId"
          :option-id-prefix="mentionComponentId"
          :panel-style="mentionPanelStyle"
          :loading="mentionLoading"
          :empty-message="mentionEmptyMessage"
          :aria-label="t('floatingMarkdownEditor.mentionSuggestions')"
          @select="insertMentionSuggestion"
          @activate="mentionActiveIndex = $event"
        />
      </div>

      <div class="floating-markdown-editor__footer">
        <p class="is-size-7 has-text-grey mb-0">
          {{ t('floatingMarkdownEditor.markdownHint') }}
        </p>
        <div class="floating-markdown-editor__footer-actions">
          <button
            class="button is-light is-small"
            type="button"
            :disabled="isSubmitting"
            @click="collapseComposer"
          >
            {{ t('floatingMarkdownEditor.cancel') }}
          </button>
          <button
            class="button is-link is-small"
            type="button"
            :class="{ 'is-loading': isSubmitting }"
            :disabled="isSubmitting || !trimmedDraft || !canSubmit"
            @click="handleSubmit"
          >
            {{ isSubmitting ? submittingLabel : submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { MentionSuggestionsResponse } from '#shared/types/mention-suggestions';
import {
  findMarkdownMentionTrigger,
  type MarkdownMentionTrigger,
} from '#shared/utils/markdown-mentions';
import type { AutocompleteSuggestion } from '~/components/ui/autocomplete';
import AutocompleteMenu from '~/components/ui/AutocompleteMenu.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

interface CreatedCommentResponse {
  id?: number | string;
  node_id?: string;
  body?: string;
  html_url?: string;
  created_at?: string;
  user?: {
    login?: string;
    avatar_url?: string;
    html_url?: string;
    type?: string;
  };
}

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

const props = withDefaults(
  defineProps<{
    repoOwner: string;
    repoName: string;
    // Mode 1: Self-submit (for issue/PR)
    itemNumber?: number | null;
    // Mode 2: Callback submit (for discussion)
    submit?: SubmitHandler | null;
    // Configuration
    placeholder?: string;
    submitLabel?: string;
    submittingLabel?: string;
    modelValue?: string;
    compact?: boolean;
    autofocus?: boolean;
    // External state (for callback mode)
    submitting?: boolean;
  }>(),
  {
    itemNumber: null,
    submit: null,
    placeholder: undefined,
    submitLabel: undefined,
    submittingLabel: undefined,
    modelValue: undefined,
    compact: false,
    autofocus: false,
    submitting: false,
  }
);

const emit = defineEmits<{
  (e: 'comment-created', item: TimelineCommentItem): void;
  (e: 'submitted'): void;
  (e: 'error', message: string): void;
  (e: 'expanded'): void;
  (e: 'collapsed'): void;
  (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const { user } = useUserSession();
const { isAnyModalOpen } = useModalState();

const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef');
const mentionComponentId = useId();
const mentionListboxId = `${mentionComponentId}-mentions`;
const isExpanded = shallowRef(false);
const internalSubmitting = shallowRef(false);
const activeTab = shallowRef<'write' | 'preview'>('write');
const draft = shallowRef(props.modelValue ?? '');
const errorMessage = shallowRef('');
const mentionTrigger = shallowRef<MarkdownMentionTrigger | null>(null);
const mentionQuery = shallowRef('');
const mentionSuggestions = shallowRef<AutocompleteSuggestion[]>([]);
const mentionLoading = shallowRef(false);
const mentionLoadFailed = shallowRef(false);
const mentionActiveIndex = shallowRef(-1);

let mentionSearchTimer: ReturnType<typeof setTimeout> | null = null;
let mentionSearchRequestId = 0;

const trimmedDraft = computed(() => draft.value.trim());
const currentUserLogin = computed(() => user.value?.login || 'You');
const currentUserAvatar = computed(
  () => user.value?.avatar_url || 'https://github.com/placeholder.png'
);
const mentionOpen = computed(
  () => Boolean(mentionTrigger.value) && activeTab.value === 'write' && !isSubmitting.value
);
const mentionEmptyMessage = computed(() =>
  mentionLoadFailed.value
    ? t('floatingMarkdownEditor.mentionSuggestionsUnavailable')
    : t('floatingMarkdownEditor.mentionSuggestionsEmpty')
);

// Determine submission mode
const isSelfSubmitMode = computed(() => props.itemNumber != null);
const isCallbackMode = computed(() => props.submit != null);
const canSubmit = computed(() => {
  if (isSelfSubmitMode.value) {
    return Boolean(props.repoOwner && props.repoName && props.itemNumber);
  }
  return isCallbackMode.value;
});

// Use external submitting state in callback mode, internal in self-submit mode
const isSubmitting = computed(() => {
  if (isCallbackMode.value) {
    return props.submitting;
  }
  return internalSubmitting.value;
});

// Default labels
const placeholder = computed(() => props.placeholder || t('floatingMarkdownEditor.placeholder'));
const submitLabel = computed(() => props.submitLabel || t('floatingMarkdownEditor.submit'));
const submittingLabel = computed(
  () => props.submittingLabel || t('floatingMarkdownEditor.submitting')
);

const MENTION_PANEL_GAP = 4;
const MENTION_PANEL_VIEWPORT_MARGIN = 8;
const MENTION_PANEL_MIN_WIDTH = 240;
const MENTION_PANEL_MAX_WIDTH = 360;
const MENTION_PANEL_MAX_HEIGHT = 280;
const MENTION_PANEL_MIN_HEIGHT = 120;

const getMentionSuggestionsUrl = () =>
  `/api/repos/${encodeURIComponent(props.repoOwner)}/${encodeURIComponent(
    props.repoName
  )}/mention-suggestions`;

const closeMentionAutocomplete = () => {
  mentionTrigger.value = null;
  mentionActiveIndex.value = -1;
  mentionLoading.value = false;
  mentionLoadFailed.value = false;
  if (mentionSearchTimer) {
    clearTimeout(mentionSearchTimer);
    mentionSearchTimer = null;
  }
  mentionSearchRequestId += 1;
};

const { panelStyle: mentionPanelStyle, updatePanelPosition: updateMentionPanelPosition } =
  useAutocompletePanel({
    isOpen: mentionOpen,
    listboxId: mentionListboxId,
    getAnchor: () => textareaRef.value,
    onClose: closeMentionAutocomplete,
    gap: MENTION_PANEL_GAP,
    viewportMargin: MENTION_PANEL_VIEWPORT_MARGIN,
    minWidth: MENTION_PANEL_MIN_WIDTH,
    maxWidth: MENTION_PANEL_MAX_WIDTH,
    maxHeight: MENTION_PANEL_MAX_HEIGHT,
    minHeight: MENTION_PANEL_MIN_HEIGHT,
  });

const loadMentionSuggestions = async (query: string) => {
  const requestId = ++mentionSearchRequestId;
  mentionLoading.value = true;
  mentionLoadFailed.value = false;

  try {
    const response = await apiFetch<MentionSuggestionsResponse>(getMentionSuggestionsUrl(), {
      query: {
        q: query,
      },
    });

    if (requestId !== mentionSearchRequestId) {
      return;
    }

    mentionSuggestions.value = response.items.map((item) => ({
      value: item.login,
      label: item.login,
      description: item.name && item.name !== item.login ? item.name : undefined,
      avatarUrl: item.avatarUrl,
    }));
    mentionLoadFailed.value = false;
    mentionActiveIndex.value = mentionSuggestions.value.length > 0 ? 0 : -1;
  } catch {
    if (requestId === mentionSearchRequestId) {
      mentionSuggestions.value = [];
      mentionLoadFailed.value = true;
      mentionActiveIndex.value = -1;
    }
  } finally {
    if (requestId === mentionSearchRequestId) {
      mentionLoading.value = false;
    }
  }
};

const scheduleMentionSearch = (query: string) => {
  if (mentionSearchTimer) {
    clearTimeout(mentionSearchTimer);
  }

  mentionLoadFailed.value = false;
  mentionSearchTimer = setTimeout(() => {
    mentionSearchTimer = null;
    void loadMentionSuggestions(query);
  }, 150);
};

const refreshMentionTrigger = () => {
  const el = textareaRef.value;
  if (!el || activeTab.value !== 'write' || isSubmitting.value) {
    closeMentionAutocomplete();
    return;
  }

  if (el.selectionStart !== el.selectionEnd) {
    closeMentionAutocomplete();
    return;
  }

  const trigger = findMarkdownMentionTrigger(draft.value, el.selectionStart);
  if (!trigger) {
    closeMentionAutocomplete();
    return;
  }

  const queryChanged = trigger.query !== mentionQuery.value || !mentionTrigger.value;
  mentionTrigger.value = trigger;
  mentionQuery.value = trigger.query;
  updateMentionPanelPosition();

  if (queryChanged) {
    scheduleMentionSearch(trigger.query);
  }
};

const moveMentionActive = (direction: 1 | -1) => {
  const len = mentionSuggestions.value.length;
  if (!len) return;

  if (mentionActiveIndex.value < 0) {
    mentionActiveIndex.value = direction === 1 ? 0 : len - 1;
  } else {
    mentionActiveIndex.value = (mentionActiveIndex.value + direction + len) % len;
  }
};

const insertMentionSuggestion = async (suggestion: AutocompleteSuggestion) => {
  const trigger = mentionTrigger.value;
  if (!trigger) return;

  const mentionText = `@${suggestion.value} `;
  const nextDraft =
    draft.value.slice(0, trigger.start) + mentionText + draft.value.slice(trigger.end);
  const nextCaret = trigger.start + mentionText.length;

  setDraft(nextDraft);
  closeMentionAutocomplete();
  await nextTick();
  const el = textareaRef.value;
  if (el) {
    el.focus();
    el.setSelectionRange(nextCaret, nextCaret);
  }
  autoResizeTextarea();
};

const handleTextareaKeydown = (event: KeyboardEvent) => {
  if (!mentionOpen.value) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeMentionAutocomplete();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveMentionActive(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveMentionActive(-1);
    return;
  }

  if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
    const suggestion =
      mentionSuggestions.value[mentionActiveIndex.value] ?? mentionSuggestions.value[0];
    if (!suggestion) {
      return;
    }

    event.preventDefault();
    void insertMentionSuggestion(suggestion);
  }
};

const handleTextareaKeyup = (event: KeyboardEvent) => {
  if (mentionOpen.value && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
    return;
  }

  refreshMentionTrigger();
};

const focus = async () => {
  await nextTick();
  textareaRef.value?.focus();
};

const setDraft = (value: string) => {
  draft.value = value;
  emit('update:modelValue', value);
};

const autoResizeTextarea = () => {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

const handleDraftInput = (event: Event) => {
  setDraft((event.target as HTMLTextAreaElement).value);
  autoResizeTextarea();
  refreshMentionTrigger();
};

// Auto-resize textarea when switching to write tab
watch(activeTab, async (tab) => {
  if (tab === 'write') {
    await nextTick();
    autoResizeTextarea();
    refreshMentionTrigger();
  } else {
    closeMentionAutocomplete();
  }
});

watch(
  () => props.modelValue,
  async (value) => {
    if (value === undefined || value === draft.value) return;

    draft.value = value;
    await nextTick();
    autoResizeTextarea();
    closeMentionAutocomplete();
  }
);

const expandComposer = async () => {
  isExpanded.value = true;
  activeTab.value = 'write';
  emit('expanded');
  await nextTick();
  autoResizeTextarea();
  textareaRef.value?.focus();
};

const collapseComposer = () => {
  isExpanded.value = false;
  reset();
  emit('collapsed');
};

const reset = () => {
  setDraft('');
  errorMessage.value = '';
  activeTab.value = 'write';
  closeMentionAutocomplete();
  // Reset textarea height
  const el = textareaRef.value;
  if (el) {
    el.style.height = 'auto';
  }
};

const handleSubmit = async () => {
  if (!trimmedDraft.value) {
    errorMessage.value = t('floatingMarkdownEditor.emptyError');
    return;
  }

  if (!canSubmit.value) {
    errorMessage.value = t('floatingMarkdownEditor.unavailableError');
    return;
  }

  errorMessage.value = '';

  try {
    if (isSelfSubmitMode.value && props.itemNumber) {
      // Self-submit mode: call API directly
      await selfSubmit();
    } else if (isCallbackMode.value && props.submit) {
      // Callback mode: call parent's submit function
      await props.submit(trimmedDraft.value);
      emit('submitted');
    }

    reset();
    if (!props.compact) {
      isExpanded.value = false;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : t('floatingMarkdownEditor.submitFailed');
    errorMessage.value = message;
    emit('error', message);
  }
};

const selfSubmit = async () => {
  if (!props.itemNumber) return;

  internalSubmitting.value = true;

  try {
    const response = await $fetch<CreatedCommentResponse>(
      `/api/repos/${props.repoOwner}/${props.repoName}/issues/${props.itemNumber}/comments`,
      {
        method: 'POST',
        body: {
          body: trimmedDraft.value,
        },
      }
    );

    emit('comment-created', {
      kind: 'comment',
      eventType: 'commented',
      id: String(response.id ?? response.node_id ?? `local-comment-${Date.now()}`),
      createdAt: response.created_at ?? new Date().toISOString(),
      body: response.body ?? trimmedDraft.value,
      url: response.html_url,
      timelineSource: 'local.created',
      author: {
        login: response.user?.login ?? user.value?.login,
        avatarUrl: response.user?.avatar_url ?? user.value?.avatar_url,
        url:
          response.user?.html_url ??
          (user.value?.login ? `https://github.com/${user.value.login}` : undefined),
        resourceType: response.user?.type,
      },
    });
  } finally {
    internalSubmitting.value = false;
  }
};

if (props.autofocus) {
  void focus();
}

// Auto-resize textarea on mount for compact mode
if (props.compact) {
  void nextTick().then(() => autoResizeTextarea());
}

watch(
  () => [props.repoOwner, props.repoName],
  () => {
    closeMentionAutocomplete();
    mentionSuggestions.value = [];
  }
);

onBeforeUnmount(() => {
  closeMentionAutocomplete();
});

defineExpose({ focus });
</script>

<style scoped lang="scss">
.floating-markdown-editor {
  position: sticky;
  bottom: 1rem;
  z-index: 6;
  padding-top: 0.5rem;
}

.floating-markdown-editor__capsule {
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

.floating-markdown-editor__capsule-avatar {
  flex: none;
}

.floating-markdown-editor__capsule-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-markdown-editor__capsule-submit {
  flex: none;
}

.floating-markdown-editor__panel {
  border: 1px solid var(--gitpulse-border);
  border-radius: 16px;
  padding: 1rem;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--gitpulse-shadow-raised);
}

.floating-markdown-editor__header,
.floating-markdown-editor__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.floating-markdown-editor__header {
  margin-bottom: 0.75rem;
}

.floating-markdown-editor__avatar {
  flex: none;
}

.floating-markdown-editor__header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.floating-markdown-editor__tabs {
  min-width: 0;

  &.tabs ul {
    border-bottom: none !important;
    gap: 2px;
  }

  &.tabs li a {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0.3rem 0.875rem;
    font-size: 0.8rem;
    transition: all 0.15s ease;
  }

  &.tabs li.is-active a {
    background: var(--gitpulse-surface-muted, rgba(0, 0, 0, 0.06));
    border-color: var(--gitpulse-border, rgba(0, 0, 0, 0.12));
  }
}

.floating-markdown-editor__content-area {
  display: grid;
  max-height: 40vh;
}

.floating-markdown-editor--compact .floating-markdown-editor__panel {
  border-radius: 8px;
  backdrop-filter: none;
  background: var(--gitpulse-surface);
  box-shadow: none;
}

.floating-markdown-editor--compact .floating-markdown-editor__content-area {
  max-height: 50vh;
}

.floating-markdown-editor__textarea,
.floating-markdown-editor__preview {
  grid-row: 1;
  grid-column: 1;
  min-height: 160px;
  max-height: 40vh;
  overflow-y: auto;
  align-self: start;
}

.floating-markdown-editor--compact .floating-markdown-editor__textarea,
.floating-markdown-editor--compact .floating-markdown-editor__preview {
  min-height: 7rem;
}

.floating-markdown-editor__textarea {
  resize: none;
}

.floating-markdown-editor__textarea--hidden {
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
}

.floating-markdown-editor__preview {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  padding: 0.875rem;
  background: var(--gitpulse-surface-muted);
}

.floating-markdown-editor__preview--hidden {
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
}

.floating-markdown-editor__footer {
  justify-content: space-between;
  margin-top: 0.75rem;
}

.floating-markdown-editor__footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .floating-markdown-editor {
    bottom: 0.5rem;
  }

  .floating-markdown-editor__capsule {
    min-height: 48px;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  }

  .floating-markdown-editor__footer {
    align-items: stretch;
    flex-direction: column;
    gap: 0.5rem;
  }

  .floating-markdown-editor__footer-actions {
    justify-content: flex-end;
  }
}
</style>
