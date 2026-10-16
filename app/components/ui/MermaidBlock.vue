<script setup lang="ts">
import { Maximize2Icon } from '@lucide/vue';
import { computed, nextTick, onMounted, shallowRef, useId, watch } from 'vue';

import { estimateMermaidPreviewHeight } from '#shared/utils/mermaid-preview-height';
import MermaidViewerModal from '~/components/ui/MermaidViewerModal.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';

const props = defineProps<{
  code: string;
}>();

const { t } = useI18n();
const colorMode = useColorMode();

const MAX_SOURCE_BYTES = 16384;

type State = { kind: 'loading' } | { kind: 'success'; svg: string } | { kind: 'fallback' };

const state = shallowRef<State>({ kind: 'loading' });
const isViewerOpen = shallowRef(false);
const openerElement = shallowRef<HTMLElement | null>(null);
let renderSequence = 0;

// useId() is Vue 3.5+ — generates a stable, unique id per component instance.
const instanceId = useId();
const renderId = `mermaid-${instanceId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
const previewStyle = computed(() => ({
  '--mermaid-preview-height': `${estimateMermaidPreviewHeight(props.code)}px`,
}));

async function render(code: string) {
  if (!import.meta.client) return;

  // 16 KB source guard — silently fall back for oversized diagrams.
  if (code.length > MAX_SOURCE_BYTES) {
    state.value = { kind: 'fallback' };
    return;
  }

  state.value = { kind: 'loading' };
  const currentRender = ++renderSequence;

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: colorMode.value === 'dark' ? 'dark' : 'default',
    });

    // Strict parse — throws on invalid syntax.
    await mermaid.parse(code);

    const { svg } = await mermaid.render(renderId, code);
    if (currentRender !== renderSequence) return;

    state.value = { kind: 'success', svg };
  } catch {
    if (currentRender !== renderSequence) return;

    // Silent fallback — never log Error to console per plan AC2.
    state.value = { kind: 'fallback' };
  }
}

function openViewer(event: MouseEvent) {
  openerElement.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  isViewerOpen.value = true;
}

async function closeViewer() {
  isViewerOpen.value = false;
  await nextTick();
  openerElement.value?.focus();
  openerElement.value = null;
}

onMounted(() => render(props.code));
watch(
  () => [props.code, colorMode.value] as const,
  ([code]) => render(code)
);
</script>

<template>
  <ClientOnly>
    <template v-if="state.kind === 'loading' || state.kind === 'success'">
      <div
        class="mermaid-block"
        :class="{ 'mermaid-block--loading': state.kind === 'loading' }"
        :style="previewStyle"
      >
        <div v-if="state.kind === 'loading'" class="mermaid-skeleton" />

        <!-- Successful SVG render — v-html, no DOMPurify overlay (securityLevel:'strict' is sufficient) -->
        <template v-else>
          <button
            class="mermaid-block__open button is-small"
            type="button"
            :aria-label="t('markdown.mermaid.openViewer')"
            :title="t('markdown.mermaid.openViewer')"
            @click="openViewer"
          >
            <Maximize2Icon :size="14" aria-hidden="true" />
            <span>{{ t('markdown.mermaid.openViewer') }}</span>
          </button>

          <!-- eslint-disable-next-line vue/no-v-html -->
          <ScrollArea class="mermaid-output" axis="both"><div v-html="state.svg" /></ScrollArea>
        </template>
      </div>

      <MermaidViewerModal
        v-if="state.kind === 'success' && isViewerOpen"
        :code="code"
        @close="closeViewer"
      />
    </template>

    <!-- Silent fallback for parse errors / oversized source -->
    <template v-else>
      <pre><code class="language-mermaid">{{ code }}</code></pre>
    </template>

    <!-- SSR slot: render raw code block until client hydrates -->
    <template #fallback>
      <pre><code class="language-mermaid">{{ code }}</code></pre>
    </template>
  </ClientOnly>
</template>

<style scoped lang="scss">
.mermaid-block {
  position: relative;
  overflow: hidden;
  margin: 1rem 0;
  min-height: min(var(--mermaid-preview-height), 70vh);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background-color: var(--gitpulse-markdown-bg);
}

.mermaid-skeleton {
  width: 100%;
  min-height: min(var(--mermaid-preview-height), 70vh);
  background-color: var(--gitpulse-skeleton-bg);
}

.mermaid-block__open {
  position: absolute;
  z-index: 1;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  max-width: calc(100% - 1rem);
  align-items: center;
  gap: 0.25rem;
  border-color: var(--gitpulse-border);
  background-color: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.75rem;
  line-height: 1;
  box-shadow: var(--gitpulse-shadow-card);
}

.mermaid-block__open span {
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mermaid-block__open:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

.mermaid-output {
  max-height: min(var(--mermaid-preview-height), 70vh);
  padding: 1rem;
}

.mermaid-output :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .mermaid-block__open {
    position: static;
    width: 100%;
    justify-content: center;
    border-width: 0 0 1px;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
