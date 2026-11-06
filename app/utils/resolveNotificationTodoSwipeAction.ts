import type { NotificationTodoToggleResult } from '~/composables/useNotificationTodos';

/**
 * How the revealed surface reads at any moment: what releasing would do, whether it is
 * armed, and what just finished. One function owns the four states so the wording, the
 * glyph and the tone cannot drift apart between the surface and the announcer.
 */

/** The surface's colour family. */
export type NotificationTodoSwipeTone = 'add' | 'remove' | 'done' | 'removed' | 'failed';

/** The glyph the surface paints; the component maps each to an icon. */
export type NotificationTodoSwipeGlyph = 'plus' | 'minus' | 'check' | 'warning';

export interface NotificationTodoSwipeActionView {
  tone: NotificationTodoSwipeTone;
  glyph: NotificationTodoSwipeGlyph;
  /** i18n key for the surface's wording. */
  labelKey: string;
  /** The action's outcome is on the surface, so the same wording is announced too. */
  settled: boolean;
}

export interface NotificationTodoSwipeActionInput {
  /** What releasing right now would do. */
  offered: 'add' | 'remove';
  /** The drag has passed the commit threshold and has not been released yet. */
  armed: boolean;
  feedback: NotificationTodoToggleResult | null;
}

const SETTLED_LABEL_KEYS: Partial<Record<NotificationTodoToggleResult, string>> = {
  added: 'dashboard.todos.swipeAdded',
  removed: 'dashboard.todos.swipeRemoved',
};

export function resolveNotificationTodoSwipeAction(
  input: NotificationTodoSwipeActionInput
): NotificationTodoSwipeActionView {
  const settledKey = input.feedback ? SETTLED_LABEL_KEYS[input.feedback] : undefined;
  if (settledKey) {
    // A completed removal keeps the danger family, one notch stronger: the green "done"
    // belongs to the add side only.
    return {
      tone: input.feedback === 'removed' ? 'removed' : 'done',
      glyph: 'check',
      labelKey: settledKey,
      settled: true,
    };
  }

  if (input.feedback === 'failed') {
    return {
      tone: 'failed',
      glyph: 'warning',
      labelKey:
        input.offered === 'remove'
          ? 'dashboard.todos.swipeRemoveFailed'
          : 'dashboard.todos.swipeAddFailed',
      settled: true,
    };
  }

  if (input.armed) {
    return {
      tone: input.offered,
      glyph: 'check',
      labelKey:
        input.offered === 'remove'
          ? 'dashboard.todos.swipeRemoveRelease'
          : 'dashboard.todos.swipeAddRelease',
      settled: false,
    };
  }

  return {
    tone: input.offered,
    glyph: input.offered === 'remove' ? 'minus' : 'plus',
    labelKey:
      input.offered === 'remove'
        ? 'dashboard.todos.swipeRemoveLabel'
        : 'dashboard.todos.swipeAddLabel',
    settled: false,
  };
}
