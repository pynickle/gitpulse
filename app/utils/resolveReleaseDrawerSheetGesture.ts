export const RELEASE_DRAWER_SHEET_DISMISS_PX = 80;
export const RELEASE_DRAWER_SHEET_TOGGLE_PX = 48;

export type ReleaseDrawerSheetGesturePhase = 'move' | 'end';
export type ReleaseDrawerSheetGestureOutcome = 'hold' | 'dismiss' | 'expand' | 'collapse';

export default function resolveReleaseDrawerSheetGesture(input: {
  deltaY: number;
  expanded: boolean;
  phase: ReleaseDrawerSheetGesturePhase;
}): { offsetY: number; outcome: ReleaseDrawerSheetGestureOutcome } {
  const offsetY = input.expanded ? Math.max(0, input.deltaY) : input.deltaY;

  if (input.phase === 'move') {
    return { offsetY, outcome: 'hold' };
  }

  if (input.deltaY >= RELEASE_DRAWER_SHEET_DISMISS_PX) {
    return { offsetY, outcome: 'dismiss' };
  }
  if (input.expanded && input.deltaY >= RELEASE_DRAWER_SHEET_TOGGLE_PX) {
    return { offsetY, outcome: 'collapse' };
  }
  if (!input.expanded && input.deltaY <= -RELEASE_DRAWER_SHEET_TOGGLE_PX) {
    return { offsetY, outcome: 'expand' };
  }
  return { offsetY, outcome: 'hold' };
}
