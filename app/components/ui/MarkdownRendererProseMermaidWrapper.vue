<script setup lang="ts">
/**
 * Wraps mdc's default ProsePre for block-level fenced code blocks.
 *
 * When the fenced block's `language` prop equals "mermaid", render MermaidBlock
 * (client-side lazy SVG renderer).  For all other languages, delegate to mdc's
 * default ProsePre so Shiki-highlighted HTML is rendered unchanged.
 *
 * We override the `pre` key in MDCRenderer's `components` map (not `code`),
 * so inline backtick `mermaid` code spans are never intercepted here.
 */
import ProsePre from '@nuxtjs/mdc/dist/runtime/components/prose/ProsePre.vue';
import { Check, Clipboard } from 'lucide-vue-next';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import MermaidBlock from '~/components/ui/MermaidBlock.vue';

const props = defineProps<{
  code?: string;
  language?: string | null;
  filename?: string | null;
  highlights?: number[];
  meta?: string | null;
  class?: string | null;
}>();

const { t } = useI18n();

const copied = shallowRef(false);
const resetTimer = shallowRef<ReturnType<typeof setTimeout> | null>(null);
const languageLabel = computed(() => props.language?.trim() ?? '');
const copyLabel = computed(() => (copied.value ? t('markdown.copied') : t('markdown.copyCode')));

const prosePreProps = computed(() => ({
  code: props.code,
  language: props.language ?? undefined,
  filename: props.filename ?? undefined,
  highlights: props.highlights,
  meta: props.meta ?? undefined,
  class: props.class ?? undefined,
}));

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
    await navigator.clipboard.writeText(props.code ?? '');
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
  <MermaidBlock v-if="props.language === 'mermaid'" :code="props.code ?? ''" />
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
        <Check v-if="copied" :size="14" aria-hidden="true" />
        <Clipboard v-else :size="14" aria-hidden="true" />
        <span class="markdown-code-block__copy-text">{{ copyLabel }}</span>
      </button>
    </div>

    <ProsePre v-bind="prosePreProps"><slot /></ProsePre>
  </div>
</template>

<style scoped lang="scss">
.markdown-code-block {
  overflow: hidden;
  margin: 1rem 0;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background-color: #f6f8fa;
}

.markdown-code-block__header {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  border-bottom: 1px solid #d0d7de;
}

.markdown-code-block__language,
.markdown-code-block__language-spacer {
  min-width: 0;
  flex: 1 1 auto;
}

.markdown-code-block__language {
  overflow: hidden;
  color: #57606a;
  font-family:
    ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
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
  color: #57606a;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.markdown-code-block__copy:hover {
  border-color: #d0d7de;
  background-color: #ffffff;
  color: #24292f;
}

.markdown-code-block__copy:focus-visible {
  outline: 2px solid #0969da;
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
}

.markdown-code-block :deep(code) {
  white-space: pre;
}
</style>
