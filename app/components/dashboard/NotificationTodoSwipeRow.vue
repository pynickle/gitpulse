<template>
  <div
    class="notification-swipe-row"
    :class="[
      `notification-swipe-row--${tone}`,
      {
        'notification-swipe-row--swipeable': enabled,
        'notification-swipe-row--revealed': revealed,
        'notification-swipe-row--dragging': dragging,
        'notification-swipe-row--guiding': guiding,
      },
    ]"
    @click.capture="onClick"
  >
    <div class="notification-swipe-row__viewport">
      <div v-if="enabled" class="notification-swipe-row__action" aria-hidden="true">
        <!-- Width follows the uncovered strip, so the glyph and the wording sit in the
             middle of what the reader can actually see. -->
        <span class="notification-swipe-row__action-body" :style="actionBodyStyle">
          <component :is="actionIcon" :size="16" class="notification-swipe-row__action-icon" />
          <span class="notification-swipe-row__action-label">{{ actionLabel }}</span>
        </span>
      </div>

      <div
        class="notification-swipe-row__content"
        :style="contentStyle"
        @pointerdown="onPointerDown"
      >
        <!-- The action colour sits under the whole card. An unread card's wash is
             translucent, so the card needs its own opaque floor or the colour shows
             through the body instead of only around it. -->
        <div v-if="enabled" class="notification-swipe-row__card-backing" aria-hidden="true"></div>
        <slot />
      </div>
    </div>

    <span class="notification-swipe-row__announcer" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, ListMinusIcon, ListPlusIcon, TriangleExclamationPointIcon } from '@lucide/vue';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';

import type { NotificationTodoToggleResult } from '~/composables/useNotificationTodos';
import { resolveNotificationTodoSwipeAction } from '~/utils/resolveNotificationTodoSwipeAction';

/** Long enough to read the confirmation, short enough that the card comes home. */
const CONFIRM_HOLD_MS = 800;

/** A refusal needs a beat longer than a success. */
const FAILURE_HOLD_MS = 1_200;

/** The card's own return, matching the stylesheet's settle transition. */
const SETTLE_MS = 240;

/** The wording leaves before the card moves, so the card never slides back over it. */
const ACTION_FADE_MS = 120;

const {
  isTodo,
  enabled = true,
  guiding = false,
  toggleTodo,
} = defineProps<{
  /** Whether this notification already sits in the reader's todos. */
  isTodo: boolean;
  /** False on a wide viewport, where the visible control still owns the action. */
  enabled?: boolean;
  /** The first-visit demonstration is running on this row. */
  guiding?: boolean;
  /** Runs the action and reports whether the settings write actually landed. */
  toggleTodo: () => Promise<NotificationTodoToggleResult>;
}>();

const { t } = useI18n();

type SwipeTone = 'add' | 'remove' | 'done' | 'removed' | 'failed';

const feedback = shallowRef<NotificationTodoToggleResult | null>(null);
/** The action being executed; null until a swipe commits. */
const pendingAction = shallowRef<'add' | 'remove' | null>(null);
/** The glyph and wording have said their piece and are fading, ahead of the card's return. */
const contentDismissed = shallowRef(false);

let holdTimer: ReturnType<typeof setTimeout> | undefined;
let returnTimer: ReturnType<typeof setTimeout> | undefined;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let settleCard: () => void = () => {};

const clearFeedbackTimers = () => {
  clearTimeout(holdTimer);
  clearTimeout(returnTimer);
  clearTimeout(settleTimer);
  holdTimer = undefined;
  returnTimer = undefined;
  settleTimer = undefined;
};

const handleCommit = () => {
  const action = isTodo ? 'remove' : 'add';
  pendingAction.value = action;
  // The settings store applies the change optimistically, so the surface states it at
  // once; waiting for the round-trip would show "release to add" -> "add to todo" ->
  // "added to todo" and read as a flicker. A refused write corrects it below.
  feedback.value = action === 'add' ? 'added' : 'removed';
  contentDismissed.value = false;
  clearFeedbackTimers();

  void (async () => {
    let result: NotificationTodoToggleResult;
    try {
      result = await toggleTodo();
    } catch {
      // A rejected action must still let the card go home and say something.
      result = 'failed';
    }

    const holdMs = result === 'failed' ? FAILURE_HOLD_MS : CONFIRM_HOLD_MS;

    feedback.value = result;

    holdTimer = setTimeout(() => {
      // The wording goes first; then the card returns over an empty strip.
      dismissThenSettle();
    }, holdMs);

    settleTimer = setTimeout(
      () => {
        feedback.value = null;
        contentDismissed.value = false;
      },
      holdMs + ACTION_FADE_MS + SETTLE_MS
    );
  })();
};

