<script setup lang="ts">
import { MinusIcon, PlusIcon, XIcon } from '@lucide/vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue';

import ScrollArea from '~/components/ui/ScrollArea.vue';

const { code } = defineProps<{
  code: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const colorMode = useColorMode();

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const ZOOM_WHEEL_STEP = 0.1;
const ZOOM_WHEEL_FINE_STEP = 0.04;
const MIN_INITIAL_ZOOM = 0.75;
// Floating chrome the fitted diagram has to clear: the close control above and
// the zoom capsule with the hint below.
const FIT_INSET_X = 40;
const FIT_INSET_TOP = 64;
const FIT_INSET_BOTTOM = 96;

type RenderState = { kind: 'loading' } | { kind: 'success'; svg: string } | { kind: 'fallback' };
type Point = { x: number; y: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};
type PinchState = {
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startMidX: number;
  startMidY: number;
};

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const viewport = useTemplateRef<HTMLElement>('viewport');
const diagram = useTemplateRef<HTMLElement>('diagram');
const modalCard = useTemplateRef<HTMLElement>('modalCard');
const focusTrap = createFocusTrapController();
const renderState = shallowRef<RenderState>({ kind: 'loading' });
const zoom = shallowRef(1);
const panX = shallowRef(0);
const panY = shallowRef(0);
const fitZoom = shallowRef(1);
const isViewportReady = shallowRef(false);
const diagramWidth = shallowRef(0);
const diagramHeight = shallowRef(0);
const dragState = shallowRef<DragState | null>(null);
const pinchState = shallowRef<PinchState | null>(null);
const hasOpenedModal = shallowRef(false);
const hasRequestedClose = shallowRef(false);

const activePointers = new Map<number, Point>();

let panFrameId: number | null = null;
let pendingPan: { x: number; y: number } | null = null;

const instanceId = useId().replace(/[^a-zA-Z0-9-]/g, '-');
const titleId = `diagram-overlay-title-${instanceId}`;
const renderCount = shallowRef(0);

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`);
const canZoomIn = computed(() => zoom.value < MAX_ZOOM);
const canZoomOut = computed(() => zoom.value > MIN_ZOOM);
const isGrabbing = computed(() => dragState.value !== null || pinchState.value !== null);
const transformStyle = computed(() => ({
  visibility: isViewportReady.value ? ('visible' as const) : ('hidden' as const),
  transition: isViewportReady.value ? undefined : 'none',
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
  const availableWidth = Math.max(viewportRect.width - FIT_INSET_X * 2, 1);
  const availableHeight = Math.max(viewportRect.height - FIT_INSET_TOP - FIT_INSET_BOTTOM, 1);

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
  if (panFrameId !== null) {
    cancelAnimationFrame(panFrameId);
    panFrameId = null;
  }
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
  zoom.value = Math.max(fitZoom.value, MIN_INITIAL_ZOOM);
  const rect = viewport.value!.getBoundingClientRect();
  panX.value = Math.max(0, (diagramWidth.value * zoom.value - rect.width) / 2 + FIT_INSET_X);
  panY.value = Math.max(0, (diagramHeight.value * zoom.value - rect.height) / 2 + FIT_INSET_TOP);
  clampPan();
  // Commit the measured transform to layout without a transition before revealing the SVG.
  await nextTick();
  diagram.value?.getBoundingClientRect();
  isViewportReady.value = true;
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
    return;
  }

  if (modalCard.value) {
    focusTrap.trapTabKey(event, modalCard.value);
  }
}

function onResize() {
  measureDiagram();
  clampPan();
}

async function renderDiagram() {
  if (!import.meta.client) return;

  renderState.value = { kind: 'loading' };
  isViewportReady.value = false;
  renderCount.value += 1;
  const currentRenderCount = renderCount.value;

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: colorMode.value === 'dark' ? 'dark' : 'default',
    });
    await mermaid.parse(code);

    const renderId = `mermaid-overlay-${instanceId}-${renderCount.value}`;
    const { svg } = await mermaid.render(renderId, code);
    if (currentRenderCount !== renderCount.value) return;

    renderState.value = { kind: 'success', svg };
    await resetViewportAfterRender();
  } catch {
    if (currentRenderCount !== renderCount.value) return;

    renderState.value = { kind: 'fallback' };
  }
}

function pointerDistance(first: Point, second: Point) {
  return Math.max(Math.hypot(first.x - second.x, first.y - second.y), 1);
}

function pointerPair(): [Point, Point] | null {
  const [first, second] = [...activePointers.values()];
  return first && second ? [first, second] : null;
}

/** A client point in viewport-centre coordinates, the frame zooming and panning are anchored to. */
function viewportPointFromCenter(clientX: number, clientY: number) {
  const rect = viewport.value?.getBoundingClientRect();

  if (!rect) return { x: clientX, y: clientY };

  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

function createPinchState(pair: [Point, Point]): PinchState {
  const [first, second] = pair;
  const midpoint = viewportPointFromCenter((first.x + second.x) / 2, (first.y + second.y) / 2);

  return {
    startDistance: pointerDistance(first, second),
    startZoom: zoom.value,
    startPanX: panX.value,
    startPanY: panY.value,
    startMidX: midpoint.x,
    startMidY: midpoint.y,
  };
}

function beginDrag(pointerId: number, point: Point) {
  dragState.value = {
    pointerId,
    startX: point.x,
    startY: point.y,
    originX: panX.value,
    originY: panY.value,
  };
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const point = { x: event.clientX, y: event.clientY };
  activePointers.set(event.pointerId, point);
  viewport.value?.setPointerCapture?.(event.pointerId);

  if (activePointers.size === 1) {
    beginDrag(event.pointerId, point);
    return;
  }

  const pair = pointerPair();
  if (pair) {
    // A pan may still be queued for the next frame; settle it before anchoring, or the
    // diagram moves out from under the fingers the moment the second one lands.
    flushPendingPan();
    dragState.value = null;
    pinchState.value = createPinchState(pair);
  }
}

function onPointerMove(event: PointerEvent) {
  if (!activePointers.has(event.pointerId)) return;

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  const pinch = pinchState.value;
  const pair = pointerPair();

  if (pinch && pair) {
    const [first, second] = pair;
    const nextZoom = clamp(
      Number((pinch.startZoom * (pointerDistance(first, second) / pinch.startDistance)).toFixed(3)),
      MIN_ZOOM,
      MAX_ZOOM
    );
    const midpoint = viewportPointFromCenter((first.x + second.x) / 2, (first.y + second.y) / 2);
    const ratio = nextZoom / pinch.startZoom;

    zoom.value = nextZoom;
    schedulePan(
      midpoint.x - (pinch.startMidX - pinch.startPanX) * ratio,
      midpoint.y - (pinch.startMidY - pinch.startPanY) * ratio
    );
    return;
  }

  const drag = dragState.value;
  if (!drag || drag.pointerId !== event.pointerId) return;

  schedulePan(
    drag.originX + event.clientX - drag.startX,
    drag.originY + event.clientY - drag.startY
  );
}

function onPointerEnd(event: PointerEvent) {
  activePointers.delete(event.pointerId);

  if (viewport.value?.hasPointerCapture?.(event.pointerId)) {
    viewport.value.releasePointerCapture(event.pointerId);
  }

  flushPendingPan();

  if (activePointers.size >= 2) {
    // A third finger may have left the anchored pair; re-anchor on the remaining two.
    const pair = pointerPair();
    pinchState.value = pair ? createPinchState(pair) : null;
    dragState.value = null;
    return;
  }

  pinchState.value = null;

  if (activePointers.size === 0) {
    dragState.value = null;
    return;
  }

  const remaining = [...activePointers.entries()][0];
  if (remaining) {
    const [pointerId, point] = remaining;
    beginDrag(pointerId, point);
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault();

  const oldZoom = zoom.value;
  const direction = event.deltaY > 0 ? -1 : 1;
  const step = event.ctrlKey || event.metaKey ? ZOOM_WHEEL_FINE_STEP : ZOOM_WHEEL_STEP;
  const newZoom = clamp(Number((oldZoom + direction * step).toFixed(3)), MIN_ZOOM, MAX_ZOOM);
  if (newZoom === oldZoom) return;

  zoom.value = newZoom;

  if (viewport.value) {
    const cursor = viewportPointFromCenter(event.clientX, event.clientY);
    const ratio = newZoom / oldZoom;
    clampPan(
      cursor.x + (panX.value - cursor.x) * ratio,
      cursor.y + (panY.value - cursor.y) * ratio
    );
  } else {
    clampPan();
  }
}

onMounted(async () => {
  openModal();
  hasOpenedModal.value = true;
  focusTrap.capturePreviousFocus();
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
  await nextTick();
  closeButton.value?.focus();
  await renderDiagram();
});

watch(
  () => colorMode.value,
  () => {
    void renderDiagram();
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
  cancelPendingPan();
  dragState.value = null;
  pinchState.value = null;
  activePointers.clear();
  focusTrap.restorePreviousFocus();

  if (hasOpenedModal.value) {
    closeModal();
    hasOpenedModal.value = false;
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="modalCard"
      class="diagram-overlay"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <h2 :id="titleId" class="diagram-overlay__sr-only">
        {{ t('markdown.mermaid.title') }}
      </h2>

      <div
        ref="viewport"
        class="diagram-overlay__viewport"
        :class="{ 'diagram-overlay__viewport--grabbing': isGrabbing }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @wheel.prevent="onWheel"
      >
        <div v-if="renderState.kind === 'loading'" class="diagram-overlay__skeleton" />
        <!-- v-html: SVG comes from Mermaid with securityLevel: 'strict'. -->
        <div
          v-else-if="renderState.kind === 'success'"
          ref="diagram"
          class="diagram-overlay__diagram"
          :style="transformStyle"
          v-html="renderState.svg"
        />
        <ScrollArea v-else class="diagram-overlay__fallback" axis="both">
          <pre class="diagram-overlay__fallback-text"><code>{{ code }}</code></pre>
        </ScrollArea>
      </div>

      <button
        ref="closeButton"
        class="diagram-overlay__close"
        type="button"
        :aria-label="t('markdown.mermaid.close')"
        @click="requestClose"
      >
        <XIcon :size="18" aria-hidden="true" />
      </button>

      <div class="diagram-overlay__zoom">
        <button
          class="diagram-overlay__zoom-button"
          type="button"
          :aria-label="t('markdown.mermaid.zoomOut')"
          :disabled="!canZoomOut"
          @click="changeZoom(-ZOOM_STEP)"
        >
          <MinusIcon :size="16" aria-hidden="true" />
        </button>

        <button
          class="diagram-overlay__zoom-readout"
          type="button"
          :aria-label="`${t('markdown.mermaid.fit')} (${zoomPercent})`"
          :title="t('markdown.mermaid.fit')"
          @click="resetViewport"
        >
          {{ zoomPercent }}
        </button>

        <button
          class="diagram-overlay__zoom-button"
          type="button"
          :aria-label="t('markdown.mermaid.zoomIn')"
          :disabled="!canZoomIn"
          @click="changeZoom(ZOOM_STEP)"
        >
          <PlusIcon :size="16" aria-hidden="true" />
        </button>
      </div>

      <p class="diagram-overlay__hint">{{ t('markdown.mermaid.hint') }}</p>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

/* Teleported to body, so this sits above the Detail Overlay frame (9999). */
.diagram-overlay {
  position: fixed;
  z-index: 99999;
  inset: 0;
  overflow: hidden;
  background-color: var(--gitpulse-surface);
  animation: diagram-overlay-enter 140ms ease-out;
}

.diagram-overlay__viewport {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
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

.diagram-overlay__viewport--grabbing {
  cursor: grabbing;
}

.diagram-overlay__diagram {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  transition: transform 120ms ease;
  will-change: transform;
}

.diagram-overlay__viewport--grabbing .diagram-overlay__diagram {
  transition: none;
}

.diagram-overlay__diagram :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

/* For assistive technology only: the dialog's name and the zoom readout's action. */
.diagram-overlay__sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.diagram-overlay__skeleton {
  width: min(520px, 70%);
  min-height: 220px;
  border-radius: 6px;
  background: var(--gitpulse-skeleton-shimmer);
  background-size: 200% 100%;
  animation: diagram-overlay-loading 1.2s linear infinite;
}

.diagram-overlay__fallback {
  width: min(760px, calc(100% - 48px));
  max-height: calc(100% - 120px);
  padding: 1.5rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.diagram-overlay__close {
  position: absolute;
  z-index: 2;
  top: 16px;
  right: 16px;
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--gitpulse-surface) 88%, transparent);
  backdrop-filter: blur(10px);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

@include hover-only {
  .diagram-overlay__close:hover {
    border-color: var(--gitpulse-border-strong);
    background-color: var(--gitpulse-surface);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }
}

.diagram-overlay__close:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.diagram-overlay__zoom {
  position: absolute;
  z-index: 2;
  bottom: 20px;
  left: 50%;
  display: inline-flex;
  height: 40px;
  align-items: center;
  padding: 0 2px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--gitpulse-surface) 88%, transparent);
  box-shadow: var(--gitpulse-shadow-card);
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
}

/* Hairline segment separators inside the one capsule. */
.diagram-overlay__zoom > * + * {
  position: relative;
}

.diagram-overlay__zoom > * + *::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 1px;
  height: 16px;
  background-color: var(--gitpulse-border);
  content: '';
  transform: translateY(-50%);
}

.diagram-overlay__zoom-button {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background-color: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

@include hover-only {
  .diagram-overlay__zoom-button:hover:not(:disabled) {
    background-color: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }
}

.diagram-overlay__zoom-button:focus-visible,
.diagram-overlay__zoom-readout:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: -2px;
}

.diagram-overlay__zoom-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.diagram-overlay__zoom-readout {
  display: inline-flex;
  min-width: 56px;
  height: 38px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
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

@include hover-only {
  .diagram-overlay__zoom-readout:hover {
    background-color: var(--gitpulse-surface-hover);
  }
}

.diagram-overlay__hint {
  position: absolute;
  z-index: 2;
  bottom: 20px;
  left: 20px;
  margin: 0;
  color: var(--bulma-text, var(--gitpulse-text));
  font-size: 0.8125rem;
  line-height: 1.2;
  pointer-events: none;
}

@keyframes diagram-overlay-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes diagram-overlay-loading {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .diagram-overlay {
    animation: none;
  }
}

@media (max-width: 640px) {
  .diagram-overlay__close {
    top: 12px;
    right: 12px;
  }

  .diagram-overlay__zoom {
    bottom: 16px;
  }

  .diagram-overlay__hint {
    right: 16px;
    bottom: calc(16px + 40px + 10px);
    left: 16px;
    text-align: center;
  }

  .diagram-overlay__fallback {
    width: calc(100% - 32px);
  }
}
:deep(.diagram-overlay__fallback-text) {
  overflow: visible;
  margin: 0;
  padding: 0;
  list-style: none;
  background: transparent;
  color: inherit;
  font: inherit;
}
</style>
