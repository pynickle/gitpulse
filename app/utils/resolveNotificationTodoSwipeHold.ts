/** Long enough to read the confirmation, short enough that the card comes home. */
const CONFIRM_HOLD_MS = 600;

/** A refusal needs a beat longer than a success. */
const FAILURE_HOLD_MS = 1_000;

export interface NotificationTodoSwipeHoldInput {
  /** The settings write rolled back; the reader must see the refusal. */
  failed: boolean;
  /** Time since the optimistic confirmation appeared. */
  elapsedMs: number;
}

/**
 * How much longer the confirmation stays on screen before the card goes home.
 *
 * The success clock starts at the gesture, not at the settings write's resolution:
 * otherwise a slow storage backend (a hosted Redis, a queued save) would stretch the
 * confirmation by its own latency. A refusal has not been on screen before it arrives,
 * so it keeps its full hold.
 */
export function resolveNotificationTodoSwipeHold(input: NotificationTodoSwipeHoldInput): number {
  if (input.failed) return FAILURE_HOLD_MS;

  return Math.max(0, CONFIRM_HOLD_MS - Math.max(0, input.elapsedMs));
}