/** Fades the glyph and wording out, then lets the card come home behind them. */
const dismissThenSettle = () => {
  contentDismissed.value = true;
  clearTimeout(returnTimer);
  returnTimer = setTimeout(() => {
    pendingAction.value = null;
    settleCard();
  }, ACTION_FADE_MS);
};

const handleRelease = (outcome: 'commit' | 'cancel') => {
  if (outcome === 'cancel') {
    dismissThenSettle();
    return;
  }

  handleCommit();
};

const { offset, state, dragging, onPointerDown, onClick, settle } = useNotificationTodoSwipe({
  enabled: () => enabled,
  onRelease: handleRelease,
});

settleCard = settle;

// A fresh press re-arms the wording, which a previous gesture may have faded out.
watch(dragging, (isDragging) => {
  if (isDragging) {
    contentDismissed.value = false;
  }
});

onScopeDispose(clearFeedbackTimers);

/** The action the row is offering right now: what it runs, or what it is running. */
const offeredAction = computed<'add' | 'remove'>(() => {
  if (pendingAction.value) return pendingAction.value;
  return isTodo ? 'remove' : 'add';
});

const actionView = computed(() =>
  resolveNotificationTodoSwipeAction({
    offered: offeredAction.value,
    armed: state.value === 'armed',
    feedback: feedback.value,
  })
);

const GLYPHS = {
  plus: ListPlusIcon,
  minus: ListMinusIcon,
  check: CheckIcon,
  warning: TriangleExclamationPointIcon,
} as const;

const tone = computed<SwipeTone>(() => actionView.value.tone);
const actionIcon = computed(() => GLYPHS[actionView.value.glyph]);
const actionLabel = computed(() => t(actionView.value.labelKey));
const announcement = computed(() => (actionView.value.settled ? t(actionView.value.labelKey) : ''));

const contentStyle = computed(() =>
  offset.value > 0 && !guiding ? { transform: `translate3d(${offset.value}px, 0, 0)` } : undefined
);

/** The uncovered width the action's content is centred in; absent while demonstrating. */
const actionBodyStyle = computed(() => {
  const style: Record<string, string> = {};

  if (offset.value > 0 && !guiding) {
    style.width = `${offset.value}px`;
  }

  if (contentDismissed.value) {
    style.opacity = '0';
  }

  return Object.keys(style).length > 0 ? style : undefined;
});

/**
 * The row's own background is only on screen while the card is actually off its mark —
 * a plain press must not flash a colour the reader did not ask for.
 */
const revealed = computed(() => offset.value > 0 || guiding || feedback.value !== null);
</script>

<style scoped lang="scss">
// The reveal is a share of the card's own width (see resolveNotificationTodoSwipe), so
// nothing here hardcodes a phone's pixels. `pan-y` is deliberate: the row owns the
// horizontal axis while vertical scrolling stays the scroller's.
.notification-swipe-row {
  position: relative;
}

.notification-swipe-row__viewport {
  position: relative;
}

// Clipping is a narrow-only concern: the card may slide and the action surface must be
// cut at the card's edge. A wide viewport never slides, and clipping it would trim the
// card's own shadow, so it keeps painting exactly as it did before.
.notification-swipe-row--swipeable .notification-swipe-row__viewport {
  border-radius: var(--bulma-card-radius, 0.75rem);
  overflow: hidden;
  touch-action: pan-y;
}

.notification-swipe-row--dragging .notification-swipe-row__viewport {
  user-select: none;
}

// The action surface is the row's own background: the whole card sits on it, so the
// revealed colour frames the card instead of sitting in a left-hand strip. The card's
// body is opaque (see __card-backing), so an unread card's translucent wash composites
// over a stable floor and keeps its original look.
.notification-swipe-row__action {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  border-radius: var(--bulma-card-radius, 0.75rem);
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

// Centred on both axes inside the uncovered strip: the row is 4px taller than the card,
// so `justify-content` centring is what puts the glyph and the wording on the card's
// middle line rather than at its top edge.
.notification-swipe-row__action-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.66rem;
  font-weight: 650;
  line-height: 1.1;
  // Matches ACTION_FADE_MS: the wording is gone before the card starts coming back.
  transition: opacity 120ms ease;
}

