<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  ref,
  type PropType,
  useTemplateRef,
  watch,
} from 'vue';

import type {
  GitHubSearchSyntaxAst,
  GitHubSearchSyntaxHighlight,
} from '#shared/utils/github-search-syntax';

const props = defineProps<{
  modelValue: string;
  ast: GitHubSearchSyntaxAst;
  placeholder: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorElement = useTemplateRef<HTMLElement>('editor');
const isComposing = ref(false);
const pendingSelection = ref<{ start: number; end: number } | null>(null);
type HighlightedPart = GitHubSearchSyntaxHighlight & { text: string };

const SyntaxHighlightedContent = defineComponent({
  name: 'SyntaxHighlightedContent',
  props: {
    parts: {
      type: Array as PropType<HighlightedPart[]>,
      required: true,
    },
  },
  setup(componentProps) {
    return () =>
      componentProps.parts.map((part, index) =>
        h(
          'span',
          {
            key: `${part.start}-${part.end}-${index}`,
            class: ['syntax-token', `syntax-token--${part.type}`],
          },
          part.text
        )
      );
  },
});

const highlightPriority = (type: GitHubSearchSyntaxHighlight['type']) => {
  if (type === 'error') return 100;
  if (type === 'operator') return 80;
  if (type === 'negation' || type === 'paren') return 70;
  if (type === 'qualifier-name' || type === 'qualifier-colon') return 60;
  if (type === 'qualifier-value') return 50;
  return 10;
};

const sortedHighlights = computed(() => {
  return [...props.ast.highlights]
    .filter((highlight) => highlight.end > highlight.start)
    .sort(
      (left, right) =>
        left.start - right.start ||
        highlightPriority(right.type) - highlightPriority(left.type) ||
        right.end - left.end
    );
});

const highlightedParts = computed(() => {
  const parts: HighlightedPart[] = [];
  let cursor = 0;

  for (const highlight of sortedHighlights.value) {
    if (highlight.start < cursor) continue;
    if (highlight.start > cursor) {
      parts.push({
        type: 'term',
        start: cursor,
        end: highlight.start,
        text: props.modelValue.slice(cursor, highlight.start),
      });
    }

    parts.push({
      ...highlight,
      text: props.modelValue.slice(highlight.start, highlight.end),
    });
    cursor = highlight.end;
  }

  if (cursor < props.modelValue.length) {
    parts.push({
      type: 'term',
      start: cursor,
      end: props.modelValue.length,
      text: props.modelValue.slice(cursor),
    });
  }

  return parts;
});

const getEditorText = () => editorElement.value?.textContent ?? '';

const getSelectionOffsets = () => {
  const editor = editorElement.value;
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return null;
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(editor);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(editor);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
};

const findCaretPosition = (editor: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  let lastTextNode: Text | null = null;

  while (node) {
    const textNode = node as Text;
    lastTextNode = textNode;
    const length = textNode.data.length;
    if (remaining <= length) {
      return { node: textNode, offset: remaining };
    }
    remaining -= length;
    node = walker.nextNode();
  }

  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.data.length };
  }

  return { node: editor, offset: 0 };
};

const restoreSelection = (selectionOffsets: { start: number; end: number } | null) => {
  const editor = editorElement.value;
  const selection = window.getSelection();
  if (!editor || !selection || !selectionOffsets || document.activeElement !== editor) {
    return;
  }

  const range = document.createRange();
  const start = findCaretPosition(editor, selectionOffsets.start);
  const end = findCaretPosition(editor, selectionOffsets.end);
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
};

const syncFromEditor = () => {
  const selectionOffsets = getSelectionOffsets();
  const nextValue = getEditorText();
  pendingSelection.value = selectionOffsets;
  emit('update:modelValue', nextValue);
};

const replaceSelection = (insertedText: string, selectionOffsets = getSelectionOffsets()) => {
  const currentText = props.modelValue;
  const fallbackOffset = currentText.length;
  const rawStart = selectionOffsets?.start ?? fallbackOffset;
  const rawEnd = selectionOffsets?.end ?? fallbackOffset;
  const start = Math.max(0, Math.min(rawStart, rawEnd, currentText.length));
  const end = Math.max(0, Math.min(Math.max(rawStart, rawEnd), currentText.length));
  const nextValue = `${currentText.slice(0, start)}${insertedText}${currentText.slice(end)}`;
  const nextOffset = start + insertedText.length;

  pendingSelection.value = { start: nextOffset, end: nextOffset };
  emit('update:modelValue', nextValue);
};

const getSelectedText = (selectionOffsets = getSelectionOffsets()) => {
  if (!selectionOffsets) {
    return '';
  }

  const start = Math.max(0, Math.min(selectionOffsets.start, selectionOffsets.end));
  const end = Math.min(
    props.modelValue.length,
    Math.max(selectionOffsets.start, selectionOffsets.end)
  );
  return props.modelValue.slice(start, end);
};

const findPreviousWordBoundary = (value: string, offset: number) => {
  let cursor = Math.max(0, offset);
  while (cursor > 0 && /\s/.test(value[cursor - 1] ?? '')) cursor--;
  while (cursor > 0 && !/\s/.test(value[cursor - 1] ?? '')) cursor--;
  return cursor;
};

const findNextWordBoundary = (value: string, offset: number) => {
  let cursor = Math.min(value.length, offset);
  while (cursor < value.length && /\s/.test(value[cursor] ?? '')) cursor++;
  while (cursor < value.length && !/\s/.test(value[cursor] ?? '')) cursor++;
  return cursor;
};

