<script setup lang="ts">
import type { ComarkNode } from 'comark';
import { CheckIcon, ClipboardIcon } from 'lucide-vue-next';
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue';
import type { StyleValue } from 'vue';

const props = defineProps<{
  code?: string;
  language?: string | null;
  filename?: string | null;
  highlights?: number[];
  meta?: string | null;
  class?: string | null;
  style?: StyleValue;
  __node?: ComarkNode;
}>();

const { t } = useI18n();

const copied = shallowRef(false);
const resetTimer = shallowRef<ReturnType<typeof setTimeout> | null>(null);
const languageLabel = computed(() => props.language?.trim() ?? '');
const copyLabel = computed(() => (copied.value ? t('markdown.copied') : t('markdown.copyCode')));
const codeText = computed(() => props.code ?? extractCodeText(props.__node) ?? '');
const AsyncMermaidBlock = defineAsyncComponent(() => import('~/components/ui/MermaidBlock.vue'));

function extractCodeText(node: ComarkNode | undefined): string | null {
  if (!Array.isArray(node)) {
    return null;
  }

  const codeNode = node
    .slice(2)
    .find(
      (child): child is [string, Record<string, unknown>, ...ComarkNode[]] =>
        Array.isArray(child) && child[0] === 'code'
    );

  if (!codeNode) {
    return null;
  }

  return collectText(codeNode.slice(2));
}

function collectText(nodes: unknown[]): string {
  return nodes
    .map((node) => {
      if (typeof node === 'string') {
        return node;
      }

      if (!Array.isArray(node)) {
        return '';
      }

      return collectText(node.slice(2));
    })
    .join('');
}

function clearResetTimer() {
  if (!resetTimer.value) {
    return;
  }

  clearTimeout(resetTimer.value);
  resetTimer.value = null;
}

async function copyCode() {
  clearResetTimer();
  copied.value = false;

  try {
    await navigator.clipboard.writeText(codeText.value);
    copied.value = true;
    resetTimer.value = setTimeout(() => {
      copied.value = false;
      resetTimer.value = null;
    }, 1500);
  } catch {
    copied.value = false;
  }
}

onBeforeUnmount(clearResetTimer);
</script>

<template>
  <AsyncMermaidBlock v-if="props.language === 'mermaid'" :code="codeText" />
  <div v-else class="markdown-code-block">
    <div class="markdown-code-block__header">
      <span v-if="languageLabel" class="markdown-code-block__language" :title="languageLabel">
        {{ languageLabel }}
      </span>
      <span v-else class="markdown-code-block__language-spacer" />

      <button
        class="markdown-code-block__copy"
        type="button"
        :aria-label="copyLabel"
        @click="copyCode"
      >
        <CheckIcon v-if="copied" :size="14" aria-hidden="true" />
        <ClipboardIcon v-else :size="14" aria-hidden="true" />
        <span class="markdown-code-block__copy-text">{{ copyLabel }}</span>
      </button>
    </div>

    <pre :class="props.class" :style="props.style" tabindex="0"><slot /></pre>
  </div>
</template>

<style scoped lang="scss">
.markdown-code-block {
  overflow: hidden;
  margin: 1rem 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background-color: var(--gitpulse-code-bg);
}

.markdown-code-block__header {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.markdown-code-block__language,
.markdown-code-block__language-spacer {
  min-width: 0;
  flex: 1 1 auto;
}

.markdown-code-block__language {
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.75rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-code-block__copy {
  display: inline-flex;
  width: 5.75rem;
  min-height: 1.5rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background-color: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.markdown-code-block__copy:hover {
  border-color: var(--gitpulse-border-strong);
  background-color: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.markdown-code-block__copy:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

.markdown-code-block__copy-text {
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-code-block :deep(pre) {
  overflow-x: auto;
  margin: 0;
  border: 0;
  border-radius: 0;
  background-color: var(--shiki-light-bg, var(--gitpulse-code-bg));
}

.markdown-code-block :deep(code) {
  white-space: pre;
}

.markdown-code-block :deep(.line) {
  display: inline-block;
  min-width: 100%;
}

.markdown-code-block :deep(.line.highlight) {
  background-color: rgba(9, 105, 218, 0.12);
}

html.dark .markdown-code-block :deep(.shiki) {
  background-color: var(--shiki-dark-bg, var(--gitpulse-code-bg)) !important;
  color: var(--shiki-dark, var(--gitpulse-text)) !important;
}

html.dark .markdown-code-block :deep(.shiki span) {
  color: var(--shiki-dark) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
</style>
