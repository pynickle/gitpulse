/**
 * When the narrow notification list demonstrates the right-swipe exactly once.
 *
 * "First visit" is a saved per-user flag, so the demonstration happens at most once
 * in a reader's life, not once per page load. The flag is consumed as soon as the
 * first narrow notifications list settles — even an empty one — because the brief is
 * explicit that a reader who never met an eligible notification must not be taught
 * later. The one exception is the rest of the same page load: rows that arrive after
 * the list settled may still be demonstrated, which is what `spent` guards.
 *
 * The guide card above the list shares that first visit, but it is not tied to a row:
 * it is due as soon as the list settles and stays until the reader closes it.
 */

export interface NotificationTodoSwipeGuideInput {
  /** The narrow list where the gesture has replaced the visible todo control. */
  narrowTouchList: boolean;
  /** The notifications list is the active tab. */
  onNotificationsTab: boolean;
  /** The notifications request has settled, with rows or with nothing. */
  loaded: boolean;
  /**
   * The target row's own details — labels, counts, the type badge — have arrived, so its
   * height is final. Demonstrating earlier means sliding a card that is still growing.
   */
  targetReady: boolean;
  /** The saved flag was still false when this page load began. */
  firstRun: boolean;
  /** This page load has already spent its one demonstration. */
  spent: boolean;
  /** At least one row's swipe would add a todo rather than remove one. */
  hasAddableRow: boolean;
  reducedMotion: boolean;
}

export interface NotificationTodoSwipeGuideDecision {
  /**
   * The first visit's guide is due: persist the flag and raise the persistent card above
   * the list. The card outlives the demonstration; it stays up until the reader closes
   * it, and returns if the narrow notifications list does.
   */
  consume: boolean;
  /** Run the automatic demonstration. */
  play: boolean;
}

export function resolveNotificationTodoSwipeGuide(
  input: NotificationTodoSwipeGuideInput
): NotificationTodoSwipeGuideDecision {
  const watching = input.narrowTouchList && input.onNotificationsTab;

  // Consuming is deliberately blind to `spent`: an interaction that cancels the
  // demonstration must still spend the first visit, or a reader who scrolled once would
  // be taught on every later visit. It is also blind to `targetReady`: the visit is spent
  // once the list is on screen, whatever the demonstration then waits for.
  const consume = watching && input.loaded && input.firstRun;

  if (
    !watching ||
    !input.loaded ||
    !input.targetReady ||
    !input.firstRun ||
    input.spent ||
    !input.hasAddableRow ||
    input.reducedMotion
  ) {
    return { consume, play: false };
  }

  return { consume, play: true };
}
