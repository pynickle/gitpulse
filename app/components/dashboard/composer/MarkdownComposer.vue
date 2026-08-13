<script setup lang="ts">
import { Columns2Icon, Rows2Icon } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { MentionSuggestionsResponse } from '#shared/types/mention-suggestions';
import type { ComposerLayoutId } from '#shared/types/user-settings';
import {
  mapProportionalScrollOffset,
  type ComposerSurface,
} from '#shared/utils/composer-presentation';
import {
  findMarkdownMentionTrigger,
  type MarkdownMentionTrigger,
} from '#shared/utils/markdown-mentions';
import type { AutocompleteSuggestion } from '~/components/ui/autocomplete';
import AutocompleteMenu from '~/components/ui/AutocompleteMenu.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = withDefaults(
  defineProps<{
    surface: ComposerSurface;
    repoOwner: string;
    repoName: string;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
    autofocus?: boolean;
    expanded?: boolean;
  }>(),
  {
    placeholder: undefined,
    disabled: false,
    compact: false,
    autofocus: false,
    expanded: true,
  }
);

const draft = defineModel<string>({ default: '' });

const emit = defineEmits<{
  (e: 'update:layout', layout: ComposerLayoutId): void;
  (e: 'update:bleed', bleed: boolean): void;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef');
const previewRef = useTemplateRef<HTMLElement>('previewRef');
const mentionComponentId = useId();
const mentionListboxId = `${mentionComponentId}-mentions`;

const { layout, activePane, switchable, bleed, seedLayout, toggleLayout, setActivePane } =
  useComposerPresentation({
    surface: () => props.surface,
    expanded: () => props.expanded,
  });

const mentionTrigger = shallowRef<MarkdownMentionTrigger | null>(null);
const mentionQuery = shallowRef('');
const mentionSuggestions = shallowRef<AutocompleteSuggestion[]>([]);
const mentionLoading = shallowRef(false);
const mentionLoadFailed = shallowRef(false);
const mentionActiveIndex = shallowRef(-1);
const mentionAnchorReady = shallowRef(false);
let mentionSearchTimer: ReturnType<typeof setTimeout> | null = null;
let mentionSearchRequestId = 0;
let isSyncingSplitScroll = false;

const trimmedDraft = computed(() => draft.value.trim());
const writeVisible = computed(() => layout.value === 'split' || activePane.value === 'write');
const previewVisible = computed(() => layout.value === 'split' || activePane.value === 'preview');
const mentionOpen = computed(
  () =>
    Boolean(mentionTrigger.value) &&
    mentionAnchorReady.value &&
    writeVisible.value &&
    !props.disabled
);
const mentionEmptyMessage = computed(() =>
  mentionLoadFailed.value
    ? t('floatingMarkdownEditor.mentionSuggestionsUnavailable')
    : t('floatingMarkdownEditor.mentionSuggestionsEmpty')
);
const mentionMenuLoading = computed(
  () => mentionLoading.value && mentionSuggestions.value.length === 0 && !mentionLoadFailed.value
);
const resolvedPlaceholder = computed(
  () => props.placeholder || t('floatingMarkdownEditor.placeholder')
);
const composerClass = computed(() => ({
  'markdown-composer--compact': props.compact,
  'markdown-composer--split': layout.value === 'split',
  'markdown-composer--tabbed': layout.value === 'tabbed',
}));

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
  mentionAnchorReady.value = false;
  mentionActiveIndex.value = -1;
  mentionLoading.value = false;
  mentionLoadFailed.value = false;
  if (mentionSearchTimer) {
    clearTimeout(mentionSearchTimer);
    mentionSearchTimer = null;
  }
  mentionSearchRequestId += 1;
};

const getMentionInlineAnchor = (): { x: number; y: number; height: number } | null => {
  const el = textareaRef.value;
  if (!el) return null;

  const trigger = mentionTrigger.value;
  if (!trigger) return null;

  return getTextareaCaretAnchorRect(el, trigger.start);
};

