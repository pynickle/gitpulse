import { onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';

import {
  resolveNotificationTodoSwipe,
  type NotificationTodoSwipeState,
} from '~/utils/resolveNotificationTodoSwipe';

/** A press that starts on one of these is theirs, never the gesture's. */
const INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea';

/** One short buzz when the action arms. Never the only confirmation — the label says it. */
const ARM_VIBRATION_MS = 10;

/** A release is followed by a click; the gesture has to outlive exactly that one. */
const SWALLOW_CLICK_MS = 400;

export interface UseNotificationTodoSwipeOptions {
  enabled: MaybeRefOrGetter<boolean>;
  /**
   * A drag ended on the gesture with a real outcome. `commit` means the threshold was
   * passed and the action should run; `cancel` means the card must bounce home. Either
   * way the caller owns `settle()`, because the wording has to leave the strip first.
   */
  onRelease: (outcome: 'commit' | 'cancel') => void;
}

export interface UseNotificationTodoSwipe {
  /** Follow distance in pixels, already clamped to the action's own geometry. */
  offset: Ref<number>;
  state: Ref<NotificationTodoSwipeState>;
  dragging: Ref<boolean>;
  /** The press surface; motion and release are followed on the document. */
  onPointerDown: (event: PointerEvent) => void;
  /** Bound in the capture phase so a drag never reaches an inner control either. */
  onClick: (event: MouseEvent) => void;
  /** Returns the card home and idles the reveal; called after the wording has faded. */
  settle: () => void;
}

interface ActiveDrag {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  locked: boolean;
  surface: HTMLElement;
}

/**
 * The right-swipe that replaces the narrow notification row's todo control.
 *
 * Pointer capture keeps the drag alive outside the row, `touch-action: pan-y` in the
 * stylesheet keeps vertical scrolling native, and the geometry itself lives in
 * `resolveNotificationTodoSwipe` so it can be pinned by tests. The composable never
 * decides *what* the action is: it reports a commit and lets the caller run it.
 */
export function useNotificationTodoSwipe(
  options: UseNotificationTodoSwipeOptions
): UseNotificationTodoSwipe {
  const offset = shallowRef(0);
  const state = shallowRef<NotificationTodoSwipeState>('idle');
  const dragging = shallowRef(false);

  let drag: ActiveDrag | null = null;
  let armedLatch = false;
  let swallowClick = false;
  let swallowTimer: ReturnType<typeof setTimeout> | undefined;

  const releaseCapture = (active: ActiveDrag) => {
    try {
      if (active.surface.hasPointerCapture(active.pointerId)) {
        active.surface.releasePointerCapture(active.pointerId);
      }
    } catch {
      // The surface may already be detached; capture is gone with it.
    }
  };

  const settle = () => {
    offset.value = 0;
    state.value = 'idle';
    armedLatch = false;
  };

  const forgetDrag = () => {
    const previous = drag;
    drag = null;
    dragging.value = false;
    detachDocumentListeners();
    if (previous) releaseCapture(previous);
  };

  const vibrate = () => {
    if (!import.meta.client) return;
    try {
      (navigator as Navigator & { vibrate?: (pattern: number) => boolean }).vibrate?.(
        ARM_VIBRATION_MS
      );
    } catch {
      // Haptics are progressive enhancement; a refusal is not a failure.
    }
  };

  /**
   * A settled gesture keeps the click that follows the release away from the row. Both
   * a commit and a bounce moved the card, so neither should also open a notification.
   */
  const armClickSuppression = () => {
    swallowClick = true;
    clearTimeout(swallowTimer);
    swallowTimer = setTimeout(() => {
      swallowClick = false;
    }, SWALLOW_CLICK_MS);
  };

  const finish = (outcome: 'none' | 'commit' | 'cancel') => {
    forgetDrag();

    if (outcome === 'none') {
      settle();
      return;
    }

    armClickSuppression();

    // The prompt ends with the release, whichever way it went: "release to add" must not
    // survive into the bounce or the save round-trip. The caller settles the card.
    armedLatch = false;
    state.value = 'idle';
    options.onRelease(outcome);
  };

  const applyPointer = (event: PointerEvent, phase: 'move' | 'end') => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const step = resolveNotificationTodoSwipe({
      deltaX: event.clientX - drag.startX,
      deltaY: event.clientY - drag.startY,
      width: drag.width,
      phase,
      locked: drag.locked,
    });

    drag.locked = step.locked;
    offset.value = step.offset;
    state.value = step.state;

    if (step.state === 'armed') {
      if (!armedLatch) {
        armedLatch = true;
        vibrate();
      }
    } else {
      armedLatch = false;
    }

    if (phase === 'end') finish(step.outcome);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (drag || event.button !== 0 || !toValue(options.enabled)) return;

    const target = event.target;
    // An inner control keeps its own press: swiping out from under it would fire the
    // control and the gesture both.
    if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return;

    const surface = event.currentTarget as HTMLElement | null;
    if (!surface) return;

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: surface.getBoundingClientRect().width,
      locked: false,
      surface,
    };
    dragging.value = true;

    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience; the document listeners below carry the drag regardless.
    }

    attachDocumentListeners();
  };

  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    clearTimeout(swallowTimer);
    event.stopPropagation();
    event.preventDefault();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    forgetDrag();
    settle();
  };

  // The drag is tracked on the document, not on the surface: pointer capture is only an
  // optimisation, and a browser that refuses it must not leave the card stuck half open.
  function attachDocumentListeners() {
    document.addEventListener('pointermove', handleDocumentMove);
    document.addEventListener('pointerup', handleDocumentUp);
    document.addEventListener('pointercancel', handleDocumentCancel);
  }

  function detachDocumentListeners() {
    document.removeEventListener('pointermove', handleDocumentMove);
    document.removeEventListener('pointerup', handleDocumentUp);
    document.removeEventListener('pointercancel', handleDocumentCancel);
  }

  function handleDocumentMove(event: PointerEvent) {
    applyPointer(event, 'move');
  }

  function handleDocumentUp(event: PointerEvent) {
    applyPointer(event, 'end');
  }

  function handleDocumentCancel(event: PointerEvent) {
    onPointerCancel(event);
  }

  watch(
    () => toValue(options.enabled),
    (enabled) => {
      if (!enabled) {
        forgetDrag();
        settle();
      }
    }
  );

  onScopeDispose(() => {
    clearTimeout(swallowTimer);
    forgetDrag();
  });

  return {
    offset,
    state,
    dragging,
    onPointerDown,
    onClick,
    settle,
  };
}
