import {
  computed,
  onScopeDispose,
  readonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';

import { RELEASE_DRAWER_SHEET_DISMISS_PX } from '../utils/resolveReleaseDrawerSheetGesture';

export function useDetailSheetDrag(options: {
  open: MaybeRefOrGetter<boolean>;
  onDismiss: () => void;
}) {
  const dragging = shallowRef(false);
  const offsetY = shallowRef(0);
  let drag: { startY: number; pointerId: number; handle: HTMLElement } | null = null;

  const sheetStyle = computed(() =>
    offsetY.value > 0 ? { transform: `translateY(${offsetY.value}px)` } : undefined
  );

  const cancelDrag = () => {
    const previous = drag;
    drag = null;
    dragging.value = false;
    offsetY.value = 0;
    if (previous?.handle.hasPointerCapture?.(previous.pointerId)) {
      previous.handle.releasePointerCapture(previous.pointerId);
    }
  };

  watch(
    () => toValue(options.open),
    (open) => {
      if (!open) cancelDrag();
    },
    { flush: 'sync' }
  );

  onScopeDispose(cancelDrag);

  const onPointerDown = (event: PointerEvent) => {
    if (!toValue(options.open) || event.button !== 0 || drag) return;
    if (
      event.target instanceof Element &&
      event.target.closest('button, a[href], input, select, textarea')
    ) {
      return;
    }
    const handle = event.currentTarget as HTMLElement;
    drag = { startY: event.clientY, pointerId: event.pointerId, handle };
    dragging.value = true;
    handle.setPointerCapture?.(event.pointerId);
  };

  const applyGesture = (event: PointerEvent, phase: 'move' | 'end') => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!toValue(options.open)) {
      cancelDrag();
      return;
    }

    const deltaY = Math.max(0, event.clientY - drag.startY);
    if (phase === 'move') {
      offsetY.value = deltaY;
      return;
    }

    cancelDrag();
    if (deltaY >= RELEASE_DRAWER_SHEET_DISMISS_PX) {
      options.onDismiss();
    }
  };

  return {
    dragging: readonly(dragging),
    offsetY: readonly(offsetY),
    sheetStyle,
    onPointerDown,
    onPointerMove: (event: PointerEvent) => applyGesture(event, 'move'),
    onPointerUp: (event: PointerEvent) => applyGesture(event, 'end'),
    onPointerCancel: (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) cancelDrag();
    },
  };
}