const { panelStyle: mentionPanelStyle, updatePanelPosition: updateMentionPanelPosition } =
  useAutocompletePanel({
    isOpen: mentionOpen,
    listboxId: mentionListboxId,
    getAnchor: () => textareaRef.value,
    getInlineAnchor: getMentionInlineAnchor,
    requireInlineAnchor: true,
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
  if (!el || !writeVisible.value || props.disabled) {
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

  const previousTrigger = mentionTrigger.value;
  const anchorChanged = previousTrigger?.start !== trigger.start;
  const queryChanged = trigger.query !== mentionQuery.value || !previousTrigger;
  mentionTrigger.value = trigger;
  mentionQuery.value = trigger.query;
  if (anchorChanged || !mentionAnchorReady.value) {
    mentionAnchorReady.value = updateMentionPanelPosition();
  }

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

const autoResizeTextarea = () => {
  if (layout.value === 'split') {
    return;
  }

  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

const insertMentionSuggestion = async (suggestion: AutocompleteSuggestion) => {
  const trigger = mentionTrigger.value;
  if (!trigger) return;

  const mentionText = `@${suggestion.value} `;
  const nextDraft =
    draft.value.slice(0, trigger.start) + mentionText + draft.value.slice(trigger.end);
  const nextCaret = trigger.start + mentionText.length;

  draft.value = nextDraft;
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

const handleDraftInput = (event: Event) => {
  draft.value = (event.target as HTMLTextAreaElement).value;
  autoResizeTextarea();
  refreshMentionTrigger();
};

const resetSplitScroll = () => {
  const writeEl = textareaRef.value;
  const previewEl = previewRef.value;
  if (writeEl) {
    writeEl.scrollTop = 0;
  }
  if (previewEl) {
    previewEl.scrollTop = 0;
  }
};

const handleSplitScroll = (source: 'write' | 'preview') => {
  if (layout.value !== 'split' || isSyncingSplitScroll) {
    return;
  }

  const writeEl = textareaRef.value;
  const previewEl = previewRef.value;
  if (!writeEl || !previewEl) {
    return;
  }

  const sourceEl = source === 'write' ? writeEl : previewEl;
  const targetEl = source === 'write' ? previewEl : writeEl;
  isSyncingSplitScroll = true;
  targetEl.scrollTop = mapProportionalScrollOffset(
    sourceEl.scrollTop,
    sourceEl.scrollHeight,
    targetEl.scrollHeight
  );
  requestAnimationFrame(() => {
    isSyncingSplitScroll = false;
  });
};

const focus = async () => {
  await nextTick();
  textareaRef.value?.focus();
};

watch(layout, async (nextLayout) => {
  emit('update:layout', nextLayout);
  closeMentionAutocomplete();
  await nextTick();
  resetSplitScroll();
  if (nextLayout === 'tabbed') {
    autoResizeTextarea();
  }
});

watch(bleed, (nextBleed) => {
  emit('update:bleed', nextBleed);
});

watch(activePane, async (pane) => {
  if (pane === 'write') {
    await nextTick();
    autoResizeTextarea();
    refreshMentionTrigger();
    return;
  }

  closeMentionAutocomplete();
});

watch(
  () => [props.repoOwner, props.repoName],
  () => {
    closeMentionAutocomplete();
    mentionSuggestions.value = [];
  }
);

if (props.autofocus) {
  void focus();
}

if (props.compact || layout.value === 'tabbed') {
  void nextTick().then(() => autoResizeTextarea());
}

emit('update:layout', layout.value);
emit('update:bleed', bleed.value);

onBeforeUnmount(() => {
  closeMentionAutocomplete();
});

defineExpose({
  focus,
  seedLayout,
  layout,
  bleed,
});
</script>

<template>
  <div class="markdown-composer" :class="composerClass">
    <div class="markdown-composer__header">
      <div v-if="layout === 'tabbed'" class="markdown-composer__tabs tabs is-small mb-0">
        <ul>
          <li :class="{ 'is-active': activePane === 'write' }">
            <a href="#" @click.prevent="setActivePane('write')">
              {{ t('floatingMarkdownEditor.writeTab') }}
            </a>
          </li>
          <li :class="{ 'is-active': activePane === 'preview' }">
            <a href="#" @click.prevent="setActivePane('preview')">
              {{ t('floatingMarkdownEditor.previewTab') }}
            </a>
          </li>
        </ul>
      </div>
      <div class="markdown-composer__header-meta">
        <slot name="header-meta" />
        <button
          v-if="switchable"
          class="button is-small is-light markdown-composer__layout-switch"
          type="button"
          :aria-label="
            layout === 'split'
              ? t('floatingMarkdownEditor.switchToTabbed')
              : t('floatingMarkdownEditor.switchToSplit')
          "
          :title="
            layout === 'split'
              ? t('floatingMarkdownEditor.switchToTabbed')
              : t('floatingMarkdownEditor.switchToSplit')
          "
          :disabled="disabled"
          @click="toggleLayout"
        >
          <Rows2Icon v-if="layout === 'split'" :size="14" aria-hidden="true" />
          <Columns2Icon v-else :size="14" aria-hidden="true" />
          <span>
            {{
              layout === 'split'
                ? t('floatingMarkdownEditor.layoutTabbed')
                : t('floatingMarkdownEditor.layoutSplit')
            }}
          </span>
        </button>
      </div>
    </div>

    <div class="markdown-composer__content-area">
      <textarea
        ref="textareaRef"
        :value="draft"
        class="textarea markdown-composer__textarea"
        :class="{ 'markdown-composer__textarea--hidden': !writeVisible }"
        role="combobox"
        :rows="compact ? 4 : 6"
        :placeholder="resolvedPlaceholder"
        :disabled="disabled"
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
        @scroll="handleSplitScroll('write')"
      />

      <div
        ref="previewRef"
        class="markdown-composer__preview content"
        :class="{ 'markdown-composer__preview--hidden': !previewVisible }"
        @scroll="handleSplitScroll('preview')"
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
        :loading="mentionMenuLoading"
        :empty-message="mentionEmptyMessage"
        :aria-label="t('floatingMarkdownEditor.mentionSuggestions')"
        @select="insertMentionSuggestion"
        @activate="mentionActiveIndex = $event"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.markdown-composer__header,
.markdown-composer__header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.markdown-composer__header {
  margin-bottom: 0.75rem;
}

.markdown-composer__header-meta {
  margin-left: auto;
}

.markdown-composer__layout-switch {
  gap: 0.35rem;
}

.markdown-composer__tabs {
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
  }

  &.tabs li.is-active a {
    background: var(--gitpulse-surface-muted, rgba(0, 0, 0, 0.06));
    border-color: var(--gitpulse-border, rgba(0, 0, 0, 0.12));
  }
}

.markdown-composer__content-area {
  display: grid;
  max-height: 40vh;
}

.markdown-composer--compact .markdown-composer__content-area {
  max-height: 50vh;
}

.markdown-composer--split .markdown-composer__content-area {
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.markdown-composer__textarea,
.markdown-composer__preview {
  grid-row: 1;
  grid-column: 1;
  min-height: 160px;
  max-height: 40vh;
  overflow-y: auto;
  align-self: stretch;
}

.markdown-composer--compact .markdown-composer__textarea,
.markdown-composer--compact .markdown-composer__preview {
  min-height: 7rem;
}

.markdown-composer--split .markdown-composer__textarea,
.markdown-composer--split .markdown-composer__preview {
  grid-row: 1;
  max-height: 40vh;
}

.markdown-composer--split .markdown-composer__textarea {
  grid-column: 1;
}

.markdown-composer--split .markdown-composer__preview {
  grid-column: 2;
}

.markdown-composer--compact.markdown-composer--split .markdown-composer__textarea,
.markdown-composer--compact.markdown-composer--split .markdown-composer__preview {
  max-height: 50vh;
}

.markdown-composer__textarea {
  resize: none;
}

.markdown-composer__textarea--hidden,
.markdown-composer__preview--hidden {
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
}

.markdown-composer__preview {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  padding: 0.875rem;
  background: var(--gitpulse-surface-muted);
}
</style>
