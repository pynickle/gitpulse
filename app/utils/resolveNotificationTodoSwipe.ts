/**
 * The right-swipe that replaces the visible todo control on a narrow viewport.
 *
 * Only horizontal movement counts, and only rightward: a leftward drag has no
 * counterpart action, so it reveals nothing and can never commit. Every value here
 * is a share of the row's own measured width, read once when the press starts, so a
 * 320px phone and an 860px narrow window move the card by the same proportion.
 */

/** A press must travel this far before the row claims the gesture from the scroller. */
export const NOTIFICATION_TODO_SWIPE_START_PX = 8;

/** The card follows the finger no further than this share of its own width. */
export const NOTIFICATION_TODO_SWIPE_FOLLOW_RATIO = 0.35;

/** The vertical extent has to lose by this much before the row claims the drag. */
export const NOTIFICATION_TODO_SWIPE_HORIZONTAL_BIAS = 1.5;

/** Releasing past this share of the card width runs the todo action. */
export const NOTIFICATION_TODO_SWIPE_COMMIT_RATIO = 0.25;

export type NotificationTodoSwipeState = 'idle' | 'following' | 'armed';

/**
 * `none` leaves the row alone (a tap, or a drag that never claimed the axis).
 * `commit` runs the action; `cancel` only bounces the card home. Both settled
 * outcomes keep the click that follows the release from opening the notification.
 */
export type NotificationTodoSwipeOutcome = 'none' | 'commit' | 'cancel';

export interface NotificationTodoSwipeInput {
  deltaX: number;
  deltaY: number;
  /** The row's measured width in pixels, read once when the press starts. */
  width: number;
  phase: 'move' | 'end';
  /** Sticky once claimed: the caller keeps it for the rest of the same drag. */
  locked: boolean;
}

export interface NotificationTodoSwipeStep {
  offset: number;
  state: NotificationTodoSwipeState;
  outcome: NotificationTodoSwipeOutcome;
  locked: boolean;
}

export function resolveNotificationTodoSwipe(
  input: NotificationTodoSwipeInput
): NotificationTodoSwipeStep {
  const usableWidth = Number.isFinite(input.width) ? Math.max(0, input.width) : 0;
  const maxOffset = usableWidth * NOTIFICATION_TODO_SWIPE_FOLLOW_RATIO;
  const commitOffset = usableWidth * NOTIFICATION_TODO_SWIPE_COMMIT_RATIO;

  // The vertical extent has to lose clearly, not merely by a pixel: a diagonal scroll
  // would otherwise steal the row from the list. Once claimed the axis stays claimed, so
  // a wobble mid-drag cannot hand the gesture back.
  const locked =
    input.locked ||
    (Math.abs(input.deltaX) >= NOTIFICATION_TODO_SWIPE_START_PX &&
      Math.abs(input.deltaX) >= Math.abs(input.deltaY) * NOTIFICATION_TODO_SWIPE_HORIZONTAL_BIAS);

  if (!locked) {
    return { offset: 0, state: 'idle', outcome: 'none', locked: false };
  }

  const offset = Math.min(Math.max(input.deltaX, 0), maxOffset);
  const state: NotificationTodoSwipeState =
    offset <= 0 ? 'idle' : offset >= commitOffset ? 'armed' : 'following';

  if (input.phase === 'move') {
    return { offset, state, outcome: 'none', locked: true };
  }

  // A zero-width row (an unlaid-out list) has no threshold to clear, so it can never
  // commit; the card just returns.
  const outcome: NotificationTodoSwipeOutcome =
    commitOffset > 0 && offset >= commitOffset ? 'commit' : 'cancel';

  return { offset, state, outcome, locked: true };
}