.notification-swipe-row--revealed .notification-swipe-row__action {
  opacity: 1;
}

// While a finger is driving, the reveal has to track it exactly.
.notification-swipe-row--dragging .notification-swipe-row__action {
  transition: none;
}

// The card's own opaque floor: exactly the card's box (the card carries a 0.25rem
// margin), moving with it, painted under it and over the action colour.
.notification-swipe-row__card-backing {
  position: absolute;
  inset: 0.25rem;
  border-radius: var(--bulma-card-radius, 0.75rem);
  background-color: var(--gitpulse-surface);
  pointer-events: none;
}

.notification-swipe-row__action-icon {
  flex: 0 0 auto;
}

.notification-swipe-row__content {
  position: relative;
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

// Narrow only, so a wide row keeps exactly the box it had before. Inside the swipe the
// wrapper needs a formatting context of its own: the card's 0.25rem margins belong to this
// box. Without it the vertical margins collapse out of the wrapper, the card rides its top
// edge, and the backing (inset by that same 0.25rem) leaves a translucent seam above and
// below the card.
.notification-swipe-row--swipeable .notification-swipe-row__content {
  display: flow-root;
  transform: translate3d(0, 0, 0);
}

// Promote only while something is actually moving, so a list of rows does not hold a
// compositor layer each.
.notification-swipe-row--dragging .notification-swipe-row__content,
.notification-swipe-row--guiding .notification-swipe-row__content {
  will-change: transform;
}

.notification-swipe-row--dragging .notification-swipe-row__content {
  transition: none;
}

// The add side is the soft green the brief asks for; removal borrows the danger tone
// the visible control already uses; a settled outcome reads as finished.
.notification-swipe-row--add .notification-swipe-row__action {
  background: color-mix(in srgb, var(--gitpulse-success) 14%, var(--gitpulse-surface));
  color: var(--gitpulse-success);
}

.notification-swipe-row--remove .notification-swipe-row__action {
  background: color-mix(in srgb, var(--gitpulse-danger) 12%, var(--gitpulse-surface));
  color: var(--gitpulse-danger);
}

.notification-swipe-row--done .notification-swipe-row__action {
  background: color-mix(in srgb, var(--gitpulse-success) 24%, var(--gitpulse-surface));
  color: var(--gitpulse-success);
}

// A finished removal is a deep red plate rather than the add side's green: the two
// outcomes must not look alike for the moment they are on screen.
.notification-swipe-row--removed .notification-swipe-row__action {
  background: color-mix(in srgb, var(--gitpulse-danger) 22%, var(--gitpulse-surface));
  color: var(--gitpulse-danger);
}

.notification-swipe-row--failed .notification-swipe-row__action {
  background: color-mix(in srgb, var(--gitpulse-warning) 18%, var(--gitpulse-surface));
  color: var(--gitpulse-warning);
}

.notification-swipe-row__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip-path: inset(50%);
  white-space: nowrap;
}

// The demonstration: slide out, hold, come home. Timings match GUIDE_DURATION_MS in
// useNotificationTodoSwipeGuide; the row's background is already on screen for it.
.notification-swipe-row--guiding .notification-swipe-row__content {
  animation: notification-todo-swipe-guide 2200ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes notification-todo-swipe-guide {
  0% {
    transform: translate3d(0, 0, 0);
  }

  20% {
    transform: translate3d(3.5rem, 0, 0);
  }

  80% {
    transform: translate3d(3.5rem, 0, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
}

// The uncovered strip the action is centred in grows in step with the card, so the glyph
// and wording appear centred instead of sliding in from the left edge. They leave before
// the card starts home — exactly like a released gesture — so the card never slides back
// over its own label.
.notification-swipe-row--guiding .notification-swipe-row__action-body {
  animation: notification-todo-swipe-guide-reveal 2200ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes notification-todo-swipe-guide-reveal {
  0% {
    width: 0;
  }

  20% {
    width: 3.5rem;
  }

  74% {
    width: 3.5rem;
    opacity: 1;
  }

  80% {
    width: 3.5rem;
    opacity: 0;
  }

  100% {
    width: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notification-swipe-row__content,
  .notification-swipe-row__action {
    transition: none;
  }

  .notification-swipe-row--guiding .notification-swipe-row__content {
    animation: none;
  }
}
</style>
