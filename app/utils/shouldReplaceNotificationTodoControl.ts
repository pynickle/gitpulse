/**
 * The narrow touch viewport loses the todo control to the gesture, so that is the only
 * place the gesture's replacement affordance belongs. A narrow desktop window keeps the
 * control and therefore never meets the swipe-only treatment.
 */
export function shouldReplaceNotificationTodoControl(input: {
  narrow: boolean;
  finePointer: boolean;
}): boolean {
  return input.narrow && !input.finePointer;
}
