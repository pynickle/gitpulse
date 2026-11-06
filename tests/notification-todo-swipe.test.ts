import { describe, expect, test } from 'bun:test';

import { resolveNotificationTodoSwipe } from '../app/utils/resolveNotificationTodoSwipe';
import { resolveNotificationTodoSwipeGuide } from '../app/utils/resolveNotificationTodoSwipeGuide';
import { shouldReplaceNotificationTodoControl } from '../app/utils/shouldReplaceNotificationTodoControl';

/**
 * A 400px row: 140px of follow room, arming at 100px, releasing into the action from
 * 100px. The numbers are written out rather than derived from the module's constants,
 * so a change to the published geometry fails these tests instead of following them.
 */
const ROW_WIDTH = 400;
const FOLLOW_ROOM = 140;
const COMMIT_AT = 100;

const move = (deltaX: number, deltaY = 0, locked = false) =>
  resolveNotificationTodoSwipe({
    deltaX,
    deltaY,
    width: ROW_WIDTH,
    phase: 'move',
    locked,
  });

const release = (deltaX: number, deltaY = 0, locked = true) =>
  resolveNotificationTodoSwipe({
    deltaX,
    deltaY,
    width: ROW_WIDTH,
    phase: 'end',
    locked,
  });

describe('resolveNotificationTodoSwipe', () => {
  test('a movement below the 8px start slop keeps the axis unclaimed', () => {
    expect(move(7)).toEqual({
      offset: 0,
      state: 'idle',
      outcome: 'none',
      locked: false,
    });
  });

  test('a movement that is mostly vertical never claims the axis', () => {
    expect(move(20, 32)).toEqual({
      offset: 0,
      state: 'idle',
      outcome: 'none',
      locked: false,
    });
  });

  test('a nearly diagonal press is left to the scroller', () => {
    // 9px across against 8px down is a diagonal scroll, not a swipe: the horizontal
    // travel has to beat the vertical by half again.
    expect(move(9, 8)).toEqual({ offset: 0, state: 'idle', outcome: 'none', locked: false });
    expect(move(12, 8)).toMatchObject({ state: 'following', locked: true });
  });

  test('a mostly horizontal movement at the slop claims the axis and follows the finger', () => {
    expect(move(8, 2)).toEqual({
      offset: 8,
      state: 'following',
      outcome: 'none',
      locked: true,
    });
  });

  test('a leftward movement reveals nothing and never triggers the action', () => {
    expect(move(-60)).toMatchObject({ offset: 0, state: 'idle', locked: true });
    expect(release(-60)).toEqual({ offset: 0, state: 'idle', outcome: 'cancel', locked: true });
  });

  test('the card follows the finger no further than 140px on a 400px row', () => {
    expect(move(4_000)).toEqual({
      offset: FOLLOW_ROOM,
      state: 'armed',
      outcome: 'none',
      locked: true,
    });
  });

  test('crossing 100px arms the action without firing it', () => {
    expect(move(COMMIT_AT - 1)).toMatchObject({ offset: 99, state: 'following', outcome: 'none' });
    expect(move(COMMIT_AT)).toMatchObject({ offset: 100, state: 'armed', outcome: 'none' });
  });

  test('releasing past 100px runs the action', () => {
    expect(release(COMMIT_AT)).toMatchObject({ offset: 100, outcome: 'commit' });
  });

  test('releasing short of 100px bounces back', () => {
    expect(release(COMMIT_AT - 1)).toMatchObject({ offset: 99, outcome: 'cancel' });
  });

  test('dragging back below 100px before releasing cancels the action', () => {
    const armed = move(120);
    expect(armed.state).toBe('armed');

    expect(release(10, 0, armed.locked)).toMatchObject({ offset: 10, outcome: 'cancel' });
  });

  test('a row with no measured width can never commit', () => {
    expect(
      resolveNotificationTodoSwipe({
        deltaX: 120,
        deltaY: 0,
        width: 0,
        phase: 'end',
        locked: true,
      })
    ).toEqual({ offset: 0, state: 'idle', outcome: 'cancel', locked: true });
  });
});

describe('shouldReplaceNotificationTodoControl', () => {
  test('replaces the control on a narrow touch viewport only', () => {
    expect(shouldReplaceNotificationTodoControl({ narrow: true, finePointer: false })).toBe(true);
    expect(shouldReplaceNotificationTodoControl({ narrow: true, finePointer: true })).toBe(false);
    expect(shouldReplaceNotificationTodoControl({ narrow: false, finePointer: false })).toBe(false);
  });
});

describe('resolveNotificationTodoSwipeGuide', () => {
  const watching = {
    narrowTouchList: true,
    onNotificationsTab: true,
    loaded: true,
    targetReady: true,
    firstRun: true,
    spent: false,
    hasAddableRow: true,
    reducedMotion: false,
  };

  test('demonstrates the gesture once the first eligible list settles', () => {
    expect(resolveNotificationTodoSwipeGuide(watching)).toEqual({
      consume: true,
      play: true,
    });
  });

  test('puts the guide card up before the target card has stopped growing', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, targetReady: false })).toEqual({
      consume: true,
      play: false,
    });
  });

  test('consumes the first visit even when the list is empty, without demonstrating', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, hasAddableRow: false })).toEqual({
      consume: true,
      play: false,
    });
  });

  test('a reduced-motion reader gets the guide card but no moving card', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, reducedMotion: true })).toEqual({
      consume: true,
      play: false,
    });
  });

  test('a wide viewport neither consumes the first visit nor shows the card', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, narrowTouchList: false })).toEqual({
      consume: false,
      play: false,
    });
  });

  test('another tab neither consumes the first visit nor shows the card', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, onNotificationsTab: false })).toEqual({
      consume: false,
      play: false,
    });
  });

  test('an unsettled list waits before consuming anything', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, loaded: false })).toEqual({
      consume: false,
      play: false,
    });
  });

  test('an interaction that cancelled the demonstration still spends the first visit', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, spent: true })).toEqual({
      consume: true,
      play: false,
    });
  });

  test('a reader who already saw the guide is never taught again', () => {
    expect(resolveNotificationTodoSwipeGuide({ ...watching, firstRun: false })).toEqual({
      consume: false,
      play: false,
    });
  });
});
