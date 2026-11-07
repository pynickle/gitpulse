<script setup lang="ts">
import { Maximize2Icon } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue';

import { estimateMermaidPreviewHeight } from '#shared/utils/mermaid-preview-height';
import DiagramOverlay from '~/components/ui/DiagramOverlay.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';

const { code } = defineProps<{
  code: string;
}>();

const { t } = useI18n();
const colorMode = useColorMode();

const MAX_SOURCE_BYTES = 16384;

type State = { kind: 'loading' } | { kind: 'success'; svg: string } | { kind: 'fallback' };

const state = shallowRef<State>({ kind: 'loading' });
const isOverlayOpen = shallowRef(false);
const openerElement = shallowRef<HTMLElement | null>(null);
const isNarrow = shallowRef(false);
let previewMedia: MediaQueryList;
const syncPreviewMedia = () => {
  isNarrow.value = previewMedia.matches;
};
let renderSequence = 0;

// useId() is Vue 3.5+ — generates a stable, unique id per component instance.
const instanceId = useId();
const renderId = `mermaid-${instanceId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
const previewStyle = computed(() => ({
  '--mermaid-preview-height': `${estimateMermaidPreviewHeight(code)}px`,
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

function openOverlay(event: MouseEvent) {
  openerElement.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  isOverlayOpen.value = true;
}

async function closeOverlay() {
  isOverlayOpen.value = false;
  await nextTick();
  openerElement.value?.focus();
  openerElement.value = null;
}

onMounted(() => {
  previewMedia = window.matchMedia('(max-width: 640px)');
  syncPreviewMedia();
  previewMedia.addEventListener('change', syncPreviewMedia);
  void render(code);
});
onBeforeUnmount(() => previewMedia?.removeEventListener('change', syncPreviewMedia));
watch(
  () => [code, colorMode.value] as const,
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
            :aria-label="t('markdown.mermaid.open')"
            :title="t('markdown.mermaid.open')"
            @click="openOverlay"
          >
            <Maximize2Icon :size="14" aria-hidden="true" />
            <span>{{ t('markdown.mermaid.open') }}</span>
          </button>

          <!-- v-html: SVG comes from Mermaid with securityLevel: 'strict'. -->
          <ScrollArea class="mermaid-output" axis="both">
            <component
              :is="isNarrow ? 'button' : 'div'"
              class="mermaid-preview"
              :type="isNarrow ? 'button' : undefined"
              :aria-label="isNarrow ? t('markdown.mermaid.open') : undefined"
              @click="isNarrow && openOverlay($event)"
              v-html="state.svg"
            />
          </ScrollArea>
        </template>
      </div>

      <DiagramOverlay
        v-if="state.kind === 'success' && isOverlayOpen"
        :code="code"
        @close="closeOverlay"
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
  /* Inset clear of the preview's overlay scrollbars, keeping the top and right
     gaps equal. */
  top: 1rem;
  right: 1rem;
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
  max-height: min(480px, 60dvh);
  padding: 1rem;
}

.mermaid-preview {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: inherit;
}

.mermaid-preview:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

.mermaid-output :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .mermaid-block__open {
    display: none;
  }

  .mermaid-preview {
    cursor: pointer;
  }
}
</style>
