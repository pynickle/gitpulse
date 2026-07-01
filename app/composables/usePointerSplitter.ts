import { onBeforeUnmount, shallowRef, type Ref } from 'vue';

interface UsePointerSplitterOptions {
  /** Reactive width value (pixels). The composable mutates this ref during drag. */
  width: Ref<number>;
  /** Inclusive minimum width in pixels. */
  min: number;
  /** Inclusive maximum width in pixels. */
  max: number;
  /**
   * Called once at the end of a drag with the final clamped pixel width,
   * so the caller can persist the value through whatever save pipeline it
   * uses. Per-frame updates only mutate the reactive `width` ref — this
   * callback is the persistence seam.
   */
  onCommit?: (width: number) => void;
}

interface UsePointerSplitterReturn {
  /** True while a drag is in progress. */
  isDragging: Readonly<Ref<boolean>>;
  /** Binds to the splitter handle element via `ref` for pointer capture. */
  handleRef: (element: HTMLElement | null) => void;
  /** Attach to the handle's `@pointerdown` handler. */
  onPointerDown: (event: PointerEvent) => void;
}

/**
 * Lightweight vertical splitter driven by the Pointer Events API.
 *
 * Tracks drag via `setPointerCapture` on the handle element, so motion
 * outside the handle still updates the width. Drag updates are scheduled
 * on `requestAnimationFrame` to keep layout writes off the hot path, and
 * only the passed-in reactive `width` ref is mutated per-frame — callers
 * persist via the `onCommit` callback fired once on pointer release.
 *
 * The composable is SSR-safe: document listeners are only registered on
 * the client and are torn down on unmount.
 */
export function usePointerSplitter(options: UsePointerSplitterOptions): UsePointerSplitterReturn {
  const { width, min, max, onCommit } = options;

  const isDragging = shallowRef(false);
  let handleEl: HTMLElement | null = null;
  let startX = 0;
  let startWidth = 0;
  let pointerId: number | null = null;
  let rafId = 0;
  let pendingWidth = 0;

  const clampWidth = (value: number) => {
    return Math.min(Math.max(Math.round(value), min), max);
  };

  const applyPending = () => {
    rafId = 0;
    const next = clampWidth(pendingWidth);
    if (next !== width.value) {
      width.value = next;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    event.preventDefault();
    pendingWidth = startWidth + (event.clientX - startX);

    if (rafId === 0) {
      rafId = window.requestAnimationFrame(applyPending);
    }
  };

  const detachListeners = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    if (handleEl && pointerId !== null) {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        // Element may be gone; safe to ignore.
      }
    }

    isDragging.value = false;
    pointerId = null;
    detachListeners();

    const next = clampWidth(pendingWidth);
    if (next !== width.value) {
      width.value = next;
    }
    onCommit?.(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) {
      return;
    }

    handleEl = event.currentTarget as HTMLElement | null;
    if (!handleEl) {
      return;
    }

    event.preventDefault();
    pointerId = event.pointerId;
    startX = event.clientX;
    startWidth = width.value;
    pendingWidth = startWidth;
    isDragging.value = true;

    try {
      handleEl.setPointerCapture(pointerId);
    } catch {
      // Capture can fail if the element is detached; fall back to document listeners only.
    }

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  };

  const handleRef = (element: HTMLElement | null) => {
    handleEl = element;
  };

  onBeforeUnmount(() => {
    detachListeners();
    handleEl = null;
    pointerId = null;
  });

  return {
    isDragging,
    handleRef,
    onPointerDown,
  };
}
