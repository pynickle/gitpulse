import { describe, expect, test } from 'bun:test';

import resolveReleaseDrawerSheetGesture from '../app/utils/resolveReleaseDrawerSheetGesture';

describe('resolveReleaseDrawerSheetGesture', () => {
  test('move reports the drag offset and does not settle an outcome', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 40,
        expanded: false,
        phase: 'move',
      })
    ).toEqual({ offsetY: 40, outcome: 'hold' });

    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 90,
        expanded: false,
        phase: 'move',
      })
    ).toEqual({ offsetY: 90, outcome: 'hold' });
  });

  test('an expanded sheet cannot be dragged upward', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: -30,
        expanded: true,
        phase: 'move',
      })
    ).toEqual({ offsetY: 0, outcome: 'hold' });
  });

  test('dragging down 80px dismisses a default-height sheet', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 80,
        expanded: false,
        phase: 'end',
      })
    ).toEqual({ offsetY: 80, outcome: 'dismiss' });
  });

  test('a short downward drag on a default-height sheet holds', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 79,
        expanded: false,
        phase: 'end',
      })
    ).toEqual({ offsetY: 79, outcome: 'hold' });
  });

  test('dragging up 48px expands a default-height sheet', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: -48,
        expanded: false,
        phase: 'end',
      })
    ).toEqual({ offsetY: -48, outcome: 'expand' });
  });

  test('a short upward drag on a default-height sheet holds', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: -47,
        expanded: false,
        phase: 'end',
      })
    ).toEqual({ offsetY: -47, outcome: 'hold' });
  });

  test('dragging down 80px dismisses an expanded sheet', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 80,
        expanded: true,
        phase: 'end',
      })
    ).toEqual({ offsetY: 80, outcome: 'dismiss' });
  });

  test('dragging down 48px collapses an expanded sheet', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 48,
        expanded: true,
        phase: 'end',
      })
    ).toEqual({ offsetY: 48, outcome: 'collapse' });
  });

  test('a short downward drag on an expanded sheet holds', () => {
    expect(
      resolveReleaseDrawerSheetGesture({
        deltaY: 47,
        expanded: true,
        phase: 'end',
      })
    ).toEqual({ offsetY: 47, outcome: 'hold' });
  });
});
