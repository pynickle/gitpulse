import {
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

import type { UserOnboardingSettings } from '#shared/types/user-settings';
import { usePrefersReducedMotion } from '~/composables/useMediaQuery';
import { resolveNotificationTodoSwipeGuide } from '~/utils/resolveNotificationTodoSwipeGuide';

/** The list has finished laying out; let the reader's eye land before anything moves. */
const GUIDE_DELAY_MS = 500;

/** 300ms out + 800ms held + 320ms back, matching the stylesheet's keyframes. */
const GUIDE_DURATION_MS = 1420;

/** A static hint under reduced motion still needs long enough to be read. */
const HINT_DURATION_MS = 2600;

/** One page load gets one demonstration, however many times the list remounts. */
let sessionSpent = false;

const reducedMotion = usePrefersReducedMotion();

export interface UseNotificationTodoSwipeGuideOptions {
  /** The narrow list where the gesture has replaced the visible todo control. */
  narrowTouchList: MaybeRefOrGetter<boolean>;
  onNotificationsTab: MaybeRefOrGetter<boolean>;
  /** The notifications request has settled, with rows or with nothing. */
  loaded: MaybeRefOrGetter<boolean>;
  /** The target row's details have arrived, so its height is final. */
  targetReady: MaybeRefOrGetter<boolean>;
  /** The first row whose swipe would add a todo, or null when there is none. */
  addableRowId: MaybeRefOrGetter<string | null>;
  /** The saved flag, or null until the settings answer it. */
  seen: MaybeRefOrGetter<boolean | null>;
  updateOnboarding: (patch: Partial<UserOnboardingSettings>) => Promise<unknown>;
}

export interface UseNotificationTodoSwipeGuide {
  /** The row currently demonstrating the gesture. */
  guidingRowId: Ref<string | null>;
  /** The row carrying the short hint, either beside the demonstration or instead of it. */
  hintRowId: Ref<string | null>;
  /** Drops any pending demonstration; an interaction or a wide viewport ends it. */
  cancel: () => void;
}

/**
 * Teaches the narrow right-swipe once per reader.
 *
 * The saved flag is the source of "first visit", so the demonstration happens at most
 * once in a reader's life. It is consumed as soon as the first narrow touch list settles,
 * even when that list is empty, because the brief is explicit that a reader who never met
 * an eligible notification must not be taught later — and an interaction that cancels the
 * demonstration still spends the visit. The rest of that same page load stays open: rows
 * arriving afterwards may still demonstrate.
 */
export function useNotificationTodoSwipeGuide(
  options: UseNotificationTodoSwipeGuideOptions
): UseNotificationTodoSwipeGuide {
  const guidingRowId = shallowRef<string | null>(null);
  const hintRowId = shallowRef<string | null>(null);
  /** null until the saved settings answer whether this is a first visit. */
  const firstRun = shallowRef<boolean | null>(null);

  let consumed = false;
  let userInteracted = false;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(delayTimer);
    clearTimeout(endTimer);
    delayTimer = undefined;
    endTimer = undefined;
  };

  const stop = () => {
    clearTimers();
    guidingRowId.value = null;
    hintRowId.value = null;
  };

  const cancel = () => {
    if (guidingRowId.value === null && hintRowId.value === null && delayTimer === undefined) {
      // Nothing is pending; an early interaction still must not be followed by a
      // demonstration later in the same page load.
      userInteracted = true;
      return;
    }

    stop();
  };

  const startDemonstration = (rowId: string, staticHint: boolean) => {
    if (!import.meta.client || sessionSpent) return;
    sessionSpent = true;
    clearTimers();

    if (staticHint) {
      hintRowId.value = rowId;
      endTimer = setTimeout(() => {
        hintRowId.value = null;
      }, HINT_DURATION_MS);
      return;
    }

    delayTimer = setTimeout(() => {
      delayTimer = undefined;
      guidingRowId.value = rowId;
      hintRowId.value = rowId;
      endTimer = setTimeout(() => {
        guidingRowId.value = null;
        hintRowId.value = null;
      }, GUIDE_DURATION_MS);
    }, GUIDE_DELAY_MS);
  };

  const evaluate = () => {
    const rowId = toValue(options.addableRowId);

    // A demonstration never outlives the row it teaches on.
    if (guidingRowId.value !== null && guidingRowId.value !== rowId) {
      stop();
      return;
    }

    if (firstRun.value === null) return;

    const decision = resolveNotificationTodoSwipeGuide({
      narrowTouchList: toValue(options.narrowTouchList),
      onNotificationsTab: toValue(options.onNotificationsTab),
      loaded: toValue(options.loaded),
      targetReady: toValue(options.targetReady),
      firstRun: firstRun.value,
      spent: sessionSpent || userInteracted,
      hasAddableRow: rowId !== null,
      reducedMotion: reducedMotion.value,
    });

    if (decision.consume && !consumed) {
      consumed = true;
      void options.updateOnboarding({ notificationTodoSwipeSeen: true });
    }

    if (!rowId) return;

    if (decision.play) {
      startDemonstration(rowId, false);
      return;
    }

    if (decision.hint) {
      startDemonstration(rowId, true);
    }
  };

  watch(
    () => toValue(options.seen),
    (seen) => {
      if (firstRun.value !== null || seen === null) return;
      firstRun.value = !seen;
      evaluate();
    },
    { immediate: true }
  );

  watch(
    () => [
      toValue(options.narrowTouchList),
      toValue(options.onNotificationsTab),
      toValue(options.loaded),
      toValue(options.targetReady),
      toValue(options.addableRowId),
      reducedMotion.value,
    ],
    () => {
      // Losing the narrow touch list, or leaving the tab, drops the demonstration at once.
      if (!toValue(options.narrowTouchList) || !toValue(options.onNotificationsTab)) {
        stop();
        return;
      }

      evaluate();
    },
    { immediate: true }
  );

  let detachInteractionListeners: (() => void) | null = null;

  onMounted(() => {
    if (!import.meta.client || detachInteractionListeners) return;

    // The pointer press itself already matters: a reader who touches the list has
    // taken over, and the brief says any interaction drops the demonstration.
    const noteInteraction = () => cancel();
    window.addEventListener('pointerdown', noteInteraction, true);
    window.addEventListener('keydown', noteInteraction, true);
    window.addEventListener('wheel', noteInteraction, { passive: true, capture: true });

    detachInteractionListeners = () => {
      window.removeEventListener('pointerdown', noteInteraction, true);
      window.removeEventListener('keydown', noteInteraction, true);
      window.removeEventListener('wheel', noteInteraction, { capture: true });
    };
  });

  onScopeDispose(() => {
    detachInteractionListeners?.();
    detachInteractionListeners = null;
    stop();
  });

  return { guidingRowId, hintRowId, cancel };
}
