<script setup lang="ts">
import { Minus, Plus, RotateCcw, X } from 'lucide-vue-next';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
} from 'vue';

const props = defineProps<{
  code: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const ZOOM_WHEEL_STEP = 0.1;
const ZOOM_WHEEL_FINE_STEP = 0.04;

type RenderState = { kind: 'loading' } | { kind: 'success'; svg: string } | { kind: 'fallback' };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const viewport = useTemplateRef<HTMLElement>('viewport');
const diagram = useTemplateRef<HTMLElement>('diagram');
const renderState = shallowRef<RenderState>({ kind: 'loading' });
const zoom = shallowRef(1);
const panX = shallowRef(0);
const panY = shallowRef(0);
const fitZoom = shallowRef(1);
const diagramWidth = shallowRef(0);
const diagramHeight = shallowRef(0);
const dragState = shallowRef<DragState | null>(null);
const hasOpenedModal = shallowRef(false);
const hasRequestedClose = shallowRef(false);

let panFrameId: number | null = null;
let pendingPan: { x: number; y: number } | null = null;

const instanceId = useId().replace(/[^a-zA-Z0-9-]/g, '-');
const renderCount = shallowRef(0);

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`);
const canZoomIn = computed(() => zoom.value < MAX_ZOOM);
const canZoomOut = computed(() => zoom.value > MIN_ZOOM);
const isDragging = computed(() => dragState.value !== null);
const transformStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  width: diagramWidth.value > 0 ? `${diagramWidth.value}px` : undefined,
  height: diagramHeight.value > 0 ? `${diagramHeight.value}px` : undefined,
}));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resetViewport() {
  zoom.value = fitZoom.value;
  panX.value = 0;
  panY.value = 0;
}

function readSvgSize(svgElement: SVGSVGElement) {
  const viewBox = svgElement.viewBox.baseVal;

  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const widthAttribute = svgElement.getAttribute('width') ?? '';
  const heightAttribute = svgElement.getAttribute('height') ?? '';
  const width = /^[\d.]+$/.test(widthAttribute) ? Number.parseFloat(widthAttribute) : Number.NaN;
  const height = /^[\d.]+$/.test(heightAttribute) ? Number.parseFloat(heightAttribute) : Number.NaN;

  if (width > 0 && height > 0) {
    return { width, height };
  }

  const rect = svgElement.getBoundingClientRect();
  return {
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  };
}

function measureDiagram() {
  const viewportElement = viewport.value;
  const svgElement = diagram.value?.querySelector('svg');

  if (!viewportElement || !(svgElement instanceof SVGSVGElement)) {
    fitZoom.value = 1;
    diagramWidth.value = 0;
    diagramHeight.value = 0;
    return;
  }

  const viewportRect = viewportElement.getBoundingClientRect();
  const svgSize = readSvgSize(svgElement);
  const availableWidth = Math.max(viewportRect.width - 32, 1);
  const availableHeight = Math.max(viewportRect.height - 32, 1);

  diagramWidth.value = svgSize.width;
  diagramHeight.value = svgSize.height;
  fitZoom.value = clamp(
    Math.min(availableWidth / svgSize.width, availableHeight / svgSize.height, 1),
    MIN_ZOOM,
    MAX_ZOOM
  );
}

function getPanBounds() {
  const viewportElement = viewport.value;

  if (!viewportElement || diagramWidth.value <= 0 || diagramHeight.value <= 0) {
    return { x: 0, y: 0 };
  }

  const viewportRect = viewportElement.getBoundingClientRect();
  const scaledWidth = diagramWidth.value * zoom.value;
  const scaledHeight = diagramHeight.value * zoom.value;
  const safeVisibleWidth = Math.min(120, viewportRect.width * 0.35);
  const safeVisibleHeight = Math.min(120, viewportRect.height * 0.35);
  const maxX =
    scaledWidth <= viewportRect.width
      ? 0
      : Math.max(0, (scaledWidth + viewportRect.width) / 2 - safeVisibleWidth);
  const maxY =
    scaledHeight <= viewportRect.height
      ? 0
      : Math.max(0, (scaledHeight + viewportRect.height) / 2 - safeVisibleHeight);

  return { x: maxX, y: maxY };
}

function clampPan(x = panX.value, y = panY.value) {
  const bounds = getPanBounds();
  panX.value = clamp(x, -bounds.x, bounds.x);
  panY.value = clamp(y, -bounds.y, bounds.y);
}

function flushPendingPan() {
  panFrameId = null;
  if (pendingPan) {
    clampPan(pendingPan.x, pendingPan.y);
    pendingPan = null;
  }
}

function schedulePan(x: number, y: number) {
  pendingPan = { x, y };
  if (panFrameId === null) {
    panFrameId = requestAnimationFrame(flushPendingPan);
  }
}

function cancelPendingPan() {
  if (panFrameId !== null) {
    cancelAnimationFrame(panFrameId);
    panFrameId = null;
  }
  pendingPan = null;
}

async function resetViewportAfterRender() {
  await nextTick();
  measureDiagram();
  resetViewport();
  clampPan();
}

function changeZoom(delta: number) {
  zoom.value = clamp(Number((zoom.value + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
  void nextTick(() => clampPan());
}

function requestClose() {
  if (hasRequestedClose.value) return;

  hasRequestedClose.value = true;
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    requestClose();
  }
}

function onResize() {
  measureDiagram();
  clampPan();
}

async function renderDiagram() {
  if (!import.meta.client) return;

  renderState.value = { kind: 'loading' };
  renderCount.value += 1;

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    await mermaid.parse(props.code);

    const renderId = `mermaid-viewer-${instanceId}-${renderCount.value}`;
    const { svg } = await mermaid.render(renderId, props.code);
    renderState.value = { kind: 'success', svg };
    await resetViewportAfterRender();
  } catch {
    renderState.value = { kind: 'fallback' };
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;

  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: panX.value,
    originY: panY.value,
  };
  viewport.value?.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  const drag = dragState.value;
  if (!drag || drag.pointerId !== event.pointerId) return;

  schedulePan(
    drag.originX + event.clientX - drag.startX,
    drag.originY + event.clientY - drag.startY
  );
}

function stopDragging(event?: PointerEvent) {
  const drag = dragState.value;
  if (!drag) return;

  if (pendingPan) {
    clampPan(pendingPan.x, pendingPan.y);
  }
  cancelPendingPan();

  if (event && viewport.value?.hasPointerCapture?.(drag.pointerId)) {
    viewport.value.releasePointerCapture(drag.pointerId);
  }

  dragState.value = null;
}

function onWheel(event: WheelEvent) {
  event.preventDefault();

  const oldZoom = zoom.value;
  const direction = event.deltaY > 0 ? -1 : 1;
  const step = event.ctrlKey || event.metaKey ? ZOOM_WHEEL_FINE_STEP : ZOOM_WHEEL_STEP;
  const newZoom = clamp(Number((oldZoom + direction * step).toFixed(3)), MIN_ZOOM, MAX_ZOOM);
  if (newZoom === oldZoom) return;

  const viewportElement = viewport.value;
  zoom.value = newZoom;

  if (viewportElement) {
    const rect = viewportElement.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - rect.width / 2;
    const cursorY = event.clientY - rect.top - rect.height / 2;
    const ratio = newZoom / oldZoom;
    clampPan(cursorX + (panX.value - cursorX) * ratio, cursorY + (panY.value - cursorY) * ratio);
  } else {
    clampPan();
  }
}

onMounted(async () => {
  openModal();
  hasOpenedModal.value = true;
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
  await nextTick();
  closeButton.value?.focus();
  await renderDiagram();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
  cancelPendingPan();
  dragState.value = null;

  if (hasOpenedModal.value) {
    closeModal();
    hasOpenedModal.value = false;
  }
});
</script>

<template>
  <div class="modal mermaid-viewer-modal is-active" role="dialog" aria-modal="true">
    <div class="modal-background" @click="requestClose" />
    <div class="modal-card mermaid-viewer-modal__card">
      <header class="modal-card-head mermaid-viewer-modal__head">
        <p class="modal-card-title mermaid-viewer-modal__title">
          {{ t('markdown.mermaid.title') }}
        </p>

        <button
          ref="closeButton"
          class="delete"
          type="button"
          :aria-label="t('markdown.mermaid.close')"
          @click="requestClose"
        />
      </header>

      <section class="modal-card-body mermaid-viewer-modal__body">
        <div
          ref="viewport"
          class="mermaid-viewer-modal__viewport"
          :class="{ 'mermaid-viewer-modal__viewport--dragging': isDragging }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="stopDragging"
          @pointercancel="stopDragging"
          @wheel.prevent="onWheel"
          @click.stop
        >
          <div v-if="renderState.kind === 'loading'" class="mermaid-viewer-modal__skeleton" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-else-if="renderState.kind === 'success'"
            ref="diagram"
            class="mermaid-viewer-modal__diagram"
            :style="transformStyle"
            v-html="renderState.svg"
          />
          <pre v-else class="mermaid-viewer-modal__fallback"><code>{{ props.code }}</code></pre>
        </div>
      </section>

      <footer class="modal-card-foot mermaid-viewer-modal__foot">
        <div class="mermaid-viewer-modal__zoom-cluster">
          <button
            class="button is-small mermaid-viewer-modal__icon-button"
            type="button"
            :aria-label="t('markdown.mermaid.zoomOut')"
            :disabled="!canZoomOut"
            @click="changeZoom(-ZOOM_STEP)"
          >
            <Minus :size="16" aria-hidden="true" />
          </button>

          <button
            class="mermaid-viewer-modal__zoom-readout"
            type="button"
            :aria-label="t('markdown.mermaid.reset')"
            :title="t('markdown.mermaid.reset')"
            @click="resetViewport"
          >
            {{ zoomPercent }}
          </button>

          <button
            class="button is-small mermaid-viewer-modal__icon-button"
            type="button"
            :aria-label="t('markdown.mermaid.zoomIn')"
            :disabled="!canZoomIn"
            @click="changeZoom(ZOOM_STEP)"
          >
            <Plus :size="16" aria-hidden="true" />
          </button>

          <button
            class="button is-small mermaid-viewer-modal__icon-button"
            type="button"
            :aria-label="t('markdown.mermaid.reset')"
            :title="t('markdown.mermaid.reset')"
            @click="resetViewport"
          >
            <RotateCcw :size="16" aria-hidden="true" />
          </button>
        </div>

        <p class="mermaid-viewer-modal__hint">{{ t('markdown.mermaid.hint') }}</p>

        <button
          class="button is-small mermaid-viewer-modal__close"
          type="button"
          @click="requestClose"
        >
          <X :size="16" aria-hidden="true" />
          <span>{{ t('markdown.mermaid.close') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mermaid-viewer-modal {
  z-index: 60;
}

.mermaid-viewer-modal__card {
  width: min(1120px, calc(100vw - 2rem));
  max-height: min(860px, calc(100vh - 2rem));
  box-shadow: var(--gitpulse-shadow-raised);
}

.mermaid-viewer-modal__head,
.mermaid-viewer-modal__foot {
  flex: 0 0 auto;
  gap: 0.75rem;
  background-color: var(--gitpulse-surface-muted);
}

.mermaid-viewer-modal__title {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.25;
}

.mermaid-viewer-modal__body {
  min-height: min(62vh, 640px);
  padding: 0;
  background-color: var(--gitpulse-surface);
}

.mermaid-viewer-modal__viewport {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: min(62vh, 640px);
  min-height: 320px;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(90deg, var(--gitpulse-grid-line) 1px, transparent 1px),
    linear-gradient(var(--gitpulse-grid-line) 1px, transparent 1px), var(--gitpulse-surface);
  background-size: 24px 24px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.mermaid-viewer-modal__viewport--dragging {
  cursor: grabbing;
}

.mermaid-viewer-modal__diagram {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  transition: transform 120ms ease;
  will-change: transform;
}

.mermaid-viewer-modal__viewport--dragging .mermaid-viewer-modal__diagram {
  transition: none;
}

.mermaid-viewer-modal__diagram :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.mermaid-viewer-modal__skeleton {
  width: min(520px, 70%);
  min-height: 220px;
  border-radius: 6px;
  background: var(--gitpulse-skeleton-shimmer);
  background-size: 200% 100%;
  animation: mermaid-viewer-loading 1.2s linear infinite;
}

.mermaid-viewer-modal__fallback {
  overflow: auto;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 1rem;
  background-color: var(--gitpulse-code-bg);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.mermaid-viewer-modal__foot {
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  gap: 0.75rem;
}

.mermaid-viewer-modal__zoom-cluster {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  padding: 0.125rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background-color: var(--gitpulse-surface);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--gitpulse-surface-raised) 80%, transparent);
}

.mermaid-viewer-modal__zoom-cluster .button {
  min-width: 2rem;
  height: 1.75rem;
  padding-inline: 0.5rem;
}

.mermaid-viewer-modal__icon-button {
  border-color: transparent;
  background-color: transparent;
  color: var(--gitpulse-text-muted);
  border-radius: 999px;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.mermaid-viewer-modal__icon-button:hover:not(:disabled),
.mermaid-viewer-modal__icon-button:focus-visible {
  background-color: var(--gitpulse-surface-hover);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.mermaid-viewer-modal__icon-button:disabled {
  opacity: 0.4;
}

.mermaid-viewer-modal__zoom-readout {
  display: inline-flex;
  min-width: 3.5rem;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 999px;
  background-color: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-feature-settings: 'tnum' 1;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.mermaid-viewer-modal__zoom-readout:hover,
.mermaid-viewer-modal__zoom-readout:focus-visible {
  background-color: var(--gitpulse-surface-hover);
}

.mermaid-viewer-modal__hint {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  text-align: center;
}

.mermaid-viewer-modal__close {
  margin-left: auto;
}

.mermaid-viewer-modal__foot .button:focus-visible,
.mermaid-viewer-modal__zoom-readout:focus-visible,
.mermaid-viewer-modal__head .delete:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

@keyframes mermaid-viewer-loading {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (max-width: 640px) {
  .mermaid-viewer-modal__card {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .mermaid-viewer-modal__head,
  .mermaid-viewer-modal__foot {
    padding: 0.625rem 0.75rem;
  }

  .mermaid-viewer-modal__body,
  .mermaid-viewer-modal__viewport {
    min-height: 300px;
    height: 58vh;
  }

  .mermaid-viewer-modal__hint {
    flex-basis: 100%;
    order: 3;
  }

  .mermaid-viewer-modal__close {
    order: 2;
  }
}
</style>