const deleteSelectionRange = (
  selectionOffsets: { start: number; end: number } | null,
  direction: 'backward' | 'forward' | 'word-backward' | 'word-forward'
) => {
  const currentText = props.modelValue;
  const rawStart = selectionOffsets?.start ?? currentText.length;
  const rawEnd = selectionOffsets?.end ?? currentText.length;
  let start = Math.max(0, Math.min(rawStart, rawEnd, currentText.length));
  let end = Math.max(0, Math.min(Math.max(rawStart, rawEnd), currentText.length));

  if (start === end) {
    if (direction === 'backward') {
      start = Math.max(0, start - 1);
    } else if (direction === 'forward') {
      end = Math.min(currentText.length, end + 1);
    } else if (direction === 'word-backward') {
      start = findPreviousWordBoundary(currentText, start);
    } else {
      end = findNextWordBoundary(currentText, end);
    }
  }

  const nextValue = `${currentText.slice(0, start)}${currentText.slice(end)}`;
  pendingSelection.value = { start, end: start };
  emit('update:modelValue', nextValue);
};

const insertAtSelection = (insertedText: string) => {
  const selectionOffsets = getSelectionOffsets();
  replaceSelection(insertedText, selectionOffsets);
};

const handleBeforeInput = (event: InputEvent) => {
  if (isComposing.value || event.isComposing) {
    return;
  }

  const selectionOffsets = getSelectionOffsets();
  switch (event.inputType) {
    case 'insertText':
      event.preventDefault();
      replaceSelection(event.data ?? '', selectionOffsets);
      break;
    case 'insertLineBreak':
    case 'insertParagraph':
      event.preventDefault();
      replaceSelection('\n', selectionOffsets);
      break;
    case 'deleteContentBackward':
      event.preventDefault();
      deleteSelectionRange(selectionOffsets, 'backward');
      break;
    case 'deleteContentForward':
      event.preventDefault();
      deleteSelectionRange(selectionOffsets, 'forward');
      break;
    case 'deleteWordBackward':
      event.preventDefault();
      deleteSelectionRange(selectionOffsets, 'word-backward');
      break;
    case 'deleteWordForward':
      event.preventDefault();
      deleteSelectionRange(selectionOffsets, 'word-forward');
      break;
    case 'deleteByCut':
      event.preventDefault();
      deleteSelectionRange(selectionOffsets, 'forward');
      break;
  }
};

const handleInput = () => {
  if (!isComposing.value) {
    syncFromEditor();
  }
};

const handleCompositionStart = () => {
  isComposing.value = true;
};

const handleCompositionEnd = () => {
  isComposing.value = false;
  syncFromEditor();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    insertAtSelection('  ');
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    insertAtSelection('\n');
  }
};

const handlePaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text/plain');
  if (text === undefined) {
    return;
  }

  event.preventDefault();
  insertAtSelection(text);
};

const handleCut = (event: ClipboardEvent) => {
  const selectedText = getSelectedText();
  if (!selectedText) {
    return;
  }

  event.preventDefault();
  event.clipboardData?.setData('text/plain', selectedText);
  replaceSelection('');
};

const handleDrop = (event: DragEvent) => {
  const text = event.dataTransfer?.getData('text/plain');
  if (!text) {
    return;
  }

  event.preventDefault();
  insertAtSelection(text);
};

watch(
  () => props.modelValue,
  async () => {
    await nextTick();
    restoreSelection(pendingSelection.value);
    pendingSelection.value = null;
  }
);
</script>

<template>
  <div class="syntax-editor" :class="{ 'is-empty': modelValue.length === 0 }">
    <div
      ref="editor"
      class="syntax-editor__surface"
      role="textbox"
      aria-multiline="true"
      contenteditable="plaintext-only"
      :data-placeholder="placeholder"
      spellcheck="false"
      @beforeinput="handleBeforeInput"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @cut="handleCut"
      @drop="handleDrop"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
    >
      <SyntaxHighlightedContent :parts="highlightedParts" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.syntax-editor {
  position: relative;
  min-height: 11rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.syntax-editor__surface {
  min-height: 11rem;
  max-height: 18rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  overflow: auto;
  color: var(--gitpulse-text);
  caret-color: var(--gitpulse-accent);
  font-family: var(--gitpulse-code-font-family, monospace);
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  tab-size: 2;
  outline: none;
}

.syntax-editor.is-empty .syntax-editor__surface::before {
  content: attr(data-placeholder);
  color: var(--gitpulse-text-subtle);
  pointer-events: none;
}

:deep(.syntax-token--term) {
  color: var(--gitpulse-text);
}

:deep(.syntax-token--phrase) {
  color: var(--gitpulse-success);
}

:deep(.syntax-token--regex) {
  color: var(--gitpulse-warning);
}

:deep(.syntax-token--operator) {
  color: var(--gitpulse-purple);
  font-weight: 750;
}

:deep(.syntax-token--qualifier-name) {
  color: var(--gitpulse-accent);
  font-weight: 700;
}

:deep(.syntax-token--qualifier-colon) {
  color: var(--gitpulse-text-subtle);
}

:deep(.syntax-token--qualifier-value) {
  color: var(--gitpulse-info);
}

:deep(.syntax-token--paren),
:deep(.syntax-token--negation) {
  color: var(--gitpulse-text-muted);
  font-weight: 750;
}

:deep(.syntax-token--error) {
  color: var(--gitpulse-danger);
  text-decoration: underline wavy var(--gitpulse-danger);
}
</style>
