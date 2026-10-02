import {
  computed,
  onMounted,
  onScopeDispose,
  readonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';

export function useReleaseOverlaySheet(options: {
  open: MaybeRefOrGetter<boolean>;
  onRequestClose: () => void;
}) {
  const expanded = shallowRef(false);
  const dragging = shallowRef(false);
  const offsetY = shallowRef(0);
  let drag: { startY: number; pointerId: number; handle: HTMLElement } | null = null;
  let viewport: MediaQueryList | null = null;

  const panelStyle = computed(() => ({
    transform: offsetY.value > 0 ? `translateY(${offsetY.value}px)` : undefined,
    height: !expanded.value && offsetY.value < 0 ? `calc(70vh + ${-offsetY.value}px)` : undefined,
  }));

  const cancelDrag = () => {
    const previous = drag;
    drag = null;
    dragging.value = false;
    offsetY.value = 0;
    if (previous?.handle.hasPointerCapture(previous.pointerId)) {
      previous.handle.releasePointerCapture(previous.pointerId);
    }
  };
  const reset = () => {
    cancelDrag();
    expanded.value = false;
  };
  const handleViewportChange = () => {
    if (!viewport?.matches) reset();
  };

  onMounted(() => {
    viewport = window.matchMedia('(max-width: 860px)');
    viewport.addEventListener('change', handleViewportChange);
    watch(
      () => toValue(options.open),
      (open) => {
        if (!open) reset();
      },
      { flush: 'sync' }
    );
  });
  onScopeDispose(() => {
    viewport?.removeEventListener('change', handleViewportChange);
    reset();
  });

  const onPointerDown = (event: PointerEvent) => {
    if (!toValue(options.open) || event.button !== 0 || !viewport?.matches || drag) return;
    if (
      event.target instanceof Element &&
      event.target.closest('button, a[href], input, select, textarea')
    )
      return;
    const handle = event.currentTarget as HTMLElement;
    drag = { startY: event.clientY, pointerId: event.pointerId, handle };
    dragging.value = true;
    handle.setPointerCapture(event.pointerId);
  };
  const applyGesture = (event: PointerEvent, phase: 'move' | 'end') => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!viewport?.matches || !toValue(options.open)) {
      reset();
      return;
    }
    const result = resolveReleaseDrawerSheetGesture({
      deltaY: event.clientY - drag.startY,
      expanded: expanded.value,
      phase,
    });
    offsetY.value = result.offsetY;
    if (phase === 'move') return;
    cancelDrag();
    if (result.outcome === 'dismiss') options.onRequestClose();
    if (result.outcome === 'expand') expanded.value = true;
    if (result.outcome === 'collapse') expanded.value = false;
  };

  return {
    expanded: readonly(expanded),
    dragging: readonly(dragging),
    panelStyle,
    onPointerDown,
    onPointerMove: (event: PointerEvent) => applyGesture(event, 'move'),
    onPointerUp: (event: PointerEvent) => applyGesture(event, 'end'),
    onPointerCancel: (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) cancelDrag();
    },
  };
}
